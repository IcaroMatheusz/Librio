import { BookOpen, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { Book } from "../types/database";

interface BookCardProps {
  book: Book;
  progress?: number;
  showFormat?: boolean;
  to?: string;
  onRename?: () => void;
  onDelete?: () => void;
}

export function BookCard({
  book,
  progress,
  showFormat = false,
  to,
  onRename,
  onDelete,
}: BookCardProps) {
  const content = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-[#322b55] via-[#222638] to-[#171A27]">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={`Capa de ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <BookOpen
              aria-hidden="true"
              size={42}
              strokeWidth={1.3}
              className="text-violet-200/70"
            />
            <span className="line-clamp-3 text-sm font-bold leading-5 text-slate-200/90">
              {book.title}
            </span>
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent"
        />
        {showFormat && (
          <span className="absolute left-3 top-3 rounded-lg border border-white/15 bg-[#171A27]/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm sm:text-xs">
            {book.file_type.toUpperCase()}
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white opacity-0 backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100"
        >
          Abrir obra
        </span>
      </div>
      <div className="p-3.5 sm:p-4">
        <h3
          className="truncate text-sm font-bold text-white sm:text-base"
          title={book.title}
        >
          {book.title}
        </h3>
        <p
          className="mt-1 truncate text-xs text-slate-400 sm:text-sm"
          title={book.author}
        >
          {book.author}
        </p>
        {progress !== undefined && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <div
              aria-label={`Progresso de leitura: ${progress}%`}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-violet-400"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#202435] shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-violet-300/30 hover:shadow-xl hover:shadow-violet-950/20">
      {to ? (
        <Link
          to={to}
          aria-label={`Abrir ${book.title}`}
          className="block rounded-t-2xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-200"
        >
          {content}
        </Link>
      ) : (
        content
      )}
      {onRename && onDelete && (
        <footer className="flex items-center gap-2 border-t border-white/[0.07] px-3 py-2.5">
          <button
            type="button"
            onClick={onRename}
            aria-label={`Renomear ${book.title}`}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-xs font-semibold text-slate-200 transition hover:border-violet-200/20 hover:bg-violet-200/[0.07] hover:text-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 sm:gap-2 sm:text-sm"
          >
            <Pencil aria-hidden="true" size={14} />
            Renomear
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Excluir ${book.title}`}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200/10 bg-rose-200/[0.03] px-2 text-xs font-semibold text-rose-200 transition hover:border-rose-200/25 hover:bg-rose-200/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200 sm:gap-2 sm:text-sm"
          >
            <Trash2 aria-hidden="true" size={14} />
            Excluir
          </button>
        </footer>
      )}
    </article>
  );
}
