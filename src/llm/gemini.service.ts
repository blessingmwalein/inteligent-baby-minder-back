import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  SchemaType,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import type { AdviceReference, ChatMessage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildSystemPrompt, FALLBACK_DEGRADED_REPLY } from './prompts/system-prompt';
import {
  GeminiReplySchema,
  GeminiReply,
  TriageLevel,
} from './schemas/response.schema';

export interface GenerateResult {
  reply: GeminiReply;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  modelName: string;
  degraded: boolean;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 500, 1000];
const REQUEST_TIMEOUT_MS = 25_000;

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private model!: GenerativeModel;
  private modelName!: string;
  private cachedReferences: AdviceReference[] = [];
  private cachedSystemPrompt: string | undefined;
  private referencesLoadedAt = 0;
  private readonly referenceTtlMs = 5 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    this.modelName = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-1.5-flash';

    const client = new GoogleGenerativeAI(apiKey);
    this.model = client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            reply: { type: SchemaType.STRING },
            triageLevel: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['NORMAL', 'CONSULT_DOCTOR', 'URGENT', 'EMERGENCY'],
            },
            followUpQuestions: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            topic: { type: SchemaType.STRING },
          },
          required: ['reply', 'triageLevel'],
        },
        temperature: 0.6,
        maxOutputTokens: 800,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    this.logger.log(`Gemini model initialized: ${this.modelName}`);
  }

  private async getReferences(): Promise<AdviceReference[]> {
    const now = Date.now();
    if (
      this.cachedReferences.length > 0 &&
      now - this.referencesLoadedAt < this.referenceTtlMs
    ) {
      return this.cachedReferences;
    }
    try {
      this.cachedReferences = await this.prisma.adviceReference.findMany({
        orderBy: { topic: 'asc' },
      });
      this.referencesLoadedAt = now;
      this.cachedSystemPrompt = undefined;
    } catch (err) {
      this.logger.warn(`Failed to load AdviceReference rows: ${(err as Error).message}`);
    }
    return this.cachedReferences;
  }

  private async buildSystemInstruction(): Promise<string> {
    const refs = await this.getReferences();
    if (!this.cachedSystemPrompt) {
      this.cachedSystemPrompt = buildSystemPrompt(refs);
    }
    return this.cachedSystemPrompt;
  }

  /**
   * Generate a structured reply for the given user message, persisting nothing.
   * Caller is responsible for storing both user and assistant messages.
   */
  async generate(
    history: ChatMessage[],
    userMessage: string,
  ): Promise<GenerateResult> {
    const systemInstruction = await this.buildSystemInstruction();
    const contents = this.mapHistoryToContents(history);
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const start = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const result = await this.model.generateContent(
          {
            contents,
            systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
          },
          { signal: controller.signal } as unknown as { signal: AbortSignal },
        );
        clearTimeout(timer);

        const text = result.response.text();
        const parsed = this.parseReply(text);
        const usage = (result.response as any).usageMetadata;
        return {
          reply: parsed,
          tokensIn: usage?.promptTokenCount,
          tokensOut: usage?.candidatesTokenCount,
          latencyMs: Date.now() - start,
          modelName: this.modelName,
          degraded: false,
        };
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        if (!this.isRetryable(err) || attempt === MAX_ATTEMPTS - 1) break;
        await this.sleep(RETRY_DELAYS_MS[attempt]);
      }
    }

    this.logger.error(
      `Gemini generate failed after retries: ${(lastError as Error)?.message ?? lastError}`,
    );
    return {
      reply: {
        reply: FALLBACK_DEGRADED_REPLY,
        triageLevel: 'NORMAL' as TriageLevel,
      },
      latencyMs: Date.now() - start,
      modelName: this.modelName,
      degraded: true,
    };
  }

  private mapHistoryToContents(history: ChatMessage[]) {
    return history
      .filter((m) => m.role !== 'SYSTEM')
      .map((m) => ({
        role: m.role === 'USER' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
  }

  private parseReply(rawText: string): GeminiReply {
    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start === -1 || end === -1) {
        throw new Error(`Gemini did not return JSON: ${rawText.slice(0, 120)}`);
      }
      json = JSON.parse(rawText.slice(start, end + 1));
    }
    const parsed = GeminiReplySchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Gemini reply failed schema validation: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  private isRetryable(err: unknown): boolean {
    const msg = (err as any)?.message?.toLowerCase?.() ?? '';
    const status = (err as any)?.status ?? (err as any)?.statusCode;
    if (status === 429 || (status >= 500 && status < 600)) return true;
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch')) {
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Invalidate the system-prompt cache (e.g. after reseeding AdviceReference). */
  invalidateReferenceCache() {
    this.cachedReferences = [];
    this.cachedSystemPrompt = undefined;
    this.referencesLoadedAt = 0;
  }
}
