import { BookOpen, BookPlus, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { BookCard } from "../BookCard";
import type { Book } from "../../types/database";

interface LibraryBooksContentProps {
  books: Book[];
  loading: boolean;
  error: string | null;
  coverBusyId: string | null;
  onRetry: () => void;
  onRename: (book: Book) => void;
  onDelete: (book: Book) => void;
  onCoverSelect: (book: Book, file: File) => void;
}

function LibraryLoadingState() {
  return (
    <div
      role="status"
      aria-label="Carregando sua biblioteca"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: 10 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#202435]"
        >
          <div className="aspect-[2/3] animate-pulse bg-white/[0.06]" />
          <div className="space-y-2 p-3.5">
            <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
      <span className="sr-only">Carregando sua biblioteca...</span>
    </div>
  );
}

function LibraryErrorState({
  error,
  onRetry,
}: Pick<LibraryBooksContentProps, "error" | "onRetry">) {
  return (
    <article
      role="alert"
      className="rounded-3xl border border-rose-300/20 bg-rose-300/[0.05] p-6 sm:p-8"
    >
      <p className="text-sm leading-6 text-rose-100">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200/20 px-4 py-2 text-sm font-bold text-rose-100 transition hover:bg-rose-200/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-100"
      >
        <RefreshCw aria-hidden="true" size={16} />
        Tentar novamente
      </button>
    </article>
  );
}

function LibraryEmptyState() {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-12 text-center sm:px-8 sm:py-16">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-violet-200/10 bg-violet-200/[0.06] text-violet-200">
        <BookOpen aria-hidden="true" size={27} />
      </span>
      <h3 className="mt-5 text-xl font-extrabold sm:text-2xl">
        Toda coleção começa com uma história
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        Adicione seu primeiro PDF ou quadrinho e deixe sua próxima leitura
        sempre à mão.
      </p>
      <Link
        to="/upload"
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <BookPlus aria-hidden="true" size={17} />
        Adicionar primeira obra
      </Link>
    </article>
  );
}

export function LibraryBooksContent({
  books,
  loading,
  error,
  coverBusyId,
  onRetry,
  onRename,
  onDelete,
  onCoverSelect,
}: LibraryBooksContentProps) {
  if (loading) return <LibraryLoadingState />;
  if (error) return <LibraryErrorState error={error} onRetry={onRetry} />;
  if (books.length === 0) return <LibraryEmptyState />;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          showFormat
          to={`/reader/${book.id}`}
          onRename={() => onRename(book)}
          onDelete={() => onDelete(book)}
          onCoverSelect={(file) => onCoverSelect(book, file)}
          coverBusy={coverBusyId === book.id}
          coverDisabled={coverBusyId !== null}
        />
      ))}
    </div>
  );
}
