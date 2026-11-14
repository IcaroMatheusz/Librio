import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Layers3, LoaderCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { getBooks } from "../../services/booksService";
import {
  createVolume,
  type NewVolumeChapter,
} from "../../services/volumesService";
import type { Book } from "../../types/database";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#171A27] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10 disabled:opacity-60";

export default function CreateVolumePage() {
  const navigate = useNavigate();
  const [pdfBooks, setPdfBooks] = useState<Book[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [chapterTitles, setChapterTitles] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getBooks()
      .then((books) => {
        if (active) {
          setPdfBooks(books.filter((book) => book.file_type.toLowerCase() === "pdf"));
        }
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível carregar os PDFs da biblioteca.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function toggleBook(book: Book) {
    setError(null);
    setSelectedIds((current) => {
      if (current.includes(book.id)) {
        return current.filter((id) => id !== book.id);
      }
      setChapterTitles((titles) => ({
        ...titles,
        [book.id]: titles[book.id] ?? book.title,
      }));
      return [...current, book.id];
    });
  }

  function moveChapter(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedIds.length) return;
    setSelectedIds((current) => {
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[index],
      ];
      return reordered;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (selectedIds.length < 2) {
      setError("Selecione pelo menos dois PDFs e organize-os na ordem de leitura.");
      return;
    }

    setSaving(true);
    try {
      const chapters: NewVolumeChapter[] = selectedIds.map((bookId) => ({
        bookId,
        title: chapterTitles[bookId] ?? "",
      }));
      await createVolume(title, author, chapters);
      navigate("/library", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível montar o volume.",
      );
    } finally {
      setSaving(false);
    }
  }

  const booksById = new Map(pdfBooks.map((book) => [book.id, book]));

  return (
    <main className="min-h-screen bg-[#171A27] text-white">
      <header className="border-b border-white/[0.07] bg-[#171A27]/85">
        <nav className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link
            to="/library"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Minha biblioteca
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-violet-100">
            <Layers3 aria-hidden="true" size={18} className="text-violet-300" />
            Montar volume
          </span>
        </nav>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
        <header className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            Volumes por capítulos
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Junte seus PDFs em um volume
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Escolha PDFs da biblioteca, defina a ordem e dê um nome para cada
            capítulo. Os arquivos originais continuam na biblioteca e não são
            duplicados.
          </p>
        </header>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-6 rounded-3xl border border-white/[0.09] bg-[#202435]/90 p-5 shadow-2xl shadow-black/20 sm:p-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-200">
              Nome do volume
              <input
                required
                maxLength={200}
                disabled={saving}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Lanterna Verde — Renascimento"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-bold text-slate-200">
              Autor
              <input
                required
                maxLength={160}
                disabled={saving}
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="Nome do autor"
                className={inputClass}
              />
            </label>
          </div>

          <section aria-labelledby="volume-pdfs-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="volume-pdfs-title" className="font-bold text-white">
                  PDFs disponíveis
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Selecione os arquivos; a ordem de seleção define os capítulos.
                </p>
              </div>
              <span className="text-xs font-semibold text-violet-200">
                {selectedIds.length} selecionados
              </span>
            </div>

            {loading ? (
              <p role="status" className="mt-4 text-sm text-slate-400">
                Carregando PDFs...
              </p>
            ) : pdfBooks.length === 0 ? (
              <p className="mt-4 rounded-xl border border-white/10 bg-[#171A27] p-4 text-sm text-slate-300">
                Você ainda não tem PDFs na biblioteca para montar um volume.
              </p>
            ) : (
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {pdfBooks.map((book) => (
                  <li key={book.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#171A27]/80 px-3 py-2 transition hover:border-violet-200/25">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(book.id)}
                        disabled={saving}
                        onChange={() => toggleBook(book)}
                        className="size-4 accent-violet-400"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {book.title}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {book.author}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedIds.length > 0 && (
            <section aria-labelledby="volume-order-title">
              <h2 id="volume-order-title" className="font-bold text-white">
                Ordem e nomes dos capítulos
              </h2>
              <ol className="mt-3 space-y-2">
                {selectedIds.map((bookId, index) => {
                  const book = booksById.get(bookId);
                  if (!book) return null;
                  return (
                    <li
                      key={bookId}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#171A27]/80 p-3"
                    >
                      <span className="w-7 shrink-0 text-center text-xs font-bold text-violet-200">
                        {index + 1}
                      </span>
                      <label className="min-w-0 flex-1 text-xs text-slate-400">
                        <span className="sr-only">
                          Nome do capítulo {index + 1}
                        </span>
                        <input
                          required
                          maxLength={200}
                          disabled={saving}
                          value={chapterTitles[bookId] ?? book.title}
                          onChange={(event) =>
                            setChapterTitles((current) => ({
                              ...current,
                              [bookId]: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#202435] px-3 py-2 text-sm text-white outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-300/10"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={saving || index === 0}
                        aria-label={`Mover capítulo ${index + 1} para cima`}
                        onClick={() => moveChapter(index, -1)}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
                      >
                        <ArrowUp aria-hidden="true" size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={saving || index === selectedIds.length - 1}
                        aria-label={`Mover capítulo ${index + 1} para baixo`}
                        onClick={() => moveChapter(index, 1)}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
                      >
                        <ArrowDown aria-hidden="true" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-rose-300/[0.07] p-3 text-sm text-rose-200">
              {error}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end">
            <Link
              to="/library"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving || loading || selectedIds.length < 2}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-extrabold text-[#1d1930] shadow-lg shadow-violet-950/20 transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
              ) : (
                <Layers3 aria-hidden="true" size={17} />
              )}
              {saving ? "Montando volume..." : "Criar volume"}
            </button>
          </footer>
        </form>
      </div>
    </main>
  );
}
