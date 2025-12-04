import { ensureApiBaseUrl } from './api';

export interface TikTokVideoResponse {
  mp4: string;
  thumbnail?: string | null;
  title?: string | null;
}

export async function fetchTikTokMp4(url: string): Promise<TikTokVideoResponse> {
  const baseUrl = ensureApiBaseUrl();
  const response = await fetch(`${baseUrl}/video/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Download failed (${response.status}): ${text || 'unexpected error'}`);
  }

  const data = await response.json();
  if (!data?.mp4) {
    throw new Error('No MP4 URL returned from server.');
  }

  return {
    mp4: data.mp4,
    thumbnail: data.thumbnail ?? null,
    title: data.title ?? null,
  };
}
