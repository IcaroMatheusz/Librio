import { ChevronDown } from "lucide-react";

export interface ChapterOption {
  value: string;
  label: string;
}

interface ChapterSelectorProps {
  id: string;
  label: string;
  value: string;
  options: ChapterOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function ChapterSelector({
  id,
  label,
  value,
  options,
  disabled = false,
  onChange,
}: ChapterSelectorProps) {
  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 max-w-44 appearance-none rounded-xl border border-violet-200/15 bg-gradient-to-b from-[#292d40] to-[#1b1f30] py-2 pl-3 pr-9 text-xs font-semibold text-slate-100 shadow-sm shadow-black/20 outline-none transition hover:border-violet-200/30 focus:border-violet-200/50 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-64 sm:text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-violet-200"
      />
    </div>
  );
}
