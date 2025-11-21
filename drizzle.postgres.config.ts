import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required. Please set it to your PostgreSQL connection string.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  strict: false,
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
