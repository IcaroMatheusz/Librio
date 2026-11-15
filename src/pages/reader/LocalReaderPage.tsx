import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ComicReader } from "../../components/reader/ComicReader";
import { EpubReader } from "../../components/reader/EpubReader";
import { PdfReader } from "../../components/reader/PdfReader";
import { ReaderLoading } from "../../components/reader/ReaderLoading";
import {
  getLocalBookById,
  getLocalBookFile,
} from "../../services/localBooksService";
import {
  getLocalBookProgress,
  saveLocalBookProgress,
} from "../../services/progressService";
import type { LocalBook } from "../../../shared/desktop";

interface LocalReaderDocument {
  book: LocalBook;
  file: Blob;
  progress: number;
}

export default function LocalReaderPage() {
  const { bookId } = useParams();
  const [document, setDocument] = useState<LocalReaderDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);

  const saveProgress = useCallback(
    async (progress: number) => {
      if (!bookId) return;
      await saveLocalBookProgress(bookId, progress);
    },
    [bookId],
  );

  useEffect(() => {
    let active = true;

    async function loadLocalDocument() {
      setLoading(true);
      setError(null);
      setProgressWarning(null);
      setDocument(null);

      try {
        if (!bookId) throw new Error("O endereço desta obra local é inválido.");
        const book = await getLocalBookById(bookId);
        const [fileResult, progressResult] = await Promise.allSettled([
          getLocalBookFile(bookId),
          getLocalBookProgress(bookId),
        ]);

        if (fileResult.status === "rejected") throw fileResult.reason;
        if (!active) return;

        const progress =
          progressResult.status === "fulfilled" ? progressResult.value : 0;
        if (progressResult.status === "rejected") {
          setProgressWarning(
            progressResult.reason instanceof Error
              ? progressResult.reason.message
              : "Não foi possível carregar o progresso da leitura.",
          );
        }

        setDocument({ book, file: fileResult.value, progress });
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível abrir esta obra local.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLocalDocument();
    return () => {
      active = false;
    };
  }, [bookId]);

  return (
    <main className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#111421] text-white">
      <header className="relative z-10 shrink-0 border-b border-white/[0.07] bg-[#171A27]/80 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-8 lg:px-12">
          <Link
            to="/library"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            <span className="hidden sm:inline">Biblioteca</span>
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-white/10" />
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-100/10 bg-emerald-100/[0.05] text-emerald-100">
            <BookOpen aria-hidden="true" size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold sm:text-base">
              {document?.book.title ?? "Leitor local"}
            </h1>
            {document && (
              <p className="truncate text-xs text-slate-400">
                Neste computador · {document.book.file_type.toUpperCase()}
              </p>
            )}
          </div>
        </nav>
      </header>

      <section
        aria-label="Conteúdo da obra local"
        className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-2 py-1 sm:px-6 sm:py-5 lg:px-8"
      >
        {progressWarning && !loading && (
          <p
            role="status"
            className="mb-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] px-4 py-2 text-xs leading-5 text-amber-100"
          >
            A obra está disponível localmente, mas o progresso não pôde ser
            sincronizado: {progressWarning}
          </p>
        )}
        {loading ? (
          <ReaderLoading
            title="Abrindo arquivo local"
            detail="Lendo o arquivo armazenado neste computador..."
            percent={null}
          />
        ) : error ? (
          <article className="m-auto max-w-lg rounded-2xl border border-rose-300/20 bg-rose-300/5 p-7 text-center">
            <p role="alert" className="text-sm leading-6 text-rose-200">
              {error}
            </p>
            <Link
              to="/library"
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
            >
              Voltar para a biblioteca
            </Link>
          </article>
        ) : document?.book.file_type === "pdf" ? (
          <PdfReader
            file={document.file}
            initialProgress={document.progress}
            onProgressChange={saveProgress}
          />
        ) : document?.book.file_type === "epub" ? (
          <EpubReader
            file={document.file}
            fallbackTitle={document.book.title}
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
