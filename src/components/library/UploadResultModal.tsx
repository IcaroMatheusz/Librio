import { CircleCheck, CircleX, X } from "lucide-react";

interface UploadResultModalProps {
  type: "success" | "error";
  message: string;
  coverUrl?: string | null;
  coverUnavailable?: boolean;
  onClose: () => void;
  onLibraryClick?: () => void;
}

export function UploadResultModal({
  type,
  message,
  coverUrl,
  coverUnavailable,
  onClose,
  onLibraryClick,
}: UploadResultModalProps) {
  const isSuccess = type === "success";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-result-title"
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#222638] p-6 text-center shadow-2xl shadow-black/40 sm:p-8"
      >
        <button
          type="button"
          aria-label="Fechar mensagem"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200"
        >
          <X aria-hidden="true" size={18} />
        </button>

        <span
          aria-hidden="true"
          className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
            isSuccess
              ? "bg-emerald-300/10 text-emerald-200"
              : "bg-rose-300/10 text-rose-200"
          }`}
        >
          {isSuccess ? <CircleCheck size={29} /> : <CircleX size={29} />}
        </span>
        <h2
          id="upload-result-title"
          className="mt-5 text-xl font-bold text-white"
        >
          {isSuccess ? "Obra enviada!" : "Não foi possível enviar"}
        </h2>
        <p
          role={isSuccess ? "status" : "alert"}
          className="mt-2 text-sm leading-6 text-slate-300"
        >
          {message}
        </p>

        {isSuccess && coverUrl && (
          <figure className="mx-auto mt-5 w-fit overflow-hidden rounded-xl border border-white/10 bg-[#171A27] p-1.5 shadow-lg shadow-black/20">
            <img
              src={coverUrl}
              alt="Prévia da capa da obra enviada"
              className="max-h-56 max-w-full rounded-lg object-contain"
            />
            <figcaption className="sr-only">Capa da obra enviada</figcaption>
          </figure>
        )}
        {isSuccess && coverUnavailable && (
          <p className="mt-4 rounded-xl border border-amber-200/10 bg-amber-200/[0.05] px-3 py-2 text-left text-xs leading-5 text-amber-100/80">
            A obra foi enviada, mas não foi possível gerar a prévia da capa.
            Você ainda pode abrir o arquivo normalmente.
          </p>
        )}

        <footer className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          {!isSuccess && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
            >
              Voltar ao formulário
            </button>
          )}
          {isSuccess && onLibraryClick ? (
            <button
              type="button"
              onClick={onLibraryClick}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Ir para a biblioteca
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Entendi
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
