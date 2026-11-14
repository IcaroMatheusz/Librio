import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { ComicReader } from "../../components/reader/ComicReader";
import { EpubReader } from "../../components/reader/EpubReader";
import { PdfReader } from "../../components/reader/PdfReader";
import { ReaderLoading } from "../../components/reader/ReaderLoading";
import { getBookById, getBookFile } from "../../services/booksService";
import {
  getBookProgress,
  saveBookProgress,
} from "../../services/progressService";
import { formatBytes } from "../../utils/formatBytes";
import type { Book } from "../../types/database";

interface ReaderDocument {
  book: Book;
  file: Blob;
  progress: number;
}

export default function ReaderPage() {
  const { bookId } = useParams();
  const location = useLocation();
  const locationState: unknown = location.state;
  const returnTo =
    typeof locationState === "object" &&
    locationState !== null &&
    "returnTo" in locationState &&
    (locationState.returnTo === "/dashboard" ||
      locationState.returnTo === "/library")
      ? locationState.returnTo
      : "/library";
  const returnLabel = returnTo === "/dashboard" ? "Painel" : "Biblioteca";
  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadDetail, setLoadDetail] = useState("Conectando à sua biblioteca segura…");

  const saveProgress = useCallback(
    async (progress: number) => {
      if (!bookId) return;
      await saveBookProgress(bookId, progress);
    },
    [bookId],
  );

  useEffect(() => {
    let active = true;

    async function loadDocument() {
      setLoading(true);
      setError(null);
      setDocument(null);
      setLoadProgress(0);
      setLoadDetail("Conectando à sua biblioteca segura…");
      try {
        if (!bookId) throw new Error("O endereço desta obra é inválido.");
        const book = await getBookById(bookId);
        if (!["PDF", "EPUB", "CBR", "CBZ"].includes(book.file_type.toUpperCase())) {
          throw new Error("Este leitor aceita arquivos PDF, EPUB, CBR e CBZ.");
        }

        setLoadDetail(`Baixando arquivo ${book.file_type.toUpperCase()}…`);
        const [file, progress] = await Promise.all([
          getBookFile(book.file_path, book.file_size, (progress) => {
            if (!active) return;
            setLoadProgress(progress.percent);
            setLoadDetail(
              `Baixando arquivo: ${formatBytes(progress.loadedBytes)} de ${formatBytes(progress.totalBytes)}.`,
            );
          }),
          getBookProgress(book.id),
        ]);
        if (active) {
          setLoadProgress(100);
          setLoadDetail("Download concluído. Preparando o leitor…");
        }
        if (active) setDocument({ book, file, progress });
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível abrir esta obra.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDocument();
    return () => {
      active = false;
    };
  }, [bookId]);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#111421] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-52 top-24 size-[34rem] rounded-full bg-violet-600/[0.08] blur-3xl"
      />
      <header className="relative z-10 border-b border-white/[0.07] bg-[#171A27]/80 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-8 lg:px-12">
          <Link
            to={returnTo}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            <span className="hidden sm:inline">{returnLabel}</span>
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-white/10" />
          {document?.book.cover_url ? (
            <img
              src={document.book.cover_url}
              alt=""
              className="size-10 shrink-0 rounded-lg border border-white/10 object-cover shadow-md"
            />
          ) : (
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-violet-200/10 bg-violet-200/[0.06] text-violet-200">
              <BookOpen aria-hidden="true" size={18} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold sm:text-base">
              {document?.book.title ?? "Leitor"}
            </h1>
            {document && (
              <p className="truncate text-xs text-slate-400">
                {document.book.author} · {document.book.file_type.toUpperCase()}
              </p>
            )}
          </div>
        </nav>
      </header>

      <section
        aria-label="Conteúdo da obra"
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-2 py-3 sm:px-6 sm:py-5 lg:px-8"
      >
        {loading ? (
          <ReaderLoading
            title="Abrindo sua obra"
            detail={loadDetail}
            percent={loadProgress}
          />
        ) : error ? (
          <article className="m-auto max-w-lg rounded-2xl border border-rose-300/20 bg-rose-300/5 p-7 text-center">
            <p role="alert" className="text-sm leading-6 text-rose-200">
              {error}
            </p>
            <Link
              to={returnTo}
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
            >
              Voltar para {returnLabel.toLowerCase()}
            </Link>
          </article>
        ) : document?.book.file_type.toUpperCase() === "PDF" ? (
          <PdfReader
            file={document.file}
            initialProgress={document.progress}
            onProgressChange={saveProgress}
          />
        ) : document?.book.file_type.toUpperCase() === "EPUB" ? (
          <EpubReader
            file={document.file}
            initialProgress={document.progress}
            onProgressChange={saveProgress}
          />
        ) : document ? (
          <ComicReader
            fileType={document.book.file_type.toUpperCase()}
            file={document.file}
            initialProgress={document.progress}
            onProgressChange={saveProgress}
          />
        ) : null}
      </section>
    </main>
  );
}
