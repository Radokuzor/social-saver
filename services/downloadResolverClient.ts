import { ensureApiBaseUrl } from './api';

export type ResolvedDownload = {
  assetUrl: string;
  mediaType: 'video' | 'image';
  filename?: string;
  expiresAt?: number;
  provider?: string;
};

export async function resolveDownloadAsset(params: {
  url: string;
  firebaseIdToken?: string;
}): Promise<ResolvedDownload> {
  const baseUrl = process.env.EXPO_PUBLIC_DOWNLOAD_BASE_URL || ensureApiBaseUrl();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.firebaseIdToken) {
    headers.Authorization = `Bearer ${params.firebaseIdToken}`;
  }

  const res = await fetch(`${baseUrl}/download/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: params.url }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    throw new Error(`Resolve failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
  }

  const data = (await res.json()) as Partial<ResolvedDownload>;
  if (!data?.assetUrl || (data.mediaType !== 'video' && data.mediaType !== 'image')) {
    throw new Error('Server did not return a downloadable asset.');
  }

  return data as ResolvedDownload;
}
