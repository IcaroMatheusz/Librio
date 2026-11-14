import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { extractFirstComicPage } from "./archiveReaderService";

const MAX_PDF_COVER_DIMENSION = 1000;
const MAX_MANUAL_COVER_BYTES = 10 * 1024 * 1024;

async function optimizeCover(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(
      1,
      MAX_PDF_COVER_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Não foi possível preparar a imagem da capa.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Não foi possível otimizar a imagem da capa."));
      }, "image/jpeg", 0.82);
    });
  } finally {
    bitmap.close();
  }
}

async function createPdfCover(file: File): Promise<Blob> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });

  try {
    const document = await loadingTask.promise;
    const page = await document.getPage(1);
    const initialViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      1,
      MAX_PDF_COVER_DIMENSION /
        Math.max(initialViewport.width, initialViewport.height),
    );
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Não foi possível preparar a imagem da capa.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Não foi possível gerar a imagem da capa do PDF."));
      }, "image/jpeg", 0.85);
    });
  } finally {
    await loadingTask.destroy();
  }
}

export async function createBookCoverPreview(file: File): Promise<Blob> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return optimizeCover(await createPdfCover(file));
  if (extension === "cbr" || extension === "cbz") {
    const page = await extractFirstComicPage(extension.toUpperCase(), file);
    return optimizeCover(page.blob);
  }

  throw new Error("Não foi possível identificar o formato para gerar a capa.");
}

export async function prepareManualBookCover(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("A capa precisa ser um arquivo de imagem.");
  }
  if (file.size === 0 || file.size > MAX_MANUAL_COVER_BYTES) {
    throw new Error("A imagem da capa deve ter até 10 MB.");
  }

  try {
    return await optimizeCover(file);
  } catch (caughtError) {
    throw new Error(
      caughtError instanceof Error
        ? `Não foi possível preparar a capa: ${caughtError.message}`
        : "Não foi possível preparar a imagem da capa.",
      { cause: caughtError },
    );
  }
}
