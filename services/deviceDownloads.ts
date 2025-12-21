import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export type DownloadableMediaType = 'image' | 'video';

function getExtensionFromUrl(url: string): string | null {
  const match = url.split('?')[0].split('#')[0].match(/\.([a-zA-Z0-9]{2,6})$/);
  return match ? match[1].toLowerCase() : null;
}

function inferExtension(url: string, mediaType: DownloadableMediaType): string {
  const ext = getExtensionFromUrl(url);
  if (!ext) return mediaType === 'video' ? 'mp4' : 'jpg';

  const allowedVideo = new Set(['mp4', 'mov', 'm4v', 'webm']);
  const allowedImage = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'gif', 'webp']);

  if (allowedVideo.has(ext) || allowedImage.has(ext)) return ext;
  return mediaType === 'video' ? 'mp4' : 'jpg';
}

function looksLikeHtml(headers?: Record<string, string>): boolean {
  if (!headers) return false;
  const contentType =
    headers['Content-Type'] ||
    headers['content-type'] ||
    headers['CONTENT-TYPE'] ||
    '';
  return typeof contentType === 'string' && contentType.toLowerCase().includes('text/html');
}

export async function downloadAndSaveToLibrary(params: {
  remoteUrl: string;
  mediaType: DownloadableMediaType;
  filenameBase?: string;
}): Promise<void> {
  const cacheDirectoryUri = FileSystem.Paths.cache.uri;

  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to save downloads.');
  }

  const extension = inferExtension(params.remoteUrl, params.mediaType);
  const filenameBase = (params.filenameBase || `social-saver-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, '');
  const fileUri = `${cacheDirectoryUri}${filenameBase}.${extension}`;

  const result = await FileSystem.downloadAsync(params.remoteUrl, fileUri);
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
    throw new Error(`Download failed (HTTP ${result.status}).`);
  }

  if (looksLikeHtml(result.headers)) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
    throw new Error('That link does not point to a direct media file.');
  }

  await MediaLibrary.saveToLibraryAsync(result.uri);
}
