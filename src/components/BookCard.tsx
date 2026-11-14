import { BookOpen } from "lucide-react";

import type { Book } from "../types/database";

interface BookCardProps {
  book: Book;
  progress?: number;
  showFormat?: boolean;
}

export function BookCard({
  book,
  progress,
  showFormat = false,
}: BookCardProps) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-violet-300/30 hover:bg-white/[0.07]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#222638]">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={`Capa de ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full items-center justify-center text-violet-200/70"
          >
            <BookOpen size={36} strokeWidth={1.5} />
          </div>
        )}
        {showFormat && (
          <span className="absolute left-3 top-3 rounded-lg border border-white/15 bg-[#171A27]/85 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            {book.file_type.toUpperCase()}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold text-white" title={book.title}>
          {book.title}
        </h3>
        <p className="mt-1 truncate text-sm text-slate-400" title={book.author}>
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
    </article>
  );
}
