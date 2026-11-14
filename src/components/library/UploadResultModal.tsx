import { useState } from "react";
import { CircleCheck, CircleX, LoaderCircle, X } from "lucide-react";

interface UploadResultModalProps {
  type: "progress" | "success" | "error";
  message: string;
  progress?: {
    percent: number | null;
    stage: string;
  };
  coverUrl?: string | null;
  coverUnavailable?: boolean;
  coverError?: string;
  onClose?: () => void;
  onLibraryClick?: () => void;
}

export function UploadResultModal({
  type,
  message,
  progress,
  coverUrl,
  coverUnavailable,
  coverError,
  onClose,
  onLibraryClick,
}: UploadResultModalProps) {
  const isSuccess = type === "success";
  const isProgress = type === "progress";
  const [coverLoading, setCoverLoading] = useState(Boolean(coverUrl));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (!isProgress && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-result-title"
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#222638] p-6 text-center shadow-2xl shadow-black/40 sm:p-8"
      >
        {!isProgress && (
          <button
            type="button"
            aria-label="Fechar mensagem"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200"
          >
            <X aria-hidden="true" size={18} />
          </button>
        )}

        <span
          aria-hidden="true"
          className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
            isProgress
              ? "bg-violet-300/10 text-violet-200"
              : isSuccess
                ? "bg-emerald-300/10 text-emerald-200"
                : "bg-rose-300/10 text-rose-200"
          }`}
        >
          {isProgress ? (
            <LoaderCircle className="animate-spin" size={29} />
          ) : isSuccess ? (
            <CircleCheck size={29} />
          ) : (
            <CircleX size={29} />
          )}
        </span>
        <h2
          id="upload-result-title"
          className="mt-5 text-xl font-bold text-white"
        >
          {isProgress
            ? "Preparando a capa"
            : isSuccess
              ? "Obra enviada!"
              : "Não foi possível enviar"}
        </h2>
        <p
          role={isSuccess || isProgress ? "status" : "alert"}
          className="mt-2 text-sm leading-6 text-slate-300"
        >
          {message}
        </p>

        {isProgress && progress && (
          <section aria-live="polite" className="mt-6 text-left">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <p className="text-slate-300">{progress.stage}</p>
              {progress.percent !== null && (
                <p className="tabular-nums text-violet-200">
                  {progress.percent}%
                </p>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Progresso da preparação da capa"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent ?? undefined}
              className="h-2 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={`h-full rounded-full bg-violet-400 transition-[width] duration-300 ${
                  progress.percent === null ? "w-2/5 animate-pulse" : ""
                }`}
                style={
                  progress.percent === null
                    ? undefined
                    : { width: `${progress.percent}%` }
                }
              />
            </div>
          </section>
        )}

        {isSuccess && coverUrl && (
          <figure className="mx-auto mt-5 w-fit overflow-hidden rounded-xl border border-white/10 bg-[#171A27] p-1.5 shadow-lg shadow-black/20">
            {coverLoading && (
              <div
                role="progressbar"
                aria-label="Carregando a prévia da capa"
                className="h-1 w-full animate-pulse rounded-full bg-violet-300"
              />
            )}
            <img
              src={coverUrl}
              alt="Prévia da capa da obra enviada"
              onLoad={() => setCoverLoading(false)}
              onError={() => setCoverLoading(false)}
              className={`max-h-56 max-w-full rounded-lg object-contain ${
                coverLoading ? "hidden" : ""
              }`}
            />
            <figcaption className="sr-only">Capa da obra enviada</figcaption>
          </figure>
        )}
        {isSuccess && coverUnavailable && (
          <p className="mt-4 rounded-xl border border-amber-200/10 bg-amber-200/[0.05] px-3 py-2 text-left text-xs leading-5 text-amber-100/80">
            A obra foi enviada, mas não foi possível gerar a prévia da capa.
            {coverError
              ? ` ${coverError}`
              : " Você ainda pode abrir o arquivo normalmente."}
          </p>
        )}

        {!isProgress && (
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
        )}
      </section>
    </div>
  );
}
