import { Loading } from "../../components/Loading";
import {
  RecentBooksSection,
  RecentReadsSection,
} from "../../components/dashboard/DashboardBookSections";
import { ContinueReading } from "../../components/dashboard/ContinueReading";
import { DashboardError } from "../../components/dashboard/DashboardError";
import { DashboardBanner } from "../../components/dashboard/DashboardBanner";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { DashboardSummary } from "../../components/dashboard/DashboardSummary";
import { StorageIndicator } from "../../components/StorageIndicator";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function DashboardPage() {
  const { data, loading, error, reload } = useDashboardData();

  if (loading && !data) return <Loading />;
  if (error || !data) {
    return (
      <DashboardError
        message={error ?? "Tente novamente em alguns instantes."}
        onRetry={() => void reload()}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#171A27] text-white">
      <DashboardHeader />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        <DashboardBanner />

        <section aria-labelledby="welcome-title">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
            Seu espaço de leitura
          </p>
          <h1
            id="welcome-title"
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Olá, que bom ter você por aqui.
          </h1>
          <p className="mt-2 text-slate-400">
            Seus livros e histórias, prontos para continuar.
          </p>
        </section>

        <ContinueReading
          book={data.recentReads[0] ?? null}
          isLibraryEmpty={data.totalBooks === 0}
        />

        <StorageIndicator storage={data.storage} />

        <DashboardSummary
          totalBooks={data.totalBooks}
          inProgress={data.inProgressCount}
          completed={data.completedCount}
        />

        <section
          aria-label="Obras e leituras recentes"
          className="grid gap-8 lg:grid-cols-2"
        >
          <RecentBooksSection books={data.books} />
          <RecentReadsSection books={data.recentReads} />
        </section>

        <footer className="border-t border-white/10 pt-5 text-center text-xs text-slate-500">
          Librio — sua próxima leitura começa aqui.
        </footer>
      </div>
    </main>
  );
}
