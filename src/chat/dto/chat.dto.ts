import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

const SendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message exceeds 4000 character limit')
    .transform((s) => s.normalize('NFKC').replace(CONTROL_CHARS, '')),
});

export class SendMessageDto extends createZodDto(SendMessageSchema) {}
