// Drizzle Kit config for generating versioned SQL migrations from src/db/schema.ts.
// The running server applies idempotent DDL at boot (src/db/ddl.ts); use `npm run db:generate`
// when you want tracked migration files for production.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://ear_warrior:ear_warrior@localhost:5432/ear_warrior',
  },
});
