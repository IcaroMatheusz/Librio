import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getReadingFormat, type LocalBook } from './types';

const INDEX_KEY = 'librio:local-library:v2';
const PROGRESS_PREFIX = 'librio:reader-progress:';
const libraryFolder = () => new Directory(Paths.document, 'librio-local-files');
const coversFolder = () => new Directory(Paths.document, 'librio-local-covers');
let pendingWrite = Promise.resolve();

export const localTitle = (name: string) => name.replace(/\.[^.]+$/, '');
export const localCategory = (book: LocalBook) => book.category || folderDetails(book.sourceUri ?? book.uri)?.category || localTitle(book.name);
export const localFolder = (book: LocalBook) => book.folder ?? folderDetails(book.sourceUri ?? book.uri)?.folder;
export const localProgressKey = (book: LocalBook) => PROGRESS_PREFIX + (book.sourceUri ?? book.uri);

function documentKey(uri: string) {
  const tree = uri.indexOf('/tree/');
  const document = uri.indexOf('/document/', tree + 6);
  return tree > 0 && document > tree ? uri.slice(0, tree) + uri.slice(document) : uri;
}

function folderDetails(uri: string) {
  const match = uri.match(/^content:\/\/[^/]+\/tree\/([^/]+)\/document\/(.+)$/);
  if (!match) return undefined;
  try {
    const root = decodeURIComponent(match[1]);
    const parent = decodeURIComponent(match[2]).split('/').slice(0, -1).join('/');
    const folder = { uri: uri.slice(0, uri.indexOf('/document/')), name: root.split(/[:/]/).pop() || root };
    return { folder, category: parent.split(/[:/]/).pop() || folder.name };
  } catch { return undefined; }
}

async function readIndex(): Promise<LocalBook[]> {
  const saved = await AsyncStorage.getItem(INDEX_KEY);
  let content = saved;
  if (content === null) {
    const legacy = new File(Paths.document, 'librio-local', 'index.json');
    content = legacy.exists ? await legacy.text() : '[]';
  }
  let data: unknown;
  try { data = JSON.parse(content); } catch { return []; }
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is LocalBook =>
    item && typeof item.uri === 'string' && typeof item.name === 'string' && typeof item.format === 'string' && !!getReadingFormat(item.format)
  );
}

function updateIndex<T>(action: (books: LocalBook[]) => Promise<T> | T) {
  const operation = pendingWrite.then(async () => {
    const books = await readIndex();
    const result = await action(books);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(books));
    return result;
  });
  pendingWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function readRememberedLocalFiles() {
  return (await readIndex()).filter((book) => !book.removed);
}

export async function findLocalBook(uri: string) {
  return (await readRememberedLocalFiles()).find((book) => book.uri === uri || book.sourceUri === uri);
}

function privateFile(directory: Directory, name: string) {
  if (!name || name === '.' || name === '..' || /[/\\]/.test(name)) return null;
  const file = new File(directory, name);
  return file.exists && file.size > 0 ? file : null;
}

export function getLocalFile(book: LocalBook) {
  if (!book.uri.startsWith('file://') || !book.uri.includes('/librio-local-files/')) return null;
  try { return privateFile(libraryFolder(), decodeURIComponent(book.uri.split('/').pop() ?? '')); }
  catch { return null; }
}

export function getCustomCover(book: LocalBook) {
  return book.customCover ? privateFile(coversFolder(), book.customCover)?.uri : undefined;
}

export function changeLocalCategory(uri: string, value: string) {
  const name = validCategory(value);
  return updateIndex((books) => {
    const book = books.find((item) => item.uri === uri && !item.removed);
    if (book) book.category = name;
  });
}

export function renameLocalCategory(category: string, value: string) {
  const name = validCategory(value);
  return updateIndex((books) => {
    for (const book of books) if (localCategory(book) === category) book.category = name;
  });
}

function validCategory(value: string) {
  const category = value.trim();
  if (!category || category.length > 100) throw new Error('Informe um nome de categoria com até 100 caracteres.');
  return category;
}

export function removeLocalSelection(selection: { uri: string } | { folder: string } | { category: string }) {
  return updateIndex((books) => {
    for (const book of books) {
      if ('uri' in selection ? book.uri === selection.uri
        : 'folder' in selection ? localFolder(book)?.uri === selection.folder
        : localCategory(book) === selection.category) book.removed = true;
    }
  });
}

export async function changeLocalCover(uri: string) {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true,
  });
  if (picked.canceled) return;
  const asset = picked.assets[0];
  const extension = asset.name.split('.').pop()?.toLowerCase();
  if (!extension || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new Error('Escolha uma imagem JPG, PNG ou WEBP.');
  return updateIndex(async (books) => {
    const book = books.find((item) => item.uri === uri && !item.removed);
    if (!book) return;
    const folder = coversFolder();
    folder.create({ idempotent: true, intermediates: true });
    const target = new File(folder, `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
    await new File(asset.uri).copy(target);
    book.customCover = target.name;
  });
}

export function restoreLocalCover(uri: string) {
  return updateIndex((books) => {
    const book = books.find((item) => item.uri === uri && !item.removed);
    if (book) delete book.customCover;
  });
}

type Source = { file: File; name: string; sourceUri?: string; category?: string; folder?: LocalBook['folder'] };
type ImportResult = { imported: number; skipped: number; unavailable: number };

async function importSources(sources: Source[], unavailable = 0): Promise<ImportResult> {
  const created: File[] = [];
  try {
    return await updateIndex(async (books) => {
      const destination = libraryFolder();
      destination.create({ intermediates: true, idempotent: true });
      let imported = 0;
      let skipped = 0;
      for (const source of sources) {
        const format = getReadingFormat(source.name.split('.').pop());
        if (!format) { skipped += 1; continue; }
        const key = source.sourceUri && documentKey(source.sourceUri);
        const existing = key ? books.findIndex((book) => documentKey(book.sourceUri ?? book.uri) === key) : -1;
        const previous = existing >= 0 ? books[existing] : undefined;
        if (previous && getLocalFile(previous) && (!source.file.size || source.file.size === previous.size)) {
          if (previous.removed) { previous.removed = false; imported += 1; }
          previous.folder ??= source.folder;
          previous.category ??= source.category;
          continue;
        }

        const target = new File(destination, `${Date.now()}-${Math.random().toString(36).slice(2)}.${format}`);
        try {
          await source.file.copy(target);
          if (target.size <= 0) throw new Error('Arquivo vazio');
          const book: LocalBook = {
            ...previous, uri: target.uri, name: source.name, format, size: target.size, removed: false,
            sourceUri: previous?.sourceUri ?? previous?.uri ?? source.sourceUri,
            category: previous ? localCategory(previous) : source.category,
            folder: (previous && localFolder(previous)) || source.folder,
          };
          if (previous) books[existing] = book;
          else books.push(book);
          created.push(target);
          imported += 1;
        } catch {
          unavailable += 1;
          if (target.exists) target.delete();
        }
      }
      return { imported, skipped, unavailable };
    });
  } catch (error) {
    for (const file of created) if (file.exists) file.delete();
    throw error;
  }
}

export async function importLocalFolder() {
  if (Platform.OS !== 'android') return null;
  const selection = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!selection.granted) return null;

  const selected = new Directory(selection.directoryUri);
  const root = { uri: selected.uri, name: selected.name };
  const directories = [selected];
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
          sources.push({ file: item, name: item.name, sourceUri: item.uri, category: directory.name, folder: root });
        }
      }
    } catch {
      unavailable += 1;
    }
  }
  return importSources(sources, unavailable);
}

export async function importLocalFiles() {
  if (Platform.OS === 'android') {
    // MIME metadata can describe CBR, CBZ and EPUB as generic archives.
    const selected = await File.pickFileAsync({ multipleFiles: true, mimeTypes: '*/*' });
    if (selected.canceled) return null;
    return importSources(selected.result.map((file) => ({ file, name: file.name, sourceUri: file.uri })));
  }
  const selected = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
  if (selected.canceled) return null;
  return importSources(selected.assets.map((asset) => ({ file: new File(asset.uri), name: asset.name })));
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
