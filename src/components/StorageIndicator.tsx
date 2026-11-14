import { HardDrive } from "lucide-react";

import type { UserStorage } from "../types/database";
import { formatBytes } from "../utils/formatBytes";

interface StorageIndicatorProps {
  storage: UserStorage;
}

export function StorageIndicator({ storage }: StorageIndicatorProps) {
  const percentage =
    storage.max_bytes > 0
      ? (storage.used_bytes / storage.max_bytes) * 100
      : 0;
  const availableBytes = Math.max(
    0,
    storage.max_bytes - storage.used_bytes,
  );

  return (
    <section
      aria-labelledby="storage-title"
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="storage-title" className="font-semibold text-white">
            Armazenamento
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {formatBytes(storage.used_bytes)} de {formatBytes(storage.max_bytes)}{" "}
            ({new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(percentage)}%)
          </p>
        </div>
        <div
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200"
        >
          <HardDrive size={19} />
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Espaço de armazenamento usado"
        aria-valuenow={Math.min(percentage, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-violet-400 transition-[width]"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {formatBytes(availableBytes)} disponíveis
      </p>
    </section>
  );
}
