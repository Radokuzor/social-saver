import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export type LocalMediaType = 'video' | 'image';

export type LocalDownloadRecord = {
  sourceUrl: string;
  localUri: string;
  mediaType: LocalMediaType;
  createdAt: number;
};

const STORAGE_KEY = '@social-saver/local-downloads:v1';

type DownloadsIndex = Record<string, LocalDownloadRecord>;

async function readIndex(): Promise<DownloadsIndex> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as DownloadsIndex;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

async function writeIndex(index: DownloadsIndex): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

export function stableKeyForUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return `u_${Math.abs(hash)}`;
}

export function getDownloadsDirUri(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('File storage is not available on this device.');
  }
  return `${FileSystem.documentDirectory}downloads/`;
}

export async function ensureDownloadsDir(): Promise<string> {
  const dir = getDownloadsDirUri();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  return dir;
}

export async function getLocalDownload(sourceUrl: string): Promise<LocalDownloadRecord | null> {
  const key = stableKeyForUrl(sourceUrl);
  const index = await readIndex();
  const record = index[key];
  if (!record) return null;
  if (record.sourceUrl !== sourceUrl) return null;

  const info = await FileSystem.getInfoAsync(record.localUri);
  if (!info.exists) {
    delete index[key];
    await writeIndex(index);
    return null;
  }

  return record;
}

export async function upsertLocalDownload(record: LocalDownloadRecord): Promise<void> {
  const key = stableKeyForUrl(record.sourceUrl);
  const index = await readIndex();
  index[key] = record;
  await writeIndex(index);
}

export async function removeLocalDownload(sourceUrl: string): Promise<void> {
  const key = stableKeyForUrl(sourceUrl);
  const index = await readIndex();
  const record = index[key];
  delete index[key];
  await writeIndex(index);

  if (record?.localUri) {
    await FileSystem.deleteAsync(record.localUri, { idempotent: true }).catch(() => {});
  }
}
