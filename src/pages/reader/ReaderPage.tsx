import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ComicReader } from "../../components/reader/ComicReader";
import { getBookById, getBookFile } from "../../services/booksService";
import type { Book } from "../../types/database";

interface ReaderDocument {
  book: Book;
  file: Blob;
  pdfUrl: string | null;
}

export default function ReaderPage() {
  const { bookId } = useParams();
  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let pdfUrl: string | null = null;

    async function loadDocument() {
      try {
        if (!bookId) throw new Error("O endereço desta obra é inválido.");
        const book = await getBookById(bookId);
        if (!["PDF", "CBR", "CBZ"].includes(book.file_type.toUpperCase())) {
          throw new Error("Este leitor aceita arquivos PDF, CBR e CBZ.");
        }

        const file = await getBookFile(book.file_path);
        if (book.file_type.toUpperCase() === "PDF") {
          pdfUrl = URL.createObjectURL(file);
        }
        if (active) setDocument({ book, file, pdfUrl });
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
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [bookId]);

  return (
    <main className="flex min-h-screen flex-col bg-[#171A27] text-white">
      <header className="border-b border-white/10">
        <nav className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-4 sm:px-8 lg:px-12">
          <Link
            to="/library"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            <span className="hidden sm:inline">Biblioteca</span>
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-white/10" />
          <BookOpen
            aria-hidden="true"
            size={18}
            className="shrink-0 text-violet-200"
          />
          <h1 className="truncate font-semibold">
            {document?.book.title ?? "Leitor"}
          </h1>
        </nav>
      </header>

      <section
        aria-label="Conteúdo da obra"
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-2 py-3 sm:px-6 sm:py-5"
      >
        {loading ? (
          <p role="status" className="m-auto p-8 text-slate-300">
            Abrindo sua obra...
          </p>
        ) : error ? (
          <article className="m-auto max-w-lg rounded-2xl border border-rose-300/20 bg-rose-300/5 p-7 text-center">
            <p role="alert" className="text-sm leading-6 text-rose-200">
              {error}
            </p>
            <Link
              to="/library"
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
            >
              Voltar à biblioteca
            </Link>
          </article>
        ) : document?.book.file_type.toUpperCase() === "PDF" &&
          document.pdfUrl ? (
          <iframe
            title={`Leitor de ${document.book.title}`}
            src={document.pdfUrl}
            className="min-h-[75dvh] w-full flex-1 rounded-xl border border-white/10 bg-white"
          />
        ) : document ? (
          <ComicReader
            fileType={document.book.file_type.toUpperCase()}
            file={document.file}
          />
        ) : null}
      </section>
    </main>
  );
}
