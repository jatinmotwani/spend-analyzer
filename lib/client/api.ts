'use client';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    credentials: 'same-origin',
  });
  const payload = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/')) window.location.assign('/login');
    throw new ApiError(res.status, payload?.error ?? 'error', payload?.message ?? 'Something went wrong.');
  }
  return payload as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, data?: unknown) => request<T>('POST', url, data ?? {}),
  patch: <T>(url: string, data: unknown) => request<T>('PATCH', url, data),
  del: <T>(url: string, data?: unknown) => request<T>('DELETE', url, data),
};

export const fetcher = <T>(url: string) => api.get<T>(url);

/** True when the request never reached the server (offline, DNS, etc.). */
export const isNetworkError = (e: unknown) => e instanceof TypeError;
