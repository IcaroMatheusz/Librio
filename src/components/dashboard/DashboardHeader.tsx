import { BookOpen, Library } from "lucide-react";
import { Link } from "react-router-dom";

export function DashboardHeader() {
  return (
    <header className="border-b border-white/10">
      <nav
        aria-label="Navegação principal"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12"
      >
        <Link
          to="/dashboard"
          aria-label="Librio, painel inicial"
          className="inline-flex items-center gap-3 rounded-xl text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
        >
          <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-200">
            <BookOpen aria-hidden="true" size={21} />
          </span>
          <span className="text-xl font-extrabold tracking-tight">
            Librio<span className="text-violet-300">.</span>
          </span>
        </Link>

        {/* TODO: Conectar este atalho à rota da biblioteca quando ela for criada. */}
        <Link
          to="/library"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-violet-300/40 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
        >
          <Library aria-hidden="true" size={17} />
          <span className="hidden sm:inline">Biblioteca</span>
        </Link>
      </nav>
    </header>
  );
}
