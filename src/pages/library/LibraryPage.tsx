import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  BookActionDialog,
  type BookActionDialogState,
} from "../../components/library/BookActionDialog";
import { LibraryBooksContent } from "../../components/library/LibraryBooksContent";
import { LibraryCollectionHeader } from "../../components/library/LibraryCollectionHeader";
import { LibraryDownloadLink } from "../../components/library/LibraryDownloadLink";
import { LibraryHero } from "../../components/library/LibraryHero";
import { LocalBooksSection } from "../../components/library/LocalBooksSection";
import { LibraryNotice, type LibraryNoticeData } from "../../components/library/LibraryNotice";
import { LibraryPageHeader } from "../../components/library/LibraryPageHeader";
import { VolumeCard } from "../../components/library/VolumeCard";
import {
  deleteBook,
  getBooks,
  renameBook,
  uploadBookCover,
} from "../../services/booksService";
import {
  addLocalBooks,
  getLocalBookFile,
  getLocalBooks,
  isDesktopApp,
  removeLocalBook,
  saveLocalBookCover,
} from "../../services/localBooksService";
import {
  createBookCoverPreview,
  prepareManualBookCover,
} from "../../services/coverPreviewService";
import type { Book } from "../../types/database";
import type { LocalBook } from "../../../shared/desktop";
import {
  deleteVolume as deleteVolumeService,
  getVolumes,
  type BookVolume,
} from "../../services/volumesService";
import { getLocalReadingProgress } from "../../services/progressService";

export default function LibraryPage() {
  const desktopApp = isDesktopApp();
  const [books, setBooks] = useState<Book[]>([]);
  const [volumes, setVolumes] = useState<BookVolume[]>([]);
  const [localBooks, setLocalBooks] = useState<
    Awaited<ReturnType<typeof getLocalBooks>>
  >([]);
  const [localProgress, setLocalProgress] = useState<Map<string, number>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [localLoading, setLocalLoading] = useState(desktopApp);
  const [error, setError] = useState<string | null>(null);
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localProgressError, setLocalProgressError] = useState<string | null>(
    null,
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<BookActionDialogState | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<LibraryNoticeData | null>(
    null,
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [coverBusyId, setCoverBusyId] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const localCoverJobs = useRef(new Set<string>());

  const ensureLocalBookCovers = useCallback(async (booksToCheck: LocalBook[]) => {
    for (const book of booksToCheck) {
      if (
        !book.available ||
        book.cover_url ||
        book.file_type === "epub" ||
        localCoverJobs.current.has(book.id)
      ) {
        continue;
      }

      localCoverJobs.current.add(book.id);
      setCoverBusyId(book.id);
      try {
        const file = new File(
          [await getLocalBookFile(book.id)],
          `${book.title}.${book.file_type}`,
        );
        const cover = await createBookCoverPreview(file);
        const savedBook = await saveLocalBookCover(book.id, cover);
        setLocalBooks((currentBooks) =>
          currentBooks.map((item) =>
            item.id === savedBook.id ? savedBook : item,
          ),
        );
      } catch (caughtError) {
        const reason =
          caughtError instanceof Error
            ? caughtError.message
            : "erro desconhecido";
        setLocalError(
          `Não foi possível gerar a capa de “${book.title}”: ${reason} Você ainda pode selecionar uma imagem pelo botão Capa.`,
        );
      } finally {
        localCoverJobs.current.delete(book.id);
        setCoverBusyId((currentId) =>
          currentId === book.id ? null : currentId,
        );
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLibrary() {
      setLoading(true);
      setLocalLoading(desktopApp);
      setError(null);
      setVolumeError(null);
      setLocalError(null);
      setLocalProgressError(null);
      const [booksResult, volumesResult, localBooksResult, localProgressResult] =
        await Promise.allSettled([
        getBooks(),
        getVolumes(),
        desktopApp ? getLocalBooks() : Promise.resolve([]),
        desktopApp
          ? getLocalReadingProgress()
          : Promise.resolve(new Map<string, number>()),
      ]);
      if (active) {
        if (booksResult.status === "fulfilled") {
          setBooks(booksResult.value);
        } else {
          setError(
            booksResult.reason instanceof Error
              ? booksResult.reason.message
              : "Não foi possível carregar sua biblioteca.",
          );
        }
        if (volumesResult.status === "fulfilled") {
          setVolumes(volumesResult.value);
        } else {
          setVolumeError(
            volumesResult.reason instanceof Error
              ? volumesResult.reason.message
              : "Não foi possível carregar seus volumes.",
          );
        }
        if (desktopApp) {
          if (localBooksResult.status === "fulfilled") {
            setLocalBooks(localBooksResult.value);
            void ensureLocalBookCovers(localBooksResult.value);
          } else {
            setLocalError(
              localBooksResult.reason instanceof Error
                ? localBooksResult.reason.message
                : "Não foi possível carregar os arquivos locais.",
            );
          }
          if (localProgressResult.status === "fulfilled") {
            setLocalProgress(localProgressResult.value);
          } else {
            setLocalProgressError(
              localProgressResult.reason instanceof Error
                ? localProgressResult.reason.message
                : "Não foi possível carregar o progresso das obras locais.",
            );
          }
        }
      }
      if (active) {
        setLoading(false);
        setLocalLoading(false);
      }
    }

    void loadLibrary();
    return () => {
      active = false;
    };
  }, [desktopApp, ensureLocalBookCovers, reloadKey]);

  async function handleAddLocalBooks() {
    setLocalBusy(true);
    setLocalError(null);
    try {
      await addLocalBooks();
      const updatedBooks = await getLocalBooks();
      setLocalBooks(updatedBooks);
      void ensureLocalBookCovers(updatedBooks);
    } catch (caughtError) {
      setLocalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível adicionar os arquivos locais.",
      );
    } finally {
      setLocalBusy(false);
    }
  }

  async function handleLocalCoverSelect(book: LocalBook, file: File) {
    setCoverBusyId(book.id);
    setLocalError(null);
    try {
      const cover = await prepareManualBookCover(file);
      const updatedBook = await saveLocalBookCover(book.id, cover);
      setLocalBooks((currentBooks) =>
        currentBooks.map((currentBook) =>
          currentBook.id === updatedBook.id ? updatedBook : currentBook,
        ),
      );
    } catch (caughtError) {
      setLocalError(
        caughtError instanceof Error
          ? caughtError.message
          : `Não foi possível atualizar a capa de “${book.title}”.`,
      );
    } finally {
      setCoverBusyId(null);
    }
  }

  async function handleRemoveLocalBook(bookId: string) {
    setLocalBusy(true);
    setLocalError(null);
    try {
      await removeLocalBook(bookId);
      setLocalBooks((currentBooks) =>
        currentBooks.filter((book) => book.id !== bookId),
      );
    } catch (caughtError) {
      setLocalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível remover a obra da biblioteca local.",
      );
    } finally {
      setLocalBusy(false);
    }
  }

  async function handleDeleteVolume(volume: BookVolume) {
    if (
      !window.confirm(
        `Excluir o volume “${volume.title}”? Os PDFs originais continuarão na biblioteca.`,
      )
    ) {
      return;
    }

    setActionBusy(true);
    setActionNotice(null);
    try {
      await deleteVolumeService(volume.id);
      setVolumes((current) =>
        current.filter((currentVolume) => currentVolume.id !== volume.id),
      );
      setActionNotice({
        message: `O volume “${volume.title}” foi excluído. Os PDFs originais foram mantidos.`,
        type: "success",
      });
    } catch (caughtError) {
      setActionNotice({
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível excluir o volume.",
        type: "error",
      });
    } finally {
      setActionBusy(false);
    }
  }

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
      setActionNotice(
        warning ? { message: warning, type: "warning" } : null,
      );
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

  async function handleCoverSelect(book: Book, file: File) {
    setCoverBusyId(book.id);
    setActionNotice(null);
    try {
      const { book: updatedBook, warning } = await uploadBookCover(
        book.id,
        file,
      );
      setBooks((currentBooks) =>
        currentBooks.map((currentBook) =>
          currentBook.id === updatedBook.id ? updatedBook : currentBook,
        ),
      );
      setActionNotice({
        message:
          warning ?? `A capa de “${updatedBook.title}” foi atualizada.`,
        type: warning ? "warning" : "success",
      });
    } catch (caughtError) {
      setActionNotice({
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível atualizar a capa.",
        type: "error",
      });
    } finally {
      setCoverBusyId(null);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171A27] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-52 top-44 size-[30rem] rounded-full bg-orange-700/[0.08] blur-3xl"
      />
      <LibraryPageHeader />

      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-8 sm:pb-16 sm:pt-9 lg:px-12">
        <LibraryHero
          bookCount={books.length + volumes.length + localBooks.length}
          loading={loading}
        />

        <section aria-labelledby="collection-title">
          {desktopApp && (
            <LocalBooksSection
              books={localBooks}
              progressByBookId={localProgress}
              loading={localLoading}
              busy={localBusy}
              error={localError}
              progressError={localProgressError}
              coverBusyId={coverBusyId}
              onAdd={() => void handleAddLocalBooks()}
              onRemove={(book) => void handleRemoveLocalBook(book.id)}
              onCoverSelect={(book, file) =>
                void handleLocalCoverSelect(book, file)
              }
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          )}
          {volumeError && (
            <LibraryNotice notice={{ message: volumeError, type: "warning" }} />
          )}
          {volumes.length > 0 && (
            <section aria-labelledby="volumes-title" className="mb-9">
              <header className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200 sm:text-sm">
                    Leitura organizada
                  </p>
                  <h2
                    id="volumes-title"
                    className="mt-1.5 text-xl font-extrabold tracking-tight sm:text-2xl"
                  >
                    {desktopApp ? "Volumes na nuvem" : "Seus volumes"}
                  </h2>
                </div>
                <Link
                  to="/volumes/new"
                  className="text-xs font-semibold text-violet-200 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-200 sm:text-sm"
                >
                  Montar outro
                </Link>
              </header>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
                {volumes.map((volume) => (
                  <VolumeCard
                    key={volume.id}
                    volume={volume}
                    deleting={actionBusy}
                    onDelete={() => void handleDeleteVolume(volume)}
                  />
                ))}
              </div>
            </section>
          )}
          <LibraryCollectionHeader
            showSortLabel={!loading && !error && books.length > 0}
            eyebrow={desktopApp ? "Armazenadas na nuvem" : undefined}
            title={desktopApp ? "Obras na nuvem" : undefined}
          />
          {!desktopApp && <LibraryDownloadLink />}
          <LibraryNotice notice={actionNotice} />
          <LibraryBooksContent
            books={books}
            loading={loading}
            error={error}
            coverBusyId={coverBusyId}
            onRetry={() => setReloadKey((key) => key + 1)}
            onRename={(book) => openDialog("rename", book)}
            onDelete={(book) => openDialog("delete", book)}
            onCoverSelect={(book, file) =>
              void handleCoverSelect(book, file)
            }
          />
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
