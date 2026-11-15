import { useState } from "react";
import { BookOpen, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { Book } from "../types/database";

interface BookCardProps {
  book: Pick<Book, "id" | "title" | "author" | "cover_url" | "file_type">;
  progress?: number;
  showFormat?: boolean;
  sourceLabel?: string;
  statusMessage?: string;
  to?: string;
  returnTo?: "/dashboard" | "/library";
  onRename?: () => void;
  onDelete?: () => void;
  onRemoveLocal?: () => void;
  localRemoveDisabled?: boolean;
  onCoverSelect?: (file: File) => void;
  coverBusy?: boolean;
  coverDisabled?: boolean;
}

export function BookCard({
  book,
  progress,
  showFormat = false,
  sourceLabel,
  statusMessage,
  to,
  returnTo,
  onRename,
  onDelete,
  onRemoveLocal,
  localRemoveDisabled = false,
  onCoverSelect,
  coverBusy = false,
  coverDisabled = false,
}: BookCardProps) {
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const coverFailed = Boolean(
    book.cover_url && failedCoverUrl === book.cover_url,
  );

  const content = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-[#322b55] via-[#222638] to-[#171A27]">
        {book.cover_url && !coverFailed ? (
          <img
            src={book.cover_url}
            alt={`Capa de ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            onError={() => setFailedCoverUrl(book.cover_url)}
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
          <span className="absolute right-3 top-3 rounded-lg border border-white/15 bg-[#171A27]/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm sm:text-xs">
            {book.file_type.toUpperCase()}
          </span>
        )}
        {sourceLabel && (
          <span className="absolute left-3 top-3 rounded-lg border border-emerald-100/20 bg-emerald-950/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-100 shadow-sm backdrop-blur-sm sm:text-xs">
            {sourceLabel}
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
        {statusMessage && (
          <p role="status" className="mt-2 text-xs leading-5 text-amber-200">
            {statusMessage}
          </p>
        )}
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
          state={returnTo ? { returnTo } : undefined}
          aria-label={`Abrir ${sourceLabel ? "obra local " : ""}${book.title}`}
          className="block rounded-t-2xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-200"
        >
          {content}
        </Link>
      ) : (
        content
      )}
      {(onRename || onDelete || onCoverSelect || onRemoveLocal) && (
        <footer className="grid grid-cols-2 items-center gap-1.5 border-t border-white/[0.07] px-2 py-2.5 sm:gap-2 sm:px-3">
          {onCoverSelect && (
            <label className="col-span-2 inline-flex min-h-9 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] font-semibold text-slate-200 transition hover:border-violet-200/20 hover:bg-violet-200/[0.07] hover:text-violet-100 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-200 sm:gap-1.5 sm:text-xs">
              <input
                type="file"
                accept="image/*"
                aria-label={`Selecionar capa para ${book.title}`}
                disabled={coverBusy || coverDisabled}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onCoverSelect(file);
                  event.target.value = "";
                }}
              />
              <ImagePlus aria-hidden="true" size={14} />
              <span>{coverBusy ? "Salvando" : "Capa"}</span>
            </label>
          )}
          {onRemoveLocal && (
            <button
              type="button"
              onClick={onRemoveLocal}
              disabled={localRemoveDisabled}
              aria-label={`Remover ${book.title} da biblioteca local; o arquivo original será mantido`}
              title="O arquivo original será mantido"
              className="col-span-2 inline-flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] font-semibold text-slate-200 transition hover:border-rose-200/20 hover:bg-rose-200/[0.07] hover:text-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 disabled:cursor-wait disabled:opacity-50 sm:gap-1.5 sm:text-xs"
            >
              <Trash2 aria-hidden="true" size={14} />
              Remover da lista
            </button>
          )}
          <button
            type="button"
            disabled={!onRename}
            onClick={onRename}
            aria-label={`Renomear ${book.title}`}
            className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-1 text-[10px] font-semibold text-slate-200 transition hover:border-violet-200/20 hover:bg-violet-200/[0.07] hover:text-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 disabled:hidden sm:gap-1.5 sm:px-2 sm:text-xs"
          >
            <Pencil aria-hidden="true" size={14} className="shrink-0" />
            <span className="hidden sm:inline">Renomear</span>
          </button>
          <button
            type="button"
            disabled={!onDelete}
            onClick={onDelete}
            aria-label={`Excluir ${book.title}`}
            className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-rose-200/10 bg-rose-200/[0.03] px-1 text-[10px] font-semibold text-rose-200 transition hover:border-rose-200/25 hover:bg-rose-200/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200 disabled:hidden sm:gap-1.5 sm:px-2 sm:text-xs"
          >
            <Trash2 aria-hidden="true" size={14} className="shrink-0" />
            <span className="hidden sm:inline">Excluir</span>
          </button>
        </footer>
      )}
    </article>
  );
}
