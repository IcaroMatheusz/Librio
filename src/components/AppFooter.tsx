import { RefreshCw } from "lucide-react";

import { useDesktopUpdates } from "../contexts/DesktopUpdateContext";
import { isDesktopApp } from "../services/localBooksService";

interface AppFooterProps {
  className?: string;
}

export function AppFooter({ className = "" }: AppFooterProps) {
  const desktopApp = isDesktopApp();
  const { version, checkForUpdates, status } = useDesktopUpdates();

  return (
    <footer
      className={`flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-center text-xs text-slate-500 sm:flex-row sm:text-left ${className}`}
    >
      <p>Librio v{version} — sua próxima leitura começa aqui.</p>
      {desktopApp && (
        <button
          type="button"
          onClick={() => void checkForUpdates()}
          disabled={status.status === "checking" || status.status === "downloading"}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 font-semibold text-violet-200 transition hover:bg-violet-300/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw
            aria-hidden="true"
            size={14}
            className={status.status === "checking" ? "animate-spin" : ""}
          />
          {status.status === "checking" ? "Verificando..." : "Verificar atualizações"}
        </button>
      )}
    </footer>
  );
}
