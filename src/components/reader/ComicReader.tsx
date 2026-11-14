import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  extractComicPages,
  type ArchivePage,
} from "../../services/archiveReaderService";

interface ComicReaderProps {
  fileType: string;
  file: Blob;
}

interface DisplayPage extends ArchivePage {
  url: string;
}

export function ComicReader({ fileType, file }: ComicReaderProps) {
  const [pages, setPages] = useState<DisplayPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrls: string[] = [];

    async function loadPages() {
      try {
        const extractedPages = await extractComicPages(fileType, file);
        objectUrls = extractedPages.map(({ blob }) =>
          URL.createObjectURL(blob),
        );
        if (active) {
          setPages(
            extractedPages.map((page, index) => ({
              ...page,
              url: objectUrls[index],
            })),
          );
          setPageIndex(0);
        }
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível abrir este arquivo de quadrinhos.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPages();
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file, fileType]);

  if (loading) {
    return (
      <p role="status" className="p-8 text-center text-slate-300">
        Preparando as páginas...
      </p>
    );
  }

  if (error || pages.length === 0) {
    return (
      <p role="alert" className="p-8 text-center text-rose-200">
        {error ?? "Este arquivo não contém páginas para exibir."}
      </p>
    );
  }

  const currentPage = pages[pageIndex];

  return (
    <section
      aria-label="Leitor de quadrinhos"
      className="flex min-h-[65dvh] flex-col items-center"
    >
      <div className="flex w-full items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
          disabled={pageIndex === 0}
          aria-label="Página anterior"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft aria-hidden="true" size={17} />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <p aria-live="polite" className="text-sm text-slate-300">
          Página {pageIndex + 1} de {pages.length}
        </p>
        <button
          type="button"
          onClick={() =>
            setPageIndex((index) => Math.min(pages.length - 1, index + 1))
          }
          disabled={pageIndex === pages.length - 1}
          aria-label="Próxima página"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="hidden sm:inline">Próxima</span>
          <ArrowRight aria-hidden="true" size={17} />
        </button>
      </div>

      <figure className="flex flex-1 items-center justify-center p-3 sm:p-6">
        <img
          src={currentPage.url}
          alt={`Página ${pageIndex + 1} de ${pages.length}`}
          className="max-h-[calc(100dvh-190px)] max-w-full object-contain"
        />
      </figure>
    </section>
  );
}
