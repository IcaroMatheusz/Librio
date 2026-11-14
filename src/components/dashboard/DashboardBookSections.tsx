import { ArrowRight, Clock3, Library, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { BookCard } from "../BookCard";
import type { Book, RecentRead } from "../../types/database";

function EmptySection({
  icon,
  title,
  description,
  showLibraryLink = false,
}: {
  icon: "library" | "clock";
  title: string;
  description: string;
  showLibraryLink?: boolean;
}) {
  const Icon = icon === "library" ? Library : Clock3;

  return (
    <article className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center">
      <Icon aria-hidden="true" size={25} className="text-violet-200" />
      <h3 className="mt-3 font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>
      {showLibraryLink && (
        <Link
          to="/library"
          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-violet-200 transition hover:bg-white/5 hover:text-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200"
        >
          <Plus aria-hidden="true" size={16} />
          Adicionar primeira obra
        </Link>
      )}
    </article>
  );
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 id={id} className="text-xl font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <Link
        to="/library"
        aria-label="Ver todas as obras na biblioteca"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
      >
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </header>
  );
}

export function RecentBooksSection({ books }: { books: Book[] }) {
  return (
    <section aria-labelledby="recent-books-title" className="min-w-0">
      <SectionHeading
        id="recent-books-title"
        title="Últimas obras adicionadas"
        description="Novidades na sua biblioteca"
      />
      {books.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} showFormat />
          ))}
        </div>
      ) : (
        <EmptySection
          icon="library"
          title="Sua biblioteca ainda está vazia"
          description="Suas próximas leituras vão aparecer aqui."
          showLibraryLink
        />
      )}
    </section>
  );
}

export function RecentReadsSection({ books }: { books: RecentRead[] }) {
  return (
    <section aria-labelledby="recent-reads-title" className="min-w-0">
      <header className="mb-4">
        <h2 id="recent-reads-title" className="text-xl font-bold">
          Últimas leituras
        </h2>
        <p className="mt-1 text-sm text-slate-400">Seu progresso mais recente</p>
      </header>
      {books.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} progress={book.progress} />
          ))}
        </div>
      ) : (
        <EmptySection
          icon="clock"
          title="Nenhuma leitura por aqui ainda"
          description="Quando você começar a ler, suas obras recentes aparecem aqui."
        />
      )}
    </section>
  );
}
