import { useEffect, useState } from "react";
import { ArrowLeft, BookPlus } from "lucide-react";
import { Link } from "react-router-dom";

import { BookCard } from "../../components/BookCard";
import { getBooks } from "../../services/booksService";
import type { Book } from "../../types/database";

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBooks() {
      try {
        const result = await getBooks();
        if (active) setBooks(result);
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível carregar sua biblioteca.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBooks();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#171A27] text-white">
      <header className="border-b border-white/10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Painel
          </Link>
          <Link
            to="/upload"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-2 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <BookPlus aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Adicionar obra</span>
            <span className="sm:hidden">Adicionar</span>
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        <section aria-labelledby="library-title">
          <header className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
              Suas histórias
            </p>
            <h1
              id="library-title"
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Minha biblioteca
            </h1>
          </header>

          {loading ? (
            <p role="status" className="py-12 text-center text-slate-300">
              Carregando sua biblioteca...
            </p>
          ) : error ? (
            <p
              role="alert"
              className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-5 text-sm text-rose-200"
            >
              {error}
            </p>
          ) : books.length === 0 ? (
            <article className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-14 text-center">
              <BookPlus
                aria-hidden="true"
                size={32}
                className="mx-auto text-violet-200"
              />
              <h2 className="mt-4 text-xl font-bold">
                Sua biblioteca está vazia
              </h2>
              <p className="mt-2 text-slate-400">
                Envie um PDF, CBR ou CBZ para começar sua coleção.
              </p>
              <Link
                to="/upload"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-400 px-5 py-3 font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Adicionar primeira obra
              </Link>
            </article>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {books.map((book) => (
                <Link
                  key={book.id}
                  to={`/reader/${book.id}`}
                  aria-label={`Abrir ${book.title}`}
                  className="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
                >
                  <BookCard book={book} showFormat />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
