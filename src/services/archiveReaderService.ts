import {
  BlobReader,
  BlobWriter,
  ZipReader,
  type FileEntry,
} from "@zip.js/zip.js";
import unrarWasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";

const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;
const MAX_COMIC_PAGES = 500;
const MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;
const MAX_COVER_SIZE = 50 * 1024 * 1024;

export interface ArchivePage {
  name: string;
  blob: Blob;
}

export type ArchiveProgress = (completed: number, total: number) => void;

function getImageType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "jpg") return "image/jpeg";
  return `image/${extension ?? "jpeg"}`;
}

function sortPages(pages: ArchivePage[]): ArchivePage[] {
  return pages.sort((first, second) => comparePageNames(first.name, second.name));
}

function comparePageNames(first: string, second: string): number {
  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

async function hasZipSignature(archive: Blob): Promise<boolean> {
  const signature = new Uint8Array(
    await archive.slice(0, 4).arrayBuffer(),
  );
  return (
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    ((signature[2] === 0x03 && signature[3] === 0x04) ||
      (signature[2] === 0x05 && signature[3] === 0x06) ||
      (signature[2] === 0x07 && signature[3] === 0x08))
  );
}

async function extractCbz(
  archive: Blob,
  onProgress?: ArchiveProgress,
): Promise<ArchivePage[]> {
  const reader = new ZipReader(new BlobReader(archive));

  try {
    const entries = await reader.getEntries();
    const imageEntries = entries
      .filter(
        (entry): entry is FileEntry =>
          entry.directory === false && IMAGE_EXTENSIONS.test(entry.filename),
      )
      .sort((first, second) =>
        comparePageNames(first.filename, second.filename),
      );

    if (imageEntries.length > MAX_COMIC_PAGES) {
      throw new Error("Este arquivo contém páginas demais para abrir no navegador.");
    }
    const totalSize = imageEntries.reduce(
      (size, entry) => size + (entry.uncompressedSize ?? 0),
      0,
    );
    if (totalSize > MAX_UNCOMPRESSED_SIZE) {
      throw new Error("As páginas descompactadas excedem o limite de 200 MB.");
    }

    const pages: ArchivePage[] = [];
    for (const [index, entry] of imageEntries.entries()) {
      pages.push({
        name: entry.filename,
        blob: await entry.getData(new BlobWriter()),
      });
      onProgress?.(index + 1, imageEntries.length);
    }

    if (pages.length === 0) {
      throw new Error("Este CBZ não contém páginas de imagem compatíveis.");
    }

    return pages;
  } finally {
    await reader.close();
  }
}

async function extractCbr(
  archive: Blob,
  onProgress?: ArchiveProgress,
): Promise<ArchivePage[]> {
  if (await hasZipSignature(archive)) {
    return extractCbz(archive, onProgress);
  }

  const [{ createExtractorFromData }, wasmResponse] = await Promise.all([
    import("node-unrar-js/esm/index.esm.js"),
    fetch(unrarWasmUrl),
  ]);
  if (!wasmResponse.ok) {
    throw new Error("Não foi possível carregar o leitor de arquivos CBR.");
  }

  const wasmBinary = await wasmResponse.arrayBuffer();
  const extractor = await createExtractorFromData({
    data: await archive.arrayBuffer(),
    wasmBinary,
  });
  const fileHeaders = Array.from(extractor.getFileList().fileHeaders).filter(
    (header) => !header.flags.directory && IMAGE_EXTENSIONS.test(header.name),
  );

  if (fileHeaders.length > MAX_COMIC_PAGES) {
    throw new Error("Este arquivo contém páginas demais para abrir no navegador.");
  }
  const totalSize = fileHeaders.reduce((size, header) => size + header.unpSize, 0);
  if (totalSize > MAX_UNCOMPRESSED_SIZE) {
    throw new Error("As páginas descompactadas excedem o limite de 200 MB.");
  }

  if (fileHeaders.length === 0) {
    throw new Error("Este CBR não contém páginas de imagem compatíveis.");
  }

  const pages: ArchivePage[] = [];
  for (const [index, header] of fileHeaders.entries()) {
    const extractedFiles = extractor.extract({ files: [header.name] });
    const file = Array.from(extractedFiles.files).find(
      (entry) => entry.extraction && !entry.fileHeader.flags.directory,
    );
    if (file?.extraction) {
      const imageBytes = new Uint8Array(file.extraction.length);
      imageBytes.set(file.extraction);
      pages.push({
        name: file.fileHeader.name,
        blob: new Blob([imageBytes], {
          type: getImageType(file.fileHeader.name),
        }),
      });
    }
    onProgress?.(index + 1, fileHeaders.length);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  return sortPages(pages);
}

async function extractFirstCbzPage(
  archive: Blob,
  onProgress?: ArchiveProgress,
): Promise<ArchivePage> {
  const reader = new ZipReader(new BlobReader(archive));

  try {
    const entries = await reader.getEntries();
    const firstImage = entries
      .filter(
        (entry): entry is FileEntry =>
          entry.directory === false && IMAGE_EXTENSIONS.test(entry.filename),
      )
      .sort((first, second) =>
        comparePageNames(first.filename, second.filename),
      )[0];

    if (!firstImage) {
      throw new Error("Este CBZ não contém páginas de imagem compatíveis.");
    }
    if ((firstImage.uncompressedSize ?? 0) > MAX_COVER_SIZE) {
      throw new Error("A primeira página deste CBZ é grande demais para gerar a capa.");
    }

    return {
      name: firstImage.filename,
      blob: await firstImage.getData(new BlobWriter(), {
        onprogress: (completed, total) => {
          onProgress?.(completed, total);
        },
      }),
    };
  } finally {
    await reader.close();
  }
}

async function extractFirstCbrPage(
  archive: Blob,
  onProgress?: ArchiveProgress,
): Promise<ArchivePage> {
  if (await hasZipSignature(archive)) {
    return extractFirstCbzPage(archive, onProgress);
  }

  onProgress?.(0, 1);
  const [{ createExtractorFromData }, wasmResponse] = await Promise.all([
    import("node-unrar-js/esm/index.esm.js"),
    fetch(unrarWasmUrl),
  ]);
  if (!wasmResponse.ok) {
    throw new Error("Não foi possível carregar o leitor de arquivos CBR.");
  }

  const wasmBinary = await wasmResponse.arrayBuffer();
  const extractor = await createExtractorFromData({
    data: await archive.arrayBuffer(),
    wasmBinary,
  });
  const firstImage = Array.from(extractor.getFileList().fileHeaders)
    .filter(
      (header) => !header.flags.directory && IMAGE_EXTENSIONS.test(header.name),
    )
    .sort((first, second) => comparePageNames(first.name, second.name))[0];

  if (!firstImage) {
    throw new Error("Este CBR não contém páginas de imagem compatíveis.");
  }
  if (firstImage.unpSize > MAX_COVER_SIZE) {
    throw new Error("A primeira página deste CBR é grande demais para gerar a capa.");
  }

  const extractedFiles = extractor.extract({ files: [firstImage.name] });
  const extractedCover = Array.from(extractedFiles.files).find(
    (file) => file.extraction && !file.fileHeader.flags.directory,
  );
  if (!extractedCover?.extraction) {
    throw new Error("Não foi possível extrair a primeira página deste CBR.");
  }

  const imageBytes = new Uint8Array(extractedCover.extraction.length);
  imageBytes.set(extractedCover.extraction);
  onProgress?.(1, 1);
  return {
    name: extractedCover.fileHeader.name,
    blob: new Blob([imageBytes], {
      type: getImageType(extractedCover.fileHeader.name),
    }),
  };
}

export async function extractFirstComicPage(
  fileType: string,
  archive: Blob,
  onProgress?: ArchiveProgress,
): Promise<ArchivePage> {
  if (fileType === "CBZ") return extractFirstCbzPage(archive, onProgress);
  if (fileType === "CBR") return extractFirstCbrPage(archive, onProgress);
  throw new Error("Este formato não é um arquivo de quadrinhos compatível.");
}

export async function extractComicPages(
  fileType: string,
  archive: Blob,
  onProgress?: ArchiveProgress,
): Promise<ArchivePage[]> {
  if (fileType === "CBZ") return extractCbz(archive, onProgress);
  if (fileType === "CBR") return extractCbr(archive, onProgress);
  throw new Error("Este formato não é um arquivo de quadrinhos compatível.");
}
