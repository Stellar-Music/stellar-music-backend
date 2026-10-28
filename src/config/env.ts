import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  STREAMING_HMAC_SECRET: z.string().min(16).default('stellar_music_dev_secret_key_32chars_long!'),
  STELLAR_NETWORK: z.enum(['TESTNET', 'PUBLIC']).default('TESTNET'),
  HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  DATABASE_URL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (err: any) {
  if (err instanceof z.ZodError) {
    console.error('❌ Fatal: Environment variable validation failed:');
    err.errors.forEach((e) => {
      console.error(`  - ${e.path.join('.')}: ${e.message}`);
    });
    process.exit(1);
  }
  throw err;
}

export const env = parsedEnv;
