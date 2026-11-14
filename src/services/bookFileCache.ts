const DATABASE_NAME = "librio-book-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "files";

interface CachedBookFile {
  key: string;
  blob: Blob;
  savedAt: number;
}

export function bookFileCacheKey(
  userId: string,
  filePath: string,
  expectedBytes: number,
  cacheVersion = "",
): string {
  return `${userId}:${filePath}:${expectedBytes}:${cacheVersion}`;
}

function openCacheDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador não oferece armazenamento local de arquivos."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          `Não foi possível abrir o cache local: ${request.error?.message ?? "erro desconhecido"}`,
        ),
      );
    request.onblocked = () =>
      reject(new Error("O cache local está sendo atualizado em outra aba."));
  });
}

export async function readCachedBookFile(key: string): Promise<Blob | null> {
  const database = await openCacheDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      const cached = request.result as CachedBookFile | undefined;
      resolve(cached?.blob ?? null);
    };
    request.onerror = () =>
      reject(
        new Error(
          `Não foi possível ler o cache local: ${request.error?.message ?? "erro desconhecido"}`,
        ),
      );
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(
        new Error(
          `A leitura do cache local falhou: ${transaction.error?.message ?? "erro desconhecido"}`,
        ),
      );
    };
  });
}

export async function writeCachedBookFile(
  key: string,
  blob: Blob,
): Promise<void> {
  const database = await openCacheDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      key,
      blob,
      savedAt: Date.now(),
    } satisfies CachedBookFile);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(
        new Error(
          `Não foi possível guardar a obra no cache local: ${transaction.error?.message ?? "erro desconhecido"}`,
        ),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(
        new Error(
          `O armazenamento local da obra falhou: ${transaction.error?.message ?? "erro desconhecido"}`,
        ),
      );
    };
  });
}

export async function deleteCachedBookFile(key: string): Promise<void> {
  const database = await openCacheDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(
        new Error(
          `Não foi possível remover a obra do cache local: ${transaction.error?.message ?? "erro desconhecido"}`,
        ),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(
        new Error(
          `A remoção do cache local falhou: ${transaction.error?.message ?? "erro desconhecido"}`,
        ),
      );
    };
  });
}
