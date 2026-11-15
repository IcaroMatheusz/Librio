import { useRef } from "react";
import { ImagePlus, Layers3, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { BookVolume } from "../../services/volumesService";

interface VolumeCardProps {
  volume: BookVolume;
  deleting: boolean;
  coverBusy: boolean;
  onEditAuthor: () => void;
  onCoverSelect: (file: File) => void;
  onDelete: () => void;
}

export function VolumeCard({
  volume,
  deleting,
  coverBusy,
  onEditAuthor,
  onCoverSelect,
  onDelete,
}: VolumeCardProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverUrl = volume.chapters[0]?.book.cover_url;

  return (
    <article
      onContextMenu={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("button, input, label")
        ) {
          return;
        }
        event.preventDefault();
        onEditAuthor();
      }}
      className="group min-w-0 overflow-hidden rounded-2xl border border-violet-200/10 bg-[#202435] shadow-lg shadow-black/10 transition hover:-translate-y-1 hover:border-violet-300/30 hover:shadow-xl hover:shadow-violet-950/20"
    >
      <Link
        to={`/volume/${volume.id}`}
        state={{ returnTo: "/library" }}
        aria-label={`Abrir volume ${volume.title}`}
        className="block rounded-t-2xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-200"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-[#322b55] via-[#222638] to-[#171A27]">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Capa do volume ${volume.title}`}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <Layers3
                aria-hidden="true"
                size={42}
                strokeWidth={1.3}
                className="text-violet-200/70"
              />
              <span className="line-clamp-3 text-sm font-bold leading-5 text-slate-200/90">
                {volume.title}
              </span>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-lg border border-white/15 bg-[#171A27]/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm sm:text-xs">
            {volume.chapters.length} capítulos
          </span>
          <span
            aria-hidden="true"
            className="absolute bottom-3 right-3 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white opacity-0 backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100"
          >
            Ler volume
          </span>
        </div>
        <div className="p-3.5 sm:p-4">
          <h3 className="truncate text-sm font-bold text-white sm:text-base">
            {volume.title}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-400 sm:text-sm">
            {volume.author.trim() || "Autor não informado"}
          </p>
        </div>
      </Link>
      <footer className="space-y-2 border-t border-white/[0.07] px-3 py-2.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onEditAuthor}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-violet-200"
          >
            <Pencil aria-hidden="true" size={13} />
            Autor
          </button>
          <button
            type="button"
            disabled={coverBusy || volume.chapters.length === 0}
            onClick={() => coverInputRef.current?.click()}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus aria-hidden="true" size={14} />
            {coverBusy ? "Salvando..." : "Capa"}
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            aria-label={`Escolher capa para ${volume.title}`}
            className="hidden"
            disabled={coverBusy || volume.chapters.length === 0}
            onChange={(event) => {
              const selectedFile = event.target.files?.[0];
              if (selectedFile) onCoverSelect(selectedFile);
              event.target.value = "";
            }}
          />
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200/10 bg-rose-200/[0.03] px-2 text-xs font-semibold text-rose-200 transition hover:border-rose-200/25 hover:bg-rose-200/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200 disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" size={14} />
          {deleting ? "Excluindo volume..." : "Excluir volume"}
        </button>
      </footer>
    </article>
  );
}
