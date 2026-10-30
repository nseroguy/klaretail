import dns from 'dns';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Force runtime DNS resolution strictly to IPv4 first across all sockets
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const rawUrl = process.env.DATABASE_URL || '';
// Keep the Neon pooler endpoint for serverless cold-start resilience
const connectionString = rawUrl;

const client = postgres(connectionString, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
});

export const db = drizzle(client, { schema });

export function createDbClient() {
  return db;
}
