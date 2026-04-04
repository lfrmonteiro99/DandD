import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  // Find all UPSTASH-related env vars
  const upstashVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toUpperCase().includes('UPSTASH') || key.toUpperCase().includes('KV_REST')) {
      upstashVars[key] = value ? `set (${value.slice(0, 15)}...)` : 'empty';
    }
  }

  // Try to find URL and TOKEN
  const urlCandidates = [
    'UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL',
    'UPSTASH_REDIS_REST_KV_REST_URL', 'UPSTASH_REDIS_REST_KV_URL',
    'UPSTASH_REDIS_REST_REDIS_URL',
  ];
  const tokenCandidates = [
    'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_KV_REST_TOKEN', 'UPSTASH_REDIS_REST_KV_TOKEN',
    'UPSTASH_REDIS_REST_REDIS_TOKEN',
  ];

  let foundUrl = '';
  let foundUrlKey = '';
  for (const key of urlCandidates) {
    if (process.env[key]) { foundUrl = process.env[key]!; foundUrlKey = key; break; }
  }
  // Also scan all env vars
  if (!foundUrl) {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toUpperCase().includes('UPSTASH') && key.toUpperCase().endsWith('URL') && value) {
        foundUrl = value; foundUrlKey = key; break;
      }
    }
  }

  let foundToken = '';
  let foundTokenKey = '';
  for (const key of tokenCandidates) {
    if (process.env[key]) { foundToken = process.env[key]!; foundTokenKey = key; break; }
  }
  if (!foundToken) {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toUpperCase().includes('UPSTASH') && key.toUpperCase().endsWith('TOKEN') && value) {
        foundToken = value; foundTokenKey = key; break;
      }
    }
  }

  const checks: Record<string, unknown> = {
    status: 'ok',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'set' : 'MISSING',
    JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'MISSING',
    redis_url_found: foundUrlKey || 'NONE',
    redis_token_found: foundTokenKey || 'NONE',
    all_upstash_vars: upstashVars,
    redis: 'untested',
  };

  if (foundUrl && foundToken) {
    try {
      const redis = new Redis({ url: foundUrl, token: foundToken });
      await redis.set('health_check', 'ok', { ex: 60 });
      const val = await redis.get('health_check');
      checks.redis = val === 'ok' ? 'connected' : `unexpected: ${val}`;
    } catch (err: any) {
      checks.redis = `ERROR: ${err.message}`;
      checks.status = 'unhealthy';
    }
  } else {
    checks.redis = 'not configured (no matching URL+TOKEN found)';
    checks.status = 'unhealthy';
  }

  return NextResponse.json(checks);
}
