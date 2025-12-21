import * as FileSystem from 'expo-file-system';
import { resolveDownloadAsset } from './downloadResolverClient';
import { ensureDownloadsDir, stableKeyForUrl, upsertLocalDownload } from './localDownloads';

function getExtensionFromUrl(url: string): string | null {
  const match = url.split('?')[0].split('#')[0].match(/\.([a-zA-Z0-9]{2,6})$/);
  return match ? match[1].toLowerCase() : null;
}

function inferExtension(assetUrl: string, mediaType: 'video' | 'image'): string {
  const ext = getExtensionFromUrl(assetUrl);
  if (!ext) return mediaType === 'video' ? 'mp4' : 'jpg';

  const allowedVideo = new Set(['mp4', 'mov', 'm4v', 'webm']);
  const allowedImage = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'gif', 'webp']);
  if (allowedVideo.has(ext) || allowedImage.has(ext)) return ext;
  return mediaType === 'video' ? 'mp4' : 'jpg';
}

export async function downloadForOffline(params: {
  sourceUrl: string;
  firebaseIdToken?: string;
  onProgress?: (progress01: number) => void;
}): Promise<{ localUri: string; mediaType: 'video' | 'image' }> {
  const resolved = await resolveDownloadAsset({ url: params.sourceUrl, firebaseIdToken: params.firebaseIdToken });

  const downloadsDir = await ensureDownloadsDir();
  const extension = inferExtension(resolved.assetUrl, resolved.mediaType);
  const localUri = `${downloadsDir}${stableKeyForUrl(params.sourceUrl)}.${extension}`;

  await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});

  const resumable = FileSystem.createDownloadResumable(
    resolved.assetUrl,
    localUri,
    {},
    (progress) => {
      if (!progress.totalBytesExpectedToWrite) return;
      params.onProgress?.(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
    },
  );

  const result = await resumable.downloadAsync();
  if (!result?.uri) {
    throw new Error('Download did not return a file.');
  }

  await upsertLocalDownload({
    sourceUrl: params.sourceUrl,
    localUri: result.uri,
    mediaType: resolved.mediaType,
    createdAt: Date.now(),
  });

  return { localUri: result.uri, mediaType: resolved.mediaType };
}

