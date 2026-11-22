import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Prefer pooled DATABASE_URL for resilient, fast IPv4 connectivity with connection pooling
let dbUrl = env.DATABASE_URL || env.DIRECT_URL;
if (dbUrl && dbUrl.includes('supabase.com') && !dbUrl.includes('sslmode=')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

export const prisma = new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
});
