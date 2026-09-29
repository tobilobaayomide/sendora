import { z } from "zod";

const envSchema = z.object({
  R2_ENDPOINT: z.url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  DATABASE_URL: z.string().url(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const variables = result.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Invalid environment variables: ${variables.join(", ")}`);
}

export const env = result.data;
