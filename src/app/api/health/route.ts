import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  const url =
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  const checks: Record<string, unknown> = {
    status: 'ok',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'set' : 'MISSING',
    JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'MISSING',
    redis_url: url ? `found (${url.slice(0, 20)}...)` : 'MISSING',
    redis_token: token ? 'found' : 'MISSING',
    redis: 'untested',
  };

  if (url && token) {
    try {
      const redis = new Redis({ url, token });
      await redis.set('health_check', 'ok', { ex: 60 });
      const val = await redis.get('health_check');
      checks.redis = val === 'ok' ? 'connected' : `unexpected: ${val}`;
    } catch (err: any) {
      checks.redis = `ERROR: ${err.message}`;
      checks.status = 'unhealthy';
    }
  } else {
    checks.redis = 'not configured';
    checks.status = 'unhealthy';
  }

  return NextResponse.json(checks);
}
