interface LibraryCollectionHeaderProps {
  showSortLabel: boolean;
  eyebrow?: string;
  title?: string;
}

export function LibraryCollectionHeader({
  showSortLabel,
  eyebrow = "Coleção pessoal",
  title = "Suas obras",
}: LibraryCollectionHeaderProps) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4 sm:mb-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200 sm:text-sm">
          {eyebrow}
        </p>
        <h2
          id="collection-title"
          className="mt-1.5 text-xl font-extrabold tracking-tight sm:text-2xl"
        >
          {title}
        </h2>
      </div>
      {showSortLabel && (
        <span className="pb-0.5 text-xs font-medium text-slate-400 sm:text-sm">
          Mais recentes primeiro
        </span>
      )}
    </header>
  );
}
