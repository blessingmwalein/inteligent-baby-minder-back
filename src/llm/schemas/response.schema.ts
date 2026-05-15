import { z } from 'zod';

export const TriageLevels = ['NORMAL', 'CONSULT_DOCTOR', 'URGENT', 'EMERGENCY'] as const;
export type TriageLevel = (typeof TriageLevels)[number];

export const GeminiReplySchema = z.object({
  reply: z.string().min(1),
  triageLevel: z.enum(TriageLevels),
  followUpQuestions: z.array(z.string()).max(3).optional(),
  topic: z.string().optional(),
});

export type GeminiReply = z.infer<typeof GeminiReplySchema>;

// Gemini SDK responseSchema — mirrors the Zod schema for forced-JSON output.
export const geminiResponseSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    triageLevel: {
      type: 'string',
      enum: [...TriageLevels],
    },
    followUpQuestions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3,
    },
    topic: { type: 'string' },
  },
  required: ['reply', 'triageLevel'],
} as const;
