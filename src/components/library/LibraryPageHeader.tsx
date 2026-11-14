import { ArrowLeft, BookPlus, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";

export function LibraryPageHeader() {
  return (
    <header className="relative border-b border-white/[0.07] bg-[#171A27]/85">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
        <Link
          to="/dashboard"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Painel
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/volumes/new"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-violet-200/20 bg-violet-200/[0.06] px-3 py-2 text-xs font-bold text-violet-100 transition hover:bg-violet-200/[0.12] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:px-4 sm:text-sm"
          >
            <Layers3 aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Montar volume</span>
            <span className="sm:hidden">Volume</span>
          </Link>
          <Link
            to="/upload"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-400 px-3 py-2 text-xs font-bold text-[#1d1930] shadow-lg shadow-violet-950/20 transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-4 sm:text-sm"
          >
            <BookPlus aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Adicionar obra</span>
            <span className="sm:hidden">Adicionar</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
