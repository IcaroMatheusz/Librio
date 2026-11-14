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

export interface ArchivePage {
  name: string;
  blob: Blob;
}

function getImageType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "jpg") return "image/jpeg";
  return `image/${extension ?? "jpeg"}`;
}

function sortPages(pages: ArchivePage[]): ArchivePage[] {
  return pages.sort((first, second) =>
    first.name.localeCompare(second.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

async function extractCbz(archive: Blob): Promise<ArchivePage[]> {
  const reader = new ZipReader(new BlobReader(archive));

  try {
    const entries = await reader.getEntries();
    const imageEntries = entries
      .filter(
        (entry): entry is FileEntry =>
          entry.directory === false && IMAGE_EXTENSIONS.test(entry.filename),
      )
      .sort((first, second) =>
        first.filename.localeCompare(second.filename, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
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
    for (const entry of imageEntries) {
      pages.push({
        name: entry.filename,
        blob: await entry.getData(new BlobWriter()),
      });
    }

    if (pages.length === 0) {
      throw new Error("Este CBZ não contém páginas de imagem compatíveis.");
    }

    return pages;
  } finally {
    await reader.close();
  }
}

async function extractCbr(archive: Blob): Promise<ArchivePage[]> {
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

  const extractedFiles = extractor.extract({
    files: fileHeaders.map(({ name }) => name),
  });

  const pages = Array.from(extractedFiles.files).flatMap((file) => {
    if (!file.extraction || file.fileHeader.flags.directory) return [];
    const imageBytes = new Uint8Array(file.extraction.length);
    imageBytes.set(file.extraction);
    return [
      {
        name: file.fileHeader.name,
        blob: new Blob([imageBytes], {
          type: getImageType(file.fileHeader.name),
        }),
      },
    ];
  });

  return sortPages(pages);
}

export async function extractComicPages(
  fileType: string,
  archive: Blob,
): Promise<ArchivePage[]> {
  if (fileType === "CBZ") return extractCbz(archive);
  if (fileType === "CBR") return extractCbr(archive);
  throw new Error("Este formato não é um arquivo de quadrinhos compatível.");
}
