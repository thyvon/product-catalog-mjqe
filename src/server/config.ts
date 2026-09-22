import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_DATABASE: z.string().default("product_catalog"),
  GEMINI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  COMPANY_API_URL: z.string().default("http://esign.mjqe.com.kh"),
  JWT_SECRET: z.string().default("dev-jwt-secret-change-in-production-min-32-chars!!"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

export type Env = z.infer<typeof envSchema>;

let validated: Env | null = null;

export function getEnv(): Env {
  if (!validated) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
      validated = envSchema.parse(process.env);
    } else {
      validated = result.data;
    }
  }
  return validated;
}
