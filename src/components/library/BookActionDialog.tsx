import { Check, Pencil, Trash2, X } from "lucide-react";
import type { ChangeEventHandler, FormEventHandler } from "react";

import type { Book } from "../../types/database";

export interface BookActionDialogState {
  type: "rename" | "author" | "delete";
  book: Book;
}

interface BookActionDialogProps {
  dialog: BookActionDialogState;
  titleDraft: string;
  authorDraft: string;
  actionError: string | null;
  actionBusy: boolean;
  onTitleChange: ChangeEventHandler<HTMLInputElement>;
  onRename: FormEventHandler<HTMLFormElement>;
  onAuthorChange: ChangeEventHandler<HTMLInputElement>;
  onUpdateAuthor: FormEventHandler<HTMLFormElement>;
  onDelete: () => void;
  onClose: () => void;
}

export function BookActionDialog({
  dialog,
  titleDraft,
  authorDraft,
  actionError,
  actionBusy,
  onTitleChange,
  onRename,
  onAuthorChange,
  onUpdateAuthor,
  onDelete,
  onClose,
}: BookActionDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !actionBusy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-action-title"
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#222638] p-6 shadow-2xl shadow-black/40 sm:p-8"
      >
        <button
          type="button"
          aria-label="Fechar"
          disabled={actionBusy}
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 disabled:opacity-50"
        >
          <X aria-hidden="true" size={18} />
        </button>

        {dialog.type !== "delete" ? (
          <form onSubmit={dialog.type === "rename" ? onRename : onUpdateAuthor}>
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-violet-300/10 text-violet-200">
              <Pencil aria-hidden="true" size={22} />
            </span>
            <h2
              id="book-action-title"
              className="mt-4 text-xl font-bold text-white"
            >
              {dialog.type === "rename" ? "Renomear obra" : "Editar autor"}
            </h2>
            <label
              htmlFor={dialog.type === "rename" ? "book-new-title" : "book-new-author"}
              className="mt-5 block text-sm font-semibold text-slate-200"
            >
              {dialog.type === "rename" ? "Novo título" : "Autor"}
            </label>
            <input
              id={dialog.type === "rename" ? "book-new-title" : "book-new-author"}
              autoFocus
              required={dialog.type === "rename"}
              maxLength={dialog.type === "rename" ? 200 : 160}
              disabled={actionBusy}
              value={dialog.type === "rename" ? titleDraft : authorDraft}
              onChange={dialog.type === "rename" ? onTitleChange : onAuthorChange}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#171A27] px-4 py-3 text-white outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10 disabled:opacity-60"
            />
            {actionError && (
              <p role="alert" className="mt-3 text-sm text-rose-200">
                {actionError}
              </p>
            )}
            <footer className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={actionBusy}
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  actionBusy ||
                  (dialog.type === "rename" && !titleDraft.trim())
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
              >
                <Check aria-hidden="true" size={17} />
                {actionBusy
                  ? "Salvando..."
                  : dialog.type === "rename"
                    ? "Salvar título"
                    : "Salvar autor"}
              </button>
            </footer>
          </form>
        ) : (
          <>
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-rose-300/10 text-rose-200">
              <Trash2 aria-hidden="true" size={22} />
            </span>
            <h2
              id="book-action-title"
              className="mt-4 text-xl font-bold text-white"
            >
              Excluir esta obra?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              <span className="font-semibold text-white">{dialog.book.title}</span>{" "}
              e o arquivo armazenado serão removidos da sua biblioteca. Esta ação
              não pode ser desfeita.
            </p>
            {actionError && (
              <p role="alert" className="mt-3 text-sm text-rose-200">
                {actionError}
              </p>
            )}
            <footer className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={actionBusy}
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 disabled:opacity-50"
              >
                Manter obra
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={onDelete}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-400 px-5 py-3 text-sm font-bold text-[#271719] transition hover:bg-rose-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
              >
                <Trash2 aria-hidden="true" size={17} />
                {actionBusy ? "Excluindo..." : "Excluir obra"}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
