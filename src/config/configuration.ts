import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  GEMINI_API_KEY: z.string().min(10, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
  LOG_PROMPT_CONTENTS: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),

  CHAT_MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(4000),
  CHAT_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
  GLOBAL_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadAndValidateConfig(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export default loadAndValidateConfig;
