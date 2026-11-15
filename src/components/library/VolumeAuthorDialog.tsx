import { Check, Pencil, X } from "lucide-react";
import type { FormEventHandler } from "react";

interface VolumeAuthorDialogProps {
  volumeTitle: string;
  author: string;
  busy: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onClose: () => void;
}

export function VolumeAuthorDialog({
  volumeTitle,
  author,
  busy,
  error,
  onChange,
  onSubmit,
  onClose,
}: VolumeAuthorDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="volume-author-title"
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#222638] p-6 shadow-2xl shadow-black/40 sm:p-8"
      >
        <button
          type="button"
          aria-label="Fechar"
          disabled={busy}
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-50"
        >
          <X aria-hidden="true" size={18} />
        </button>
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-violet-300/10 text-violet-200">
          <Pencil aria-hidden="true" size={22} />
        </span>
        <h2 id="volume-author-title" className="mt-4 text-xl font-bold text-white">
          Editar autor do volume
        </h2>
        <p className="mt-1 truncate text-sm text-slate-400">{volumeTitle}</p>
        <label
          htmlFor="volume-new-author"
          className="mt-5 block text-sm font-semibold text-slate-200"
        >
          Autor (opcional)
        </label>
        <input
          id="volume-new-author"
          autoFocus
          maxLength={160}
          disabled={busy}
          value={author}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Deixe em branco se não quiser informar"
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#171A27] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10 disabled:opacity-60"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-200">
            {error}
          </p>
        )}
        <footer className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
          >
            <Check aria-hidden="true" size={17} />
            {busy ? "Salvando..." : "Salvar autor"}
          </button>
        </footer>
      </form>
    </div>
  );
}
