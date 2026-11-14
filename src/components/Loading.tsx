export function Loading() {
  return (
    <main
      aria-label="Carregando o painel"
      aria-busy="true"
      className="min-h-screen bg-[#171A27] px-4 py-8 text-white sm:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-7xl animate-pulse space-y-8">
        <div className="h-10 w-56 rounded-xl bg-white/10" />
        <div className="h-64 rounded-3xl border border-white/10 bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 rounded-2xl bg-white/5" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-60 rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    </main>
  );
}
