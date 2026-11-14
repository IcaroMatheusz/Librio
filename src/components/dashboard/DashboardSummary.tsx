import { BookOpen, Check, Clock3 } from "lucide-react";

interface DashboardSummaryProps {
  totalBooks: number;
  inProgress: number;
  completed: number;
}

const summaryItems = [
  { key: "totalBooks", label: "Total de obras", Icon: BookOpen },
  { key: "inProgress", label: "Em andamento", Icon: Clock3 },
  { key: "completed", label: "Concluídas", Icon: Check },
] as const;

export function DashboardSummary({
  totalBooks,
  inProgress,
  completed,
}: DashboardSummaryProps) {
  const counts = { totalBooks, inProgress, completed };

  return (
    <section aria-label="Resumo da biblioteca">
      <div className="grid gap-4 sm:grid-cols-3">
        {summaryItems.map(({ key, label, Icon }) => (
          <article
            key={key}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <header className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-slate-400">{label}</h2>
              <Icon aria-hidden="true" size={19} className="text-violet-200" />
            </header>
            <p className="mt-3 text-3xl font-bold">{counts[key]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
