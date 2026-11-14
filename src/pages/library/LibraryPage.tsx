import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BookOpen,
  BookPlus,
  Download,
  LibraryBig,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import spawnReading from "../../assets/spawnreading-library.png";
import { BookCard } from "../../components/BookCard";
import {
  BookActionDialog,
  type BookActionDialogState,
} from "../../components/library/BookActionDialog";
import { deleteBook, getBooks, renameBook } from "../../services/booksService";
import type { Book } from "../../types/database";

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<BookActionDialogState | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadBooks() {
      setLoading(true);
      setError(null);
      try {
        const result = await getBooks();
        if (active) setBooks(result);
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível carregar sua biblioteca.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBooks();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function openDialog(type: BookActionDialogState["type"], book: Book) {
    setDialog({ type, book });
    setTitleDraft(book.title);
    setActionError(null);
    setActionNotice(null);
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || dialog.type !== "rename") return;

    setActionBusy(true);
    setActionError(null);
    try {
      const updatedBook = await renameBook(dialog.book.id, titleDraft);
      setBooks((currentBooks) =>
        currentBooks.map((book) =>
          book.id === updatedBook.id
            ? { ...book, title: updatedBook.title }
            : book,
        ),
      );
      setDialog(null);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível renomear a obra.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete() {
    if (!dialog || dialog.type !== "delete") return;

    setActionBusy(true);
    setActionError(null);
    try {
      const warning = await deleteBook(dialog.book);
      setBooks((currentBooks) =>
        currentBooks.filter((book) => book.id !== dialog.book.id),
      );
      setDialog(null);
      setActionNotice(warning);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível excluir a obra.",
      );
      setReloadKey((key) => key + 1);
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171A27] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-52 top-44 size-[30rem] rounded-full bg-orange-700/[0.08] blur-3xl"
      />
      <header className="relative border-b border-white/[0.07] bg-[#171A27]/85">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
          <Link
            to="/dashboard"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Painel
          </Link>
          <Link
            to="/upload"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-2 text-sm font-bold text-[#1d1930] shadow-lg shadow-violet-950/20 transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <BookPlus aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Adicionar obra</span>
            <span className="sm:hidden">Adicionar</span>
          </Link>
        </nav>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-8 sm:pb-16 sm:pt-9 lg:px-12">
        <section
          aria-labelledby="library-title"
          className="relative isolate mb-9 overflow-hidden rounded-[1.75rem] border border-orange-200/10 bg-gradient-to-br from-[#32274a] via-[#28243d] to-[#202238] shadow-2xl shadow-black/20 sm:mb-12 sm:rounded-[2rem]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 -z-10 size-72 rounded-full bg-orange-500/10 blur-3xl sm:size-96"
          />
          <div className="relative min-h-[245px] px-5 py-7 sm:min-h-[300px] sm:px-8 sm:py-9 lg:min-h-[350px] lg:px-12 lg:py-12">
            <div className="relative z-10 max-w-[68%] sm:max-w-[58%] lg:max-w-[54%]">
              <p className="inline-flex items-center gap-2 rounded-full border border-orange-200/15 bg-orange-200/[0.07] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.17em] text-orange-100 sm:text-xs">
                <Sparkles aria-hidden="true" size={14} />
                Seu universo de histórias
              </p>
              <h1
                id="library-title"
                className="mt-4 text-3xl font-black leading-[1.08] tracking-tight sm:mt-5 sm:text-4xl lg:text-5xl"
              >
                Minha
                <br />
                biblioteca
              </h1>
              <p className="mt-3 max-w-md text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6 lg:text-base">
                Todas as suas aventuras reunidas. Escolha uma história e
                continue de onde parou.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-slate-200 sm:mt-7 sm:px-4 sm:text-sm">
                <LibraryBig
                  aria-hidden="true"
                  size={16}
                  className="text-orange-200"
                />
                {loading
                  ? "Carregando coleção..."
                  : `${books.length} ${books.length === 1 ? "obra" : "obras"} na coleção`}
              </div>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-3/4 bg-gradient-to-l from-transparent via-[#28243d]/15 to-[#28243d]/80"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 right-[8%] z-0 size-72 rounded-full bg-orange-500/25 blur-[90px] sm:size-96 sm:bg-orange-400/30"
            />
            <img
              src={spawnReading}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 -right-8 z-0 h-[92%] w-[56%] object-contain object-bottom brightness-125 contrast-110 saturate-125 drop-shadow-[0_0_22px_rgba(255,132,46,0.58)] drop-shadow-[0_18px_42px_rgba(255,76,23,0.32)] sm:-bottom-5 sm:right-0 sm:h-[102%] sm:w-[49%] lg:-bottom-7 lg:right-[1%] lg:h-[112%] lg:w-[45%]"
            />
          </div>
        </section>

        <section aria-labelledby="collection-title">
          <header className="mb-5 flex items-end justify-between gap-4 sm:mb-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200 sm:text-sm">
                Coleção pessoal
              </p>
              <h2
                id="collection-title"
                className="mt-1.5 text-xl font-extrabold tracking-tight sm:text-2xl"
              >
                Suas obras
              </h2>
            </div>
            {!loading && !error && books.length > 0 && (
              <span className="pb-0.5 text-xs font-medium text-slate-400 sm:text-sm">
                Mais recentes primeiro
              </span>
            )}
          </header>

          <Link
            to="/download"
            className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-200/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-200 sm:text-sm"
          >
            <Download aria-hidden="true" size={16} className="text-violet-200" />
            Ler um arquivo do seu dispositivo
          </Link>

          {actionNotice && (
            <p
              role="status"
              className="mb-5 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-100"
            >
              {actionNotice}
            </p>
          )}

          {loading ? (
            <div
              role="status"
              aria-label="Carregando sua biblioteca"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5"
            >
              {Array.from({ length: 10 }, (_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#202435]"
                >
                  <div className="aspect-[2/3] animate-pulse bg-white/[0.06]" />
                  <div className="space-y-2 p-3.5">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
              <span className="sr-only">Carregando sua biblioteca...</span>
            </div>
          ) : error ? (
            <article
              role="alert"
              className="rounded-3xl border border-rose-300/20 bg-rose-300/[0.05] p-6 sm:p-8"
            >
              <p className="text-sm leading-6 text-rose-100">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200/20 px-4 py-2 text-sm font-bold text-rose-100 transition hover:bg-rose-200/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-100"
              >
                <RefreshCw aria-hidden="true" size={16} />
                Tentar novamente
              </button>
            </article>
          ) : books.length === 0 ? (
            <article className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-12 text-center sm:px-8 sm:py-16">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-violet-200/10 bg-violet-200/[0.06] text-violet-200">
                <BookOpen aria-hidden="true" size={27} />
              </span>
              <h3 className="mt-5 text-xl font-extrabold sm:text-2xl">
                Toda coleção começa com uma história
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Adicione seu primeiro PDF ou quadrinho e deixe sua próxima
                leitura sempre à mão.
              </p>
              <Link
                to="/upload"
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <BookPlus aria-hidden="true" size={17} />
                Adicionar primeira obra
              </Link>
            </article>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  showFormat
                  to={`/reader/${book.id}`}
                  onRename={() => openDialog("rename", book)}
                  onDelete={() => openDialog("delete", book)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {dialog && (
        <BookActionDialog
          dialog={dialog}
          titleDraft={titleDraft}
          actionError={actionError}
          actionBusy={actionBusy}
          onTitleChange={(event) => setTitleDraft(event.target.value)}
          onRename={handleRename}
          onDelete={() => void handleDelete()}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
