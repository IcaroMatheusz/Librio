import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  CircleAlert,
  Download,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

import type { DesktopUpdateStatus } from "../../shared/desktop";

interface DesktopUpdateContextValue {
  status: DesktopUpdateStatus;
  dialogOpen: boolean;
  version: string;
  checkForUpdates: () => Promise<void>;
  closeDialog: () => void;
  installUpdate: () => Promise<void>;
}

const DesktopUpdateContext = createContext<DesktopUpdateContextValue | null>(null);

const INITIAL_STATUS: DesktopUpdateStatus = {
  status: "idle",
  currentVersion: __LIBRIO_VERSION__,
};

export function DesktopUpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const desktop = window.librioDesktop;

  useEffect(() => {
    if (!desktop) return;
    let active = true;
    let receivedUpdateEvent = false;
    const unsubscribe = desktop.onUpdateStatus((nextStatus) => {
      if (!active) return;
      receivedUpdateEvent = true;
      setStatus(nextStatus);
      if (nextStatus.status === "downloaded") setDialogOpen(true);
    });

    void desktop
      .getUpdateStatus()
      .then((initialStatus) => {
        if (!active || receivedUpdateEvent) return;
        setStatus(initialStatus);
        if (initialStatus.status === "downloaded") setDialogOpen(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus({
          status: "error",
          currentVersion: __LIBRIO_VERSION__,
          message:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar o estado das atualizacoes.",
        });
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [desktop]);

  const checkForUpdates = useCallback(async () => {
    if (!desktop) return;
    setDialogOpen(true);
    setActionError(null);
    if (["available", "downloading", "downloaded"].includes(status.status)) {
      return;
    }
    setStatus((current) => ({ ...current, status: "checking", message: undefined }));
    try {
      const nextStatus = await desktop.checkForUpdates();
      setStatus((current) =>
        current.status === "checking" ? nextStatus : current,
      );
    } catch (error) {
      setStatus({
        status: "error",
        currentVersion: status.currentVersion,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel verificar atualizacoes.",
      });
    }
  }, [desktop, status.currentVersion, status.status]);

  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const installUpdate = useCallback(async () => {
    if (!desktop) return;
    setActionError(null);
    try {
      await desktop.installUpdate();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar a instalacao.",
      );
    }
  }, [desktop]);

  const version = status.currentVersion || __LIBRIO_VERSION__;
  const value = useMemo(
    () => ({ status, dialogOpen, version, checkForUpdates, closeDialog, installUpdate }),
    [status, dialogOpen, version, checkForUpdates, closeDialog, installUpdate],
  );

  return (
    <DesktopUpdateContext.Provider value={value}>
      {children}
      {dialogOpen && (
        <UpdateDialog
          status={status}
          actionError={actionError}
          onCheck={() => void checkForUpdates()}
          onClose={closeDialog}
          onInstall={() => void installUpdate()}
        />
      )}
    </DesktopUpdateContext.Provider>
  );
}

export function useDesktopUpdates(): DesktopUpdateContextValue {
  const context = useContext(DesktopUpdateContext);
  if (!context) {
    throw new Error("useDesktopUpdates precisa estar dentro de DesktopUpdateProvider.");
  }
  return context;
}

function UpdateDialog({
  status,
  actionError,
  onCheck,
  onClose,
  onInstall,
}: {
  status: DesktopUpdateStatus;
  actionError: string | null;
  onCheck: () => void;
  onClose: () => void;
  onInstall: () => void;
}) {
  const checking = status.status === "checking" || status.status === "idle";
  const downloading = status.status === "downloading";
  const upToDate = status.status === "up-to-date";
  const downloaded = status.status === "downloaded";
  const error = status.status === "error";
  const unsupported = status.status === "unsupported";
  const title = checking
    ? "Procurando novidades"
    : upToDate
      ? "Seu Librio está atualizado"
      : downloaded
        ? "Atualização pronta para instalar"
        : error
          ? "Não foi possível verificar agora"
          : unsupported
            ? "Verificação disponível no app instalado"
            : "Uma nova versão está chegando";
  const description = checking
    ? "Estamos consultando a versão mais recente do Librio."
    : upToDate
      ? `Você já está usando a versão ${status.currentVersion}. Boas leituras!`
      : downloaded
        ? `A versão ${status.nextVersion ?? "mais recente"} foi baixada e está pronta.`
        : downloading
          ? `Baixando a versão ${status.nextVersion ?? "mais recente"} em segundo plano.`
          : status.message ??
            (unsupported
              ? "A verificação funciona depois de instalar o Librio Desktop."
              : "Confira sua conexão e tente verificar novamente em instantes.");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#090b13]/75 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-update-title"
        className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#1c2030] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.55)] sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-violet-500/20 blur-3xl"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar verificação de atualizações"
          className="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-200"
        >
          <X aria-hidden="true" size={17} />
        </button>

        <div className="relative">
          <span
            className={`flex size-14 items-center justify-center rounded-2xl border ${error ? "border-rose-200/15 bg-rose-200/10 text-rose-200" : "border-violet-200/15 bg-violet-300/10 text-violet-100"}`}
          >
            {checking || downloading ? (
              <LoaderCircle aria-hidden="true" size={25} className="animate-spin" />
            ) : error ? (
              <CircleAlert aria-hidden="true" size={25} />
            ) : upToDate || downloaded ? (
              <BadgeCheck aria-hidden="true" size={27} />
            ) : (
              <Sparkles aria-hidden="true" size={25} />
            )}
          </span>

          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">
            Atualizações Librio
          </p>
          <h2
            id="desktop-update-title"
            className="mt-2 max-w-sm text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
          >
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>

          {downloading && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Download em andamento</span>
                <span>{status.percent ?? 0}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Progresso do download da atualização"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.percent ?? 0}
                className="h-2 overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-300 to-fuchsia-300 transition-[width] duration-300"
                  style={{ width: `${status.percent ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {(error || unsupported) && status.message && (
            <p className="mt-4 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs leading-5 text-slate-400">
              {status.message}
            </p>
          )}
          {actionError && (
            <p role="alert" className="mt-4 text-xs leading-5 text-rose-200">
              {actionError}
            </p>
          )}

          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {downloaded ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-violet-200"
                >
                  Mais tarde
                </button>
                <button
                  type="button"
                  onClick={onInstall}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-300 px-4 text-sm font-bold text-[#211a35] transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
                >
                  <RefreshCw aria-hidden="true" size={16} />
                  Reiniciar e atualizar
                </button>
              </>
            ) : upToDate || error || unsupported ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-violet-200"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={onCheck}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-300 px-4 text-sm font-bold text-[#211a35] transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
                >
                  {error ? <RefreshCw aria-hidden="true" size={16} /> : <Download aria-hidden="true" size={16} />}
                  {upToDate ? "Verificar novamente" : "Tentar novamente"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-violet-200"
              >
                Continuar usando o Librio
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
