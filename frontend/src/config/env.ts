import { z } from "zod";

const environmentSchema = z.object({
  VITE_API_BASE_URL: z.string().trim().default(""),
  VITE_API_PREFIX: z.string().trim().default("/api"),
});

const parsedEnvironment = environmentSchema.safeParse(import.meta.env);

if (!parsedEnvironment.success) {
  throw new Error("Invalid frontend environment configuration.");
}

function normalizePath(value: string): string {
  if (!value) return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

export const env = {
  apiBaseUrl: parsedEnvironment.data.VITE_API_BASE_URL.replace(/\/$/, ""),
  apiPrefix: normalizePath(parsedEnvironment.data.VITE_API_PREFIX),
  mode: import.meta.env.MODE,
} as const;
