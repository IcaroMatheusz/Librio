import { RefreshCw } from "lucide-react";

interface DashboardErrorProps {
  message: string;
  onRetry: () => void;
}

export function DashboardError({ message, onRetry }: DashboardErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#171A27] px-4 py-12 text-white">
      <section
        aria-labelledby="dashboard-error-title"
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl shadow-black/20 sm:p-10"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-200"
        >
          <RefreshCw size={24} />
        </span>
        <h1
          id="dashboard-error-title"
          className="mt-5 text-2xl font-bold tracking-tight"
        >
          Não foi possível carregar seu painel
        </h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-slate-300">
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
