import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getReadingFormat, type LocalBook } from './types';

const INDEX_KEY = 'librio:local-library:v2';
const PROGRESS_PREFIX = 'librio:reader-progress:';
const folder = () => new Directory(Paths.document, 'librio-local-files');
let pendingWrite = Promise.resolve();

export function localProgressKey(book: LocalBook) {
  return PROGRESS_PREFIX + (book.sourceUri ?? book.uri);
}

export async function readRememberedLocalFiles(): Promise<LocalBook[]> {
  const saved = await AsyncStorage.getItem(INDEX_KEY);
  const legacy = new File(Paths.document, 'librio-local', 'index.json');
  const content = saved ?? (legacy.exists ? await legacy.text() : '[]');
  let data: unknown;
  try { data = JSON.parse(content); } catch { return []; }
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is LocalBook =>
    item && typeof item.uri === 'string' && typeof item.name === 'string' && typeof item.format === 'string' && !!getReadingFormat(item.format)
  );
}

export async function findLocalBook(uri: string) {
  return (await readRememberedLocalFiles()).find((book) => book.uri === uri || book.sourceUri === uri);
}

export function getLocalFile(book: LocalBook) {
  if (!book.uri.startsWith('file://') || !book.uri.includes('/librio-local-files/')) return null;
  const name = decodeURIComponent(book.uri.slice(book.uri.lastIndexOf('/') + 1));
  if (!name || name === '.' || name === '..' || /[/\\]/.test(name)) return null;
  const file = new File(folder(), name);
  return file.exists && file.size > 0 ? file : null;
}

type Source = { file: File; name: string; sourceUri?: string };
type ImportResult = { imported: number; skipped: number; unavailable: number };

function documentKey(uri: string) {
  const tree = uri.indexOf('/tree/');
  const document = uri.indexOf('/document/', tree + 6);
  return tree > 0 && document > tree ? uri.slice(0, tree) + uri.slice(document) : uri;
}

function importSources(sources: Source[], unavailable = 0): Promise<ImportResult> {
  const operation = pendingWrite.then(async () => {
    const books = await readRememberedLocalFiles();
    const destination = folder();
    destination.create({ intermediates: true, idempotent: true });
    const created: File[] = [];
    let skipped = 0;

    for (const source of sources) {
      const format = getReadingFormat(source.name.split('.').pop());
      if (!format) { skipped += 1; continue; }
      const sourceKey = source.sourceUri ? documentKey(source.sourceUri) : null;
      const existing = sourceKey ? books.findIndex((book) => documentKey(book.sourceUri ?? book.uri) === sourceKey) : -1;
      if (existing >= 0 && getLocalFile(books[existing])) continue;

      const target = new File(destination, `${Date.now()}-${Math.random().toString(36).slice(2)}.${format}`);
      try {
        await source.file.copy(target);
        if (target.size <= 0) throw new Error('Arquivo vazio');
        const book: LocalBook = {
          uri: target.uri, name: source.name, format, size: target.size,
          sourceUri: existing >= 0 ? books[existing].sourceUri ?? books[existing].uri : source.sourceUri,
        };
        if (existing >= 0) books[existing] = book;
        else books.push(book);
        created.push(target);
      } catch {
        unavailable += 1;
        if (target.exists) target.delete();
      }
    }

    try {
      if (created.length) await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(books));
    } catch (error) {
      for (const file of created) if (file.exists) file.delete();
      throw error;
    }
    return { imported: created.length, skipped, unavailable };
  });
  pendingWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function importLocalFolder() {
  if (Platform.OS !== 'android') return null;
  const selection = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!selection.granted) return null;

  const directories = [new Directory(selection.directoryUri)];
  const visited = new Set<string>();
  const sources: Source[] = [];
  let unavailable = 0;
  for (const directory of directories) {
    if (visited.has(directory.uri)) continue;
    visited.add(directory.uri);
    try {
      for (const item of directory.list()) {
        if (item instanceof Directory) directories.push(item);
        else if (getReadingFormat(item.name.split('.').pop())) {
          sources.push({ file: item, name: item.name, sourceUri: item.uri });
        }
      }
    } catch {
      unavailable += 1;
    }
  }
  return importSources(sources, unavailable);
}

export async function importLocalFiles() {
  const selection = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    // Android providers often advertise CBZ, CBR and EPUB as generic archives.
    type: '*/*',
  });
  if (selection.canceled) return null;
  return importSources(selection.assets.map((asset) => ({ file: new File(asset.uri), name: asset.name })));
}

export async function reconnectLocalBook(book: LocalBook) {
  const selection = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (selection.canceled) return false;
  const asset = selection.assets[0];
  if (asset.name.normalize('NFC').toLowerCase() !== book.name.normalize('NFC').toLowerCase()) {
    throw new Error(`Selecione o arquivo “${book.name}” para recuperar esta leitura.`);
  }
  const { unavailable } = await importSources([
    { file: new File(asset.uri), name: asset.name, sourceUri: book.sourceUri ?? book.uri },
  ]);
  if (unavailable) throw new Error('A cópia falhou. Confira se o arquivo está disponível e se há espaço no aparelho.');
  return true;
}
