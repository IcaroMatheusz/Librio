import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadingPace } from './readingPace';

export type Checkpoint = {
  percent: number; page?: number; epubWord?: number; pace?: ReadingPace; lastReadAt?: number; hidden?: boolean; volumeId?: string;
};

const writes = new Map<string, Promise<void>>();
export const cloudProgressKey = (id: string) => `librio:cloud-progress:${id}`;
export const boundPercent = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;

function parseCheckpoint(raw: string | null): Checkpoint {
  try {
    const saved = JSON.parse(raw ?? '0');
    if (typeof saved === 'number') return { percent: boundPercent(saved) };
    const pace = saved.pace;
    return {
      percent: boundPercent(saved.percent),
      page: Number.isInteger(saved.page) && saved.page > 0 ? saved.page : undefined,
      ...(Number.isSafeInteger(saved.epubWord) && saved.epubWord >= 0 ? { epubWord: saved.epubWord } : {}),
      pace: pace && Number.isFinite(pace.seconds) && pace.seconds > 0 && Number.isFinite(pace.fraction) && pace.fraction > 0 ? pace : undefined,
      lastReadAt: Number.isFinite(saved.lastReadAt) ? saved.lastReadAt : undefined,
      hidden: saved.hidden === true,
      volumeId: typeof saved.volumeId === 'string' ? saved.volumeId : undefined,
    };
  } catch { return { percent: 0 }; }
}

export async function readCheckpoint(key: string) {
  await writes.get(key)?.catch(() => {});
  return parseCheckpoint(await AsyncStorage.getItem(key).catch(() => null));
}

export async function readCheckpoints(keys: string[]) {
  const unique = [...new Set(keys)];
  const byKey: Record<string, Checkpoint> = {};
  for (let i = 0; i < unique.length; i += 256) {
    const batch = unique.slice(i, i + 256);
    await Promise.all(batch.map((key) => writes.get(key)?.catch(() => {})));
    for (const [key, raw] of await AsyncStorage.multiGet(batch)) byKey[key] = parseCheckpoint(raw);
  }
  return byKey;
}

function updateCheckpoint(key: string, update: (current: Checkpoint) => Checkpoint) {
  const write = (writes.get(key)?.catch(() => {}) ?? Promise.resolve()).then(async () => {
    const current = parseCheckpoint(await AsyncStorage.getItem(key));
    await AsyncStorage.setItem(key, JSON.stringify(update(current)));
  });
  writes.set(key, write);
  const forget = () => { if (writes.get(key) === write) writes.delete(key); };
  void write.then(forget, forget);
  return write;
}

export function recordReading(key: string, checkpoint: Checkpoint) {
  return updateCheckpoint(key, () => checkpoint);
}

export function hideFromResume(key: string) {
  return updateCheckpoint(key, (current) => ({ ...current, hidden: true }));
}
