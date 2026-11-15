import { BookOpen } from "lucide-react";

import type { ReaderTheme } from "../../hooks/useReaderTheme";

interface ReaderLoadingProps {
  title: string;
  detail: string;
  percent: number | null;
  theme?: ReaderTheme;
  progressText?: string;
}

export function ReaderLoading({
  title,
  detail,
  percent,
  theme = "night",
  progressText,
}: ReaderLoadingProps) {
  const isNight = theme === "night";
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
      className={`flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border px-6 py-10 text-center shadow-2xl ${
        isNight
          ? "border-white/[0.08] shadow-black/20"
          : "border-stone-300 shadow-stone-900/10"
      }`}
      style={{
        backgroundColor: isNight ? "#151827" : "#fffaf0",
        backgroundImage:
          "radial-gradient(ellipse at top, rgba(139, 92, 246, 0.12), transparent 65%)",
      }}
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
            stroke={isNight ? "rgba(255,255,255,0.1)" : "rgba(68,64,60,0.15)"}
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={isNight ? "rgb(196,181,253)" : "rgb(109,40,217)"}
            strokeLinecap="round"
            strokeWidth="6"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            className={
              clampedPercent === null
                ? "origin-center animate-[spin_1.2s_linear_infinite] motion-reduce:animate-none"
                : "transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
            }
          />
        </svg>
        <BookOpen
          aria-hidden="true"
          size={30}
          className={isNight ? "text-violet-200" : "text-violet-700"}
        />
        {clampedPercent !== null && (
          <span
            className={`absolute -bottom-1 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums ${
              isNight
                ? "border-white/10 bg-[#151827] text-violet-100"
                : "border-stone-300 bg-white text-violet-800"
            }`}
          >
            {Math.round(clampedPercent)}%
          </span>
        )}
      </div>
      <h2
        className={`mt-7 text-lg font-bold ${
          isNight ? "text-white" : "text-stone-900"
        }`}
      >
        {title}
      </h2>
      <p
        className={`mt-2 max-w-md text-sm leading-6 ${
          isNight ? "text-slate-400" : "text-stone-600"
        }`}
      >
        {detail}
      </p>
      {progressText && (
        <p         className={`mt-3 rounded-full border px-3 py-1 text-xs font-semibold ${
          isNight
            ? "border-violet-200/10 bg-violet-200/[0.05] text-violet-100"
            : "border-violet-300 bg-violet-100 text-violet-900"
        }`}>
          {progressText}
        </p>
      )}
    </section>
  );
}
