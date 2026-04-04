import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  const checks: Record<string, string> = {
    status: 'ok',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'set' : 'MISSING',
    JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'MISSING',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'MISSING',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'MISSING',
    redis: 'untested',
  };

  // Test Redis connection
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.set('health_check', 'ok', { ex: 60 });
      const val = await redis.get('health_check');
      checks.redis = val === 'ok' ? 'connected' : `unexpected: ${val}`;
    } catch (err: any) {
      checks.redis = `ERROR: ${err.message}`;
      checks.status = 'unhealthy';
    }
  } else {
    checks.redis = 'not configured (using in-memory fallback)';
  }

  if (checks.OPENAI_API_KEY === 'MISSING') checks.status = 'unhealthy';
  if (checks.JWT_SECRET === 'MISSING') checks.status = 'unhealthy';

  return NextResponse.json(checks);
}
