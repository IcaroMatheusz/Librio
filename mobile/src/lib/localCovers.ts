import { Directory, File, Paths } from 'expo-file-system';
import { getCustomCover, getLocalFile } from './local';
import { nativeMedia } from './nativeMedia';
import { extractEpubCover, extractNativeComic, readComicZip } from './reader';
import type { LocalBook } from './types';

function cacheFor(book: LocalBook) {
  const key = encodeURIComponent(book.uri.split('/').pop() ?? book.name);
  return new Directory(Paths.cache, 'librio-covers-v1', key);
}

export function getLocalCover(book: LocalBook) {
  const custom = getCustomCover(book);
  if (custom) return custom;
  const folder = cacheFor(book);
  if (!folder.exists) return undefined;
  const cover = folder.list().find((file) => file instanceof File && /^cover\./.test(file.name) && file.size > 0);
  return cover?.uri;
}

export async function saveAutomaticCover(book: LocalBook, source: File) {
  const folder = cacheFor(book);
  folder.create({ idempotent: true, intermediates: true });
  const extension = source.name.split('.').pop()?.toLowerCase();
  if (!extension) return;
  const target = new File(folder, `cover.${extension}`);
  if (target.exists && target.size > 0) return;
  const staging = new File(folder, `part-${Math.random().toString(36).slice(2)}`);
  try {
    await source.copy(staging);
    await staging.move(target, { overwrite: true });
  } finally {
    if (staging.uri !== target.uri && staging.exists) staging.delete();
  }
}

export async function generateLocalCover(
  book: LocalBook,
  signal: AbortSignal,
  rarFallback?: (file: File, folder: Directory, signal: AbortSignal) => Promise<string | undefined>,
) {
  const cached = getLocalCover(book);
  if (cached || signal.aborted) return cached;
  const file = getLocalFile(book);
  if (!file) return undefined;
  const folder = new Directory(Paths.cache, 'librio-cover-work', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  folder.create({ intermediates: true });
  try {
    let uri: string | undefined;
    if (book.format === 'pdf' && nativeMedia) {
      const output = new File(folder, 'cover.jpg');
      await nativeMedia.renderPdfCover(file.uri, output.uri);
      uri = output.uri;
    } else if (book.format === 'cbz') {
      uri = (await readComicZip(file.uri, folder, signal, true))[0]?.uri;
    } else if (book.format === 'cbr') {
      const nativePages = await extractNativeComic(file, folder, signal, true);
      uri = nativePages ? nativePages[0]?.uri : await rarFallback?.(file, folder, signal);
    } else if (book.format === 'epub') {
      uri = await extractEpubCover(file.uri, folder, signal);
    }
    if (!uri || signal.aborted) return undefined;
    await saveAutomaticCover(book, new File(uri));
    return getLocalCover(book);
  } finally {
    if (folder.exists) folder.delete();
  }
}
