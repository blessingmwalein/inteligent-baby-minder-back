import { Injectable } from '@nestjs/common';
import {
  EMERGENCY_PHRASES,
  EMERGENCY_REPLY,
  EMERGENCY_PREFIX,
  URGENT_PREFIX,
} from './emergency-phrases';
import type { GeminiReply, TriageLevel } from '../llm/schemas/response.schema';

export interface SafetyOverride {
  reply: GeminiReply;
}

@Injectable()
export class SafetyService {
  /**
   * Pre-filter run before any LLM call. Returns a hardcoded EMERGENCY reply
   * if the message contains an unambiguous red-flag phrase; otherwise null.
   */
  preFilter(message: string): SafetyOverride | null {
    const normalized = this.normalize(message);
    const hit = EMERGENCY_PHRASES.find((phrase) => normalized.includes(phrase));
    if (!hit) return null;
    return {
      reply: {
        reply: EMERGENCY_REPLY,
        triageLevel: 'EMERGENCY',
        topic: 'safety',
      },
    };
  }

  /**
   * Post-filter applied to the LLM's reply. Prepends an unmistakable urgency
   * sentence when the model picked URGENT/EMERGENCY even if its wording was soft.
   */
  postFilter(reply: GeminiReply): GeminiReply {
    const triage: TriageLevel = reply.triageLevel;
    if (triage === 'EMERGENCY' && !reply.reply.startsWith(EMERGENCY_PREFIX.trim())) {
      return { ...reply, reply: EMERGENCY_PREFIX + reply.reply };
    }
    if (triage === 'URGENT' && !reply.reply.toLowerCase().includes('prompt medical')) {
      return { ...reply, reply: URGENT_PREFIX + reply.reply };
    }
    return reply;
  }

  private normalize(message: string): string {
    return message
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
