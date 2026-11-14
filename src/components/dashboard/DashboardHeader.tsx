import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Library,
  LogOut,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/useAuth";

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountLabel = user?.email ?? "Minha conta";

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);

    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível encerrar sua sessão.",
      );
      setSigningOut(false);
    }
  }

  return (
    <header className="relative z-20 border-b border-white/10 bg-[#171A27]/95">
      <nav
        aria-label="Navegação principal"
        className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4 lg:px-12"
      >
        <Link
          to="/dashboard"
          aria-label="Librio, painel inicial"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:gap-3"
        >
          <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-200">
            <BookOpen aria-hidden="true" size={21} />
          </span>
          <span className="text-xl font-extrabold tracking-tight">
            Librio<span className="text-violet-300">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* TODO: Conectar este atalho à rota da biblioteca quando ela for criada. */}
          <Link
            to="/library"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-violet-300/40 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:px-4"
          >
            <Library aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Biblioteca</span>
          </Link>

          <div className="relative">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="Abrir menu da conta"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex min-h-10 max-w-48 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-violet-300/40 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:max-w-60 sm:px-4"
            >
              <UserRound
                aria-hidden="true"
                size={17}
                className="shrink-0 text-violet-200"
              />
              <span className="hidden truncate sm:inline">
                {accountLabel}
              </span>
              <ChevronDown
                aria-hidden="true"
                size={15}
                className={`hidden shrink-0 transition-transform sm:block ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {menuOpen && (
              <section
                aria-label="Opções da conta"
                className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#222638] p-1.5 shadow-xl shadow-black/30 sm:w-56"
              >
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200"
                >
                  <UserRound
                    aria-hidden="true"
                    size={17}
                    className="text-violet-200"
                  />
                  Editar perfil
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-200 transition hover:bg-rose-400/10 focus-visible:outline-2 focus-visible:outline-rose-200 disabled:cursor-wait disabled:opacity-60"
                >
                  <LogOut aria-hidden="true" size={17} />
                  {signingOut ? "Saindo..." : "Sair"}
                </button>
                {error && (
                  <p
                    role="alert"
                    className="border-t border-white/10 px-3 py-2 text-xs leading-5 text-rose-200"
                  >
                    {error}
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
