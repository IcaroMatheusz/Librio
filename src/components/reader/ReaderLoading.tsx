import { BookOpen } from "lucide-react";

interface ReaderLoadingProps {
  title: string;
  detail: string;
  percent: number | null;
  progressText?: string;
}

export function ReaderLoading({
  title,
  detail,
  percent,
  progressText,
}: ReaderLoadingProps) {
  const clampedPercent =
    percent === null ? null : Math.max(0, Math.min(100, percent));
  const circumference = 2 * Math.PI * 42;
  const dashOffset =
    clampedPercent === null
      ? undefined
      : circumference * (1 - clampedPercent / 100);
  const dashArray =
    clampedPercent === null
      ? `${circumference * 0.24} ${circumference * 0.76}`
      : circumference;

  return (
    <section
      role="status"
      aria-live="polite"
      className="flex min-h-[50dvh] flex-1 flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.12),transparent_65%),#151827] px-6 py-10 text-center shadow-2xl shadow-black/20"
    >
      <div className="relative grid size-28 place-items-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="absolute inset-0 size-full -rotate-90"
        >
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgb(196,181,253)"
            strokeLinecap="round"
            strokeWidth="6"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            className={
              clampedPercent === null
                ? "origin-center animate-[spin_1.2s_linear_infinite]"
                : "transition-[stroke-dashoffset] duration-300"
            }
          />
        </svg>
        <BookOpen
          aria-hidden="true"
          size={30}
          className="text-violet-200"
        />
        {clampedPercent !== null && (
          <span className="absolute -bottom-1 rounded-full border border-white/10 bg-[#151827] px-2.5 py-1 text-xs font-bold tabular-nums text-violet-100">
            {Math.round(clampedPercent)}%
          </span>
        )}
      </div>
      <h2 className="mt-7 text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{detail}</p>
      {progressText && (
        <p className="mt-3 rounded-full border border-violet-200/10 bg-violet-200/[0.05] px-3 py-1 text-xs font-semibold text-violet-100">
          {progressText}
        </p>
      )}
    </section>
  );
}
