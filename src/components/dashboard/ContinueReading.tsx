import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import type { RecentRead } from "../../types/database";

interface ContinueReadingProps {
  book: RecentRead | null;
  isLibraryEmpty: boolean;
}

export function ContinueReading({
  book,
  isLibraryEmpty,
}: ContinueReadingProps) {
  return (
    <section
      aria-labelledby="continue-title"
      className="relative isolate overflow-hidden rounded-3xl border border-violet-200/15 bg-gradient-to-br from-[#32274F] via-[#28243F] to-[#202238] shadow-2xl shadow-black/20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-28 -z-10 size-80 rounded-full bg-violet-400/15 blur-3xl"
      />

      <div className="grid items-center gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 lg:p-10">
        {book ? (
          <>
            <article className="flex min-w-0 items-center gap-5 sm:gap-7">
              <div className="hidden h-44 w-32 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[#171A27]/60 shadow-xl sm:block">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={`Capa de ${book.title}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex h-full items-center justify-center text-violet-200/70"
                  >
                    <BookOpen size={36} strokeWidth={1.5} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">
                  Continuar lendo
                </p>
                <h2
                  id="continue-title"
                  className="mt-3 line-clamp-2 text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  {book.title}
                </h2>
                <p className="mt-1 truncate text-slate-300">{book.author}</p>

                <div className="mt-5 max-w-lg">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-200">
                    <span>Seu progresso</span>
                    <span className="font-semibold">{book.progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Progresso de leitura de ${book.title}: ${book.progress}%`}
                    aria-valuenow={book.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 overflow-hidden rounded-full bg-black/25"
                  >
                    <div
                      className="h-full rounded-full bg-violet-300"
                      style={{ width: `${book.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </article>

            <Link
              to={`/reader/${book.id}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 font-bold text-[#1d1930] shadow-lg shadow-black/15 transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:shrink-0"
            >
              Continuar leitura
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </>
        ) : (
          <article className="max-w-2xl">
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-violet-200"
            >
              <BookOpen size={23} />
            </span>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">
              Continuar lendo
            </p>
            <h2
              id="continue-title"
              className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
            >
              {isLibraryEmpty
                ? "Sua próxima história começa aqui."
                : "Pronto para começar uma leitura?"}
            </h2>
            <p className="mt-2 max-w-xl text-slate-300">
              {isLibraryEmpty
                ? "Adicione sua primeira obra e tenha sua biblioteca sempre por perto."
                : "Abra uma obra da sua biblioteca. Nós guardamos seu progresso para você continuar depois."}
            </p>
            <Link
              to="/library"
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {isLibraryEmpty ? (
                <>
                  <Plus aria-hidden="true" size={18} />
                  Adicionar primeira obra
                </>
              ) : (
                <>
                  <BookOpen aria-hidden="true" size={18} />
                  Explorar biblioteca
                </>
              )}
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </article>
        )}
      </div>
    </section>
  );
}
