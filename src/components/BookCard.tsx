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
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#202435] shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-violet-300/30 hover:shadow-xl hover:shadow-violet-950/20">
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
        <h3 className="truncate text-sm font-bold text-white sm:text-base" title={book.title}>
          {book.title}
        </h3>
        <p className="mt-1 truncate text-xs text-slate-400 sm:text-sm" title={book.author}>
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
