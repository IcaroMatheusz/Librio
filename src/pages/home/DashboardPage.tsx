import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Library,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";

import { BookCard } from "../../components/BookCard";
import { Loading } from "../../components/Loading";
import { StorageIndicator } from "../../components/StorageIndicator";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function DashboardPage() {
  const { data, loading, error, reload } = useDashboardData();

  if (loading && !data) return <Loading />;

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171A27] px-4 py-12 text-white">
        <section
          aria-labelledby="dashboard-error-title"
          className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl shadow-black/20 sm:p-10"
        >
          <div
            aria-hidden="true"
            className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-200"
          >
            <RefreshCw size={24} />
          </div>
          <h1
            id="dashboard-error-title"
            className="mt-5 text-2xl font-bold tracking-tight"
          >
            Não foi possível carregar seu painel
          </h1>
          <p role="alert" className="mt-3 text-sm leading-6 text-slate-300">
            {error ?? "Tente novamente em alguns instantes."}
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <RefreshCw aria-hidden="true" size={17} />
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  const lastRead = data.recentReads[0];
  const isLibraryEmpty = data.totalBooks === 0;

  return (
    <main className="min-h-screen bg-[#171A27] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
          <Link
            to="/dashboard"
            aria-label="Librio, painel inicial"
            className="inline-flex items-center gap-3 rounded-xl text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-200">
              <BookOpen aria-hidden="true" size={21} />
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              Librio<span className="text-violet-300">.</span>
            </span>
          </Link>

          {/* TODO: Criar a rota /library para este atalho e a biblioteca completa. */}
          <Link
            to="/library"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-violet-300/40 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <Library aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Biblioteca</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
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

        <section
          aria-labelledby="continue-title"
          className="relative isolate overflow-hidden rounded-3xl border border-violet-200/15 bg-gradient-to-br from-[#32274F] via-[#28243F] to-[#202238] shadow-2xl shadow-black/20"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-28 -z-10 size-80 rounded-full bg-violet-400/15 blur-3xl"
          />
          <div className="grid items-center gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 lg:p-10">
            {lastRead ? (
              <>
                <div className="flex min-w-0 items-center gap-5 sm:gap-7">
                  <div className="hidden h-44 w-32 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[#171A27]/60 shadow-xl sm:block">
                    {lastRead.cover_url ? (
                      <img
                        src={lastRead.cover_url}
                        alt={`Capa de ${lastRead.title}`}
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
                      {lastRead.title}
                    </h2>
                    <p className="mt-1 truncate text-slate-300">
                      {lastRead.author}
                    </p>
                    <div className="mt-5 max-w-lg">
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-200">
                        <span>Seu progresso</span>
                        <span className="font-semibold">{lastRead.progress}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`Progresso de leitura de ${lastRead.title}: ${lastRead.progress}%`}
                        aria-valuenow={lastRead.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-2 overflow-hidden rounded-full bg-black/25"
                      >
                        <div
                          className="h-full rounded-full bg-violet-300"
                          style={{ width: `${lastRead.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {/* TODO: Conectar ao leitor quando a rota /reader/:bookId estiver disponível. */}
                <Link
                  to={`/reader/${lastRead.id}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 font-bold text-[#1d1930] shadow-lg shadow-black/15 transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:shrink-0"
                >
                  Continuar leitura
                  <ArrowRight aria-hidden="true" size={18} />
                </Link>
              </>
            ) : (
              <div className="max-w-2xl">
                <div
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-violet-200"
                >
                  <BookOpen size={23} />
                </div>
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
                {/* TODO: Direcionar para o fluxo de adicionar obras quando ele estiver disponível. */}
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
              </div>
            )}
          </div>
        </section>

        <section aria-label="Resumo da biblioteca">
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-400">Total de obras</p>
                <BookOpen
                  aria-hidden="true"
                  size={19}
                  className="text-violet-200"
                />
              </div>
              <p className="mt-3 text-3xl font-bold">{data.totalBooks}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-400">Em andamento</p>
                <Clock3
                  aria-hidden="true"
                  size={19}
                  className="text-violet-200"
                />
              </div>
              <p className="mt-3 text-3xl font-bold">{data.inProgressCount}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-400">Concluídas</p>
                <Check
                  aria-hidden="true"
                  size={19}
                  className="text-violet-200"
                />
              </div>
              <p className="mt-3 text-3xl font-bold">{data.completedCount}</p>
            </article>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="recent-books-title" className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="recent-books-title" className="text-xl font-bold">
                  Últimas obras adicionadas
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Novidades na sua biblioteca
                </p>
              </div>
              <Link
                to="/library"
                aria-label="Ver todas as obras na biblioteca"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
              >
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </div>
            {data.books.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {data.books.map((book) => (
                  <BookCard key={book.id} book={book} showFormat />
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center">
                <Library
                  aria-hidden="true"
                  size={25}
                  className="text-violet-200"
                />
                <p className="mt-3 font-semibold text-white">
                  Sua biblioteca ainda está vazia
                </p>
                <p className="mt-1 max-w-sm text-sm text-slate-400">
                  Suas próximas leituras vão aparecer aqui.
                </p>
                <Link
                  to="/library"
                  className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-violet-200 transition hover:bg-white/5 hover:text-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200"
                >
                  <Plus aria-hidden="true" size={16} />
                  Adicionar primeira obra
                </Link>
              </div>
            )}
          </section>

          <section aria-labelledby="recent-reads-title" className="min-w-0">
            <div className="mb-4">
              <h2 id="recent-reads-title" className="text-xl font-bold">
                Últimas leituras
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Seu progresso mais recente
              </p>
            </div>
            {data.recentReads.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {data.recentReads.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    progress={book.progress}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center">
                <Clock3
                  aria-hidden="true"
                  size={25}
                  className="text-violet-200"
                />
                <p className="mt-3 font-semibold text-white">
                  Nenhuma leitura por aqui ainda
                </p>
                <p className="mt-1 max-w-sm text-sm text-slate-400">
                  Quando você começar a ler, suas obras recentes aparecem aqui.
                </p>
              </div>
            )}
          </section>
        </div>

        <StorageIndicator storage={data.storage} />

        <footer className="border-t border-white/10 pt-5 text-center text-xs text-slate-500">
          Librio — sua próxima leitura começa aqui.
        </footer>
      </div>
    </main>
  );
}
