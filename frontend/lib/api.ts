export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || body?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return body as T;
}