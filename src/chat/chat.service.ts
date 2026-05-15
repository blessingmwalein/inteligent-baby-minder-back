import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../llm/gemini.service';
import { SafetyService } from '../safety/safety.service';
import { GREETING_REPLY } from '../llm/prompts/system-prompt';
import type { GeminiReply } from '../llm/schemas/response.schema';

const HISTORY_WINDOW = 20;

export interface ChatReplyPayload {
  messageId: string;
  reply: string;
  triageLevel: GeminiReply['triageLevel'];
  followUpQuestions?: string[];
  topic?: string;
  safetyOverride: boolean;
  degraded: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly logPromptContents: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly safety: SafetyService,
    private readonly config: ConfigService,
  ) {
    this.logPromptContents =
      this.config.get<boolean>('LOG_PROMPT_CONTENTS') === true;
  }

  async createSession(userId?: string) {
    const session = await this.prisma.chatSession.create({
      data: {
        ...(userId ? { userId } : {}),
      },
    });
    return {
      sessionId: session.id,
      greeting: GREETING_REPLY,
      createdAt: session.createdAt,
    };
  }

  async listSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        topic: true,
        title: true,
        lastTriageLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getMessages(sessionId: string, userId?: string) {
    const session = await this.assertSessionAccess(sessionId, userId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        triageLevel: true,
        safetyOverride: true,
        degraded: true,
        createdAt: true,
      },
    });
    return { sessionId: session.id, messages };
  }

  async deleteSession(sessionId: string, userId?: string) {
    await this.assertSessionAccess(sessionId, userId);
    await this.prisma.chatSession.delete({ where: { id: sessionId } });
    return { success: true };
  }

  /**
   * Send a user message, run safety → Gemini → safety post-filter,
   * persist both messages, and return the assistant reply.
   */
  async sendMessage(
    sessionId: string,
    content: string,
    userId?: string,
  ): Promise<ChatReplyPayload> {
    const session = await this.assertSessionAccess(sessionId, userId);

    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: Role.USER,
        content,
      },
    });

    const safetyHit = this.safety.preFilter(content);
    if (safetyHit) {
      this.logger.warn({
        msg: 'safety_pre_filter_hit',
        sessionId: session.id,
        userId,
      });
      return this.persistAssistantReply(session.id, safetyHit.reply, {
        modelName: 'safety-filter',
        latencyMs: 0,
        safetyOverride: true,
        degraded: false,
      });
    }

    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW + 1,
    });
    const orderedHistory = history.reverse().slice(0, -1);

    const generated = await this.gemini.generate(orderedHistory, content);
    const finalReply = this.safety.postFilter(generated.reply);

    this.logger.log({
      msg: 'chat_reply',
      sessionId: session.id,
      userId,
      model: generated.modelName,
      tokensIn: generated.tokensIn,
      tokensOut: generated.tokensOut,
      latencyMs: generated.latencyMs,
      triageLevel: finalReply.triageLevel,
      degraded: generated.degraded,
      content: this.logPromptContents ? content : undefined,
      reply: this.logPromptContents ? finalReply.reply : undefined,
    });

    return this.persistAssistantReply(session.id, finalReply, {
      modelName: generated.modelName,
      latencyMs: generated.latencyMs,
      tokensIn: generated.tokensIn,
      tokensOut: generated.tokensOut,
      safetyOverride: false,
      degraded: generated.degraded,
    });
  }

  private async persistAssistantReply(
    sessionId: string,
    reply: GeminiReply,
    meta: {
      modelName: string;
      latencyMs: number;
      tokensIn?: number;
      tokensOut?: number;
      safetyOverride: boolean;
      degraded: boolean;
    },
  ): Promise<ChatReplyPayload> {
    const created = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: Role.ASSISTANT,
        content: reply.reply,
        triageLevel: reply.triageLevel,
        modelName: meta.modelName,
        latencyMs: meta.latencyMs,
        tokensIn: meta.tokensIn,
        tokensOut: meta.tokensOut,
        safetyOverride: meta.safetyOverride,
        degraded: meta.degraded,
      },
    });

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        lastTriageLevel: reply.triageLevel,
        topic: reply.topic ?? undefined,
        title: undefined,
      },
    });

    return {
      messageId: created.id,
      reply: reply.reply,
      triageLevel: reply.triageLevel,
      followUpQuestions: reply.followUpQuestions,
      topic: reply.topic,
      safetyOverride: meta.safetyOverride,
      degraded: meta.degraded,
    };
  }

  private async assertSessionAccess(sessionId: string, userId?: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Chat session '${sessionId}' not found`);
    }
    // Anonymous sessions (userId null) are accessible to anyone with the id.
    // Authenticated sessions require the same userId.
    if (session.userId && userId && session.userId !== userId) {
      throw new ForbiddenException('You do not own this chat session');
    }
    if (session.userId && !userId) {
      throw new ForbiddenException('Authentication required for this session');
    }
    return session;
  }
}
