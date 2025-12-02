const stripeMode = (process.env.EXPO_PUBLIC_STRIPE_MODE || 'test').toLowerCase();

export const API_BASE_URL =
  stripeMode === 'live'
    ? process.env.EXPO_PUBLIC_AI_SERVER_URL_LIVE
    : process.env.EXPO_PUBLIC_AI_SERVER_URL_TEST || '';

export function ensureApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured. Set EXPO_PUBLIC_AI_SERVER_URL_TEST/LIVE.');
  }
  return API_BASE_URL;
}

export async function fetchWithAuth(
  path: string,
  clerkToken: string | null | undefined,
  init: RequestInit = {}
) {
  const baseUrl = ensureApiBaseUrl();
  if (!clerkToken) {
    throw new Error('Missing auth token for authenticated request.');
  }
  const incomingHeaders =
    init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init.headers || {});

  const headers = {
    'Content-Type': 'application/json',
    ...incomingHeaders,
    Authorization: `Bearer ${clerkToken}`,
  } as Record<string, string>;

  return fetch(`${baseUrl}${path}`, { ...init, headers });
}
