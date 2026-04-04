const BASE_URL = '';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err: any) {
    throw new Error(`Network error: ${err.message}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Server error (${response.status}): invalid response`);
  }

  if (!response.ok) {
    throw new Error(data.error || `API error (${response.status})`);
  }

  return data;
}

// Auth
export async function register(username: string, email: string, password: string) {
  const data = await fetchAPI('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  if (data.token) localStorage.setItem('token', data.token);
  return data;
}

export async function login(email: string, password: string) {
  const data = await fetchAPI('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) localStorage.setItem('token', data.token);
  return data;
}

export async function getMe() {
  return fetchAPI('/api/auth/me');
}

// Sessions
export async function createSession(name: string, maxPlayers: number = 4) {
  return fetchAPI('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ name, max_players: maxPlayers }),
  });
}

export async function listSessions() {
  return fetchAPI('/api/sessions');
}

export async function joinSession(sessionId: string) {
  return fetchAPI('/api/sessions/join', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// Characters
export async function createCharacter(data: {
  session_id: string;
  name: string;
  race: string;
  character_class: string;
  abilities: Record<string, number>;
}) {
  return fetchAPI('/api/characters', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Game
export async function startGame(sessionId: string) {
  return fetchAPI('/api/game/start', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function getGameState(sessionId: string) {
  return fetchAPI(`/api/game/state?session_id=${sessionId}`);
}

export async function sendAction(sessionId: string, actionType: string, text?: string, targetId?: string) {
  return fetchAPI('/api/game/action', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      action_type: actionType,
      text,
      target_id: targetId,
    }),
  });
}

export async function sendRoll(sessionId: string, skill: string, dc: number) {
  return fetchAPI('/api/game/roll', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, skill, dc }),
  });
}
