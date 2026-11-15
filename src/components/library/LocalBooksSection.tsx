import { FolderOpen, Plus, RefreshCw } from "lucide-react";

import { BookCard } from "../BookCard";
import type { LocalBook } from "../../../shared/desktop";

interface LocalBooksSectionProps {
  books: LocalBook[];
  progressByBookId: Map<string, number>;
  loading: boolean;
  busy: boolean;
  error: string | null;
  progressError: string | null;
  coverBusyId: string | null;
  onAdd: () => void;
  onRemove: (book: LocalBook) => void;
  onCoverSelect: (book: LocalBook, file: File) => void;
  onRetry: () => void;
}

export function LocalBooksSection({
  books,
  progressByBookId,
  loading,
  busy,
  error,
  progressError,
  coverBusyId,
  onAdd,
  onRemove,
  onCoverSelect,
  onRetry,
}: LocalBooksSectionProps) {
  return (
    <section
      aria-labelledby="local-books-title"
      className="mb-10 rounded-3xl border border-emerald-100/10 bg-emerald-100/[0.025] p-4 sm:p-6"
    >
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200 sm:text-sm">
            Somente neste computador
          </p>
          <h2
            id="local-books-title"
            className="mt-1.5 text-xl font-extrabold tracking-tight sm:text-2xl"
          >
            Obras locais
          </h2>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-400 sm:text-sm">
            Os arquivos permanecem nos locais originais e não são enviados à
            nuvem.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-100/15 bg-emerald-100/[0.06] px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:border-emerald-100/30 hover:bg-emerald-100/[0.1] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-emerald-200 disabled:cursor-wait disabled:opacity-60 sm:text-sm"
        >
          <Plus aria-hidden="true" size={16} />
          {busy ? "Aguarde..." : "Adicionar arquivos"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/15 bg-rose-200/[0.05] px-4 py-3"
        >
          <p className="text-sm leading-5 text-rose-100">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-bold text-rose-100 hover:bg-rose-200/10 focus-visible:outline-2 focus-visible:outline-rose-100"
          >
            <RefreshCw aria-hidden="true" size={14} />
            Tentar novamente
          </button>
        </div>
      )}
      {progressError && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] px-4 py-3 text-xs leading-5 text-amber-100"
        >
          {progressError}
        </p>
      )}

      {loading ? (
        <p role="status" className="py-5 text-center text-sm text-slate-400">
          Carregando arquivos locais...
        </p>
      ) : error && books.length === 0 ? null : books.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
          <FolderOpen
            aria-hidden="true"
            size={24}
            className="mx-auto text-emerald-200/70"
          />
          <p className="mt-3 text-sm font-semibold text-slate-200">
            Nenhum arquivo local adicionado
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Escolha PDFs, EPUBs, CBRs ou CBZs do seu computador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              progress={progressByBookId.get(book.id)}
              showFormat
              sourceLabel="Neste PC"
              onCoverSelect={(file) => onCoverSelect(book, file)}
              coverBusy={coverBusyId === book.id}
              coverDisabled={busy || !book.available}
              statusMessage={
                book.available
                  ? undefined
                  : "Arquivo não encontrado. Remova e adicione novamente."
              }
              to={book.available ? `/local-reader/${book.id}` : undefined}
              onRemoveLocal={() => onRemove(book)}
              localRemoveDisabled={busy}
            />
          ))}
        </div>
      )}
    </section>
  );
}
