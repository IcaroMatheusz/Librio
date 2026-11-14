import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";

const backgroundImage =
  "https://static0.srcdn.com/wordpress/wp-content/uploads/2024/02/batman-superman-world-s-finest-26-mora-dc-cover.jpg";

export default function ErrorScreen() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-16 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: `url("${backgroundImage}")` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-slate-950/75"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/30 via-slate-950/35 to-slate-950/85"
      />

      <section className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-8 flex size-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-violet-200 shadow-xl shadow-black/20 backdrop-blur-sm">
          <BookOpen aria-hidden="true" size={30} strokeWidth={1.7} />
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-violet-200">
            Não encontramos a página que você procura.
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Esta página saiu da história.
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-slate-200 sm:text-lg">
          Não encontramos o endereço que você tentou acessar. Que tal voltar
          para a página inicial e continuar sua leitura por lá?
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-500 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Voltar para o início
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Voltar à página anterior
          </button>
        </div>
      </section>
    </main>
  );
}
