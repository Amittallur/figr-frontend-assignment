import { ScreenItem } from '../types/screens';
import { ElementDetails } from '../types/element';

const API_BASE = 'http://localhost:4000';

export interface ApiFetchOptions {
  latency?: number;
  fail?: number;
}

export async function fetchScreens(
  signal?: AbortSignal,
  options?: ApiFetchOptions
): Promise<ScreenItem[]> {
  const url = new URL(`${API_BASE}/screens`);
  if (options?.latency !== undefined) {
    url.searchParams.set('latency', String(options.latency));
  }
  if (options?.fail !== undefined) {
    url.searchParams.set('fail', String(options.fail));
  }

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Screens API failed with status ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Screens API returned malformed JSON: ${text.slice(0, 50)}`);
  }

  if (!Array.isArray(data)) {
    throw new Error('Screens API returned unexpected body shape (expected array)');
  }

  return data;
}

export async function fetchElementDetails(
  key: string,
  signal?: AbortSignal,
  options?: ApiFetchOptions
): Promise<ElementDetails | null> {
  if (!key) return null;

  const url = new URL(`${API_BASE}/elements/${encodeURIComponent(key)}`);
  if (options?.latency !== undefined) {
    url.searchParams.set('latency', String(options.latency));
  }
  if (options?.fail !== undefined) {
    url.searchParams.set('fail', String(options.fail));
  }

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });

  // 404 is valid "No details for this element" - NOT an error!
  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Details API failed with status ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Details API returned malformed JSON: ${text.slice(0, 50)}`);
  }

  // Validate expected properties
  if (typeof data !== 'object' || data === null || !data.component) {
    throw new Error('Details API returned invalid structure');
  }

  return data as ElementDetails;
}
