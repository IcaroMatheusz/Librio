import { BookOpen, RefreshCw, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import librioIcon from "../assets/librio-icon.png";
import { useDesktopUpdates } from "../contexts/DesktopUpdateContext";

export function DesktopTitleBar() {
  const isDesktop = Boolean(window.librioDesktop);
  const { status, checkForUpdates } = useDesktopUpdates();
  const location = useLocation();

  if (!isDesktop) return null;

  const isUpdating = status.status === "checking" || status.status === "downloading";
  const hasUpdateReady = status.status === "downloaded";

  return (
    <header
      role="banner"
      aria-label="Barra de título do Librio Desktop"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      className="sticky top-0 z-50 flex h-[38px] w-full select-none items-center justify-between border-b border-white/[0.08] bg-[#171A27] px-3 pr-[140px] text-xs text-slate-300"
    >
      {/* Left: Librio Mascot Icon & Title */}
      <div className="flex items-center gap-2">
        <img
          src={librioIcon}
          alt="Ícone do Librio"
          className="size-5 rounded-md object-cover shadow-sm ring-1 ring-violet-400/30"
        />
        <span className="font-extrabold tracking-tight text-white">
          Librio<span className="text-violet-300">.</span>
        </span>
        <span className="rounded bg-violet-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200">
          Desktop
        </span>
      </div>

      {/* Center: Quick navigation links */}
      <nav
        aria-label="Atalhos rápidos de navegação"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        className="hidden items-center gap-1 sm:flex"
      >
        <Link
          to="/dashboard"
          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition hover:bg-white/10 hover:text-white ${
            location.pathname === "/dashboard"
              ? "bg-white/[0.08] text-white"
              : "text-slate-400"
          }`}
        >
          Painel
        </Link>
        <Link
          to="/library"
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition hover:bg-white/10 hover:text-white ${
            location.pathname.startsWith("/library")
              ? "bg-white/[0.08] text-white"
              : "text-slate-400"
          }`}
        >
          <BookOpen aria-hidden="true" size={13} className="text-violet-300" />
          Biblioteca
        </Link>
      </nav>

      {/* Right: Update notification button */}
      <div
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        className="flex items-center gap-2"
      >
        <button
          type="button"
          onClick={() => void checkForUpdates()}
          title="Verificar atualizações do Librio Desktop"
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold transition focus-visible:outline-2 focus-visible:outline-violet-300 ${
            hasUpdateReady
              ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25"
              : isUpdating
                ? "border-violet-300/30 bg-violet-400/15 text-violet-200"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          {hasUpdateReady ? (
            <>
              <Sparkles aria-hidden="true" size={12} className="text-emerald-300" />
              <span>Atualização pronta</span>
            </>
          ) : (
            <>
              <RefreshCw
                aria-hidden="true"
                size={11}
                className={isUpdating ? "animate-spin text-violet-300" : "text-slate-400"}
              />
              <span className="hidden md:inline">
                {isUpdating ? "Verificando..." : "Atualizações"}
              </span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
