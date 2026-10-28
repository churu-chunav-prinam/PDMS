// The only place that talks to the backend. Same origin, cookie session, CSRF header on writes.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly body: Record<string, unknown>,
  ) {
    super(code);
  }
}

let csrfToken: string | null = null;

async function ensureCsrf(): Promise<string> {
  if (csrfToken !== null) return csrfToken;
  const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  const body = (await res.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

async function handle(res: Response): Promise<Response> {
  if (res.ok) return res;
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* not JSON */
  }
  if (res.status === 401) window.dispatchEvent(new Event('poll:logged-out'));
  throw new ApiError(res.status, typeof body.error === 'string' ? body.error : 'NETWORK', body);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await handle(await fetch(path, { credentials: 'same-origin' }));
  return (await res.json()) as T;
}

async function postRaw(path: string, body: unknown, retry = true): Promise<Response> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await ensureCsrf() },
    body: JSON.stringify(body ?? {}),
  });
  // Session ended or rotated: fetch a fresh token once and retry.
  if (res.status === 403 && retry) {
    csrfToken = null;
    return postRaw(path, body, false);
  }
  return handle(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await postRaw(path, body);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** POST that answers with a file: saves it under `filename`. */
export async function apiDownload(path: string, body: unknown, filename: string): Promise<void> {
  const blob = await (await postRaw(path, body)).blob();
  saveBlob(blob, filename);
}

export async function apiGetFile(path: string, filename: string): Promise<void> {
  const res = await handle(await fetch(path, { credentials: 'same-origin' }));
  saveBlob(await res.blob(), filename);
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Reads a picked file as base64 (without the data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
