import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
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
  TriageLevels,
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
const RETRY_DELAYS_MS = [400, 800, 1500];

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private client!: GoogleGenerativeAI;
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
    this.modelName = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        // JSON mode without a strict schema — Gemini's responseSchema with
        // string enums frequently rejects valid replies, then everything
        // falls through to the degraded reply. The system prompt enforces
        // the shape, and parseReply() normalizes the result.
        responseMimeType: 'application/json',
        temperature: 0.6,
        maxOutputTokens: 800,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          // Pediatric symptom descriptions can otherwise trip "dangerous content."
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
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
    let lastRawText: string | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.model.generateContent({
          contents,
          systemInstruction,
        });

        const text = result.response.text();
        lastRawText = text;
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
        lastError = err;
        const retryable = this.isRetryable(err);
        this.logger.warn(
          `Gemini attempt ${attempt + 1}/${MAX_ATTEMPTS} failed (retryable=${retryable}): ${this.describeError(err)}`,
        );
        if (!retryable || attempt === MAX_ATTEMPTS - 1) break;
        await this.sleep(RETRY_DELAYS_MS[attempt]);
      }
    }

    this.logger.error(
      `Gemini generate failed. Last error: ${this.describeError(lastError)}` +
        (lastRawText ? ` | rawText: ${lastRawText.slice(0, 400)}` : ''),
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

  /**
   * Forgiving JSON parser. Handles:
   * - raw JSON
   * - JSON wrapped in markdown code fences (```json … ```)
   * - extra prose around the JSON object
   * - mixed-case / unknown triage levels (normalized to NORMAL)
   * - missing optional fields
   */
  private parseReply(rawText: string): GeminiReply {
    if (!rawText || !rawText.trim()) {
      throw new Error('Gemini returned an empty response');
    }
    const cleaned = this.stripCodeFence(rawText).trim();

    let json: unknown;
    try {
      json = JSON.parse(cleaned);
    } catch {
      const objStart = cleaned.indexOf('{');
      const objEnd = cleaned.lastIndexOf('}');
      if (objStart === -1 || objEnd === -1 || objEnd <= objStart) {
        throw new Error(`Gemini did not return JSON. First 200 chars: ${cleaned.slice(0, 200)}`);
      }
      try {
        json = JSON.parse(cleaned.slice(objStart, objEnd + 1));
      } catch (e) {
        throw new Error(`Could not parse extracted JSON: ${(e as Error).message}`);
      }
    }

    // Normalize triage to uppercase + fall back to NORMAL if unknown.
    if (json && typeof json === 'object' && 'triageLevel' in (json as any)) {
      const raw = String((json as any).triageLevel ?? '').toUpperCase().trim();
      (json as any).triageLevel =
        (TriageLevels as readonly string[]).includes(raw) ? raw : 'NORMAL';
    } else if (json && typeof json === 'object') {
      (json as any).triageLevel = 'NORMAL';
    }

    const result = GeminiReplySchema.safeParse(json);
    if (!result.success) {
      throw new Error(
        `Gemini reply failed schema validation: ${result.error.message} | json: ${JSON.stringify(json).slice(0, 200)}`,
      );
    }
    return result.data;
  }

  private stripCodeFence(text: string): string {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return fenceMatch ? fenceMatch[1] : text;
  }

  private isRetryable(err: unknown): boolean {
    const msg = (err as any)?.message?.toLowerCase?.() ?? '';
    const status = (err as any)?.status ?? (err as any)?.statusCode;
    if (typeof status === 'number') {
      if (status === 429 || (status >= 500 && status < 600)) return true;
      // 4xx (except 429) is not retryable — bad key, bad input, etc.
      if (status >= 400 && status < 500) return false;
    }
    if (
      msg.includes('timeout') ||
      msg.includes('network') ||
      msg.includes('fetch failed') ||
      msg.includes('econnreset') ||
      msg.includes('rate limit') ||
      msg.includes('overloaded') ||
      msg.includes('service unavailable')
    ) {
      return true;
    }
    // JSON parse / schema validation: not retryable — same prompt → same bad output.
    if (msg.includes('json') || msg.includes('schema validation')) return false;
    return false;
  }

  private describeError(err: unknown): string {
    if (!err) return 'unknown error';
    const e = err as any;
    const parts: string[] = [];
    if (e.name) parts.push(`name=${e.name}`);
    if (e.status ?? e.statusCode) parts.push(`status=${e.status ?? e.statusCode}`);
    if (e.code) parts.push(`code=${e.code}`);
    if (e.message) parts.push(`msg=${String(e.message).slice(0, 300)}`);
    if (e.cause?.message) parts.push(`cause=${String(e.cause.message).slice(0, 200)}`);
    return parts.join(' ') || String(e);
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
