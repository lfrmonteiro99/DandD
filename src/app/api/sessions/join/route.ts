import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sessionManager } from '@/server/session-manager';

// POST /api/sessions/join — Join a session
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const { session, error } = await sessionManager.joinSession(session_id, auth.user_id, auth.username);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
