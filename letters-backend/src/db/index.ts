import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Create postgres connection lazily
let client: ReturnType<typeof postgres> | null = null;
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
let drizzleInstance: DrizzleDb | null = null;

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return connectionString;
}

// Lazy initialization of database connection
export function getDb() {
  if (!drizzleInstance) {
    const connectionString = getConnectionString();
    // Disable prefetch as it is not supported for "Transaction" pool mode
    client = postgres(connectionString, { prepare: false });
    drizzleInstance = drizzle(client, { schema });
  }
  return drizzleInstance;
}

// For backward compatibility, export db as a getter
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    return Reflect.get(getDb() as DrizzleDb, prop);
  },
});

// Re-export schema
export * from "./schema.js";
