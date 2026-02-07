import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql', // Changed to postgresql
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Expect DATABASE_URL for Neon
  },
});