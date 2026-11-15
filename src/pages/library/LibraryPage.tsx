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
import { VolumeAuthorDialog } from "../../components/library/VolumeAuthorDialog";
import { StorageIndicator } from "../../components/StorageIndicator";
import {
  deleteBook,
  getBooks,
  renameBook,
  updateBookAuthor,
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
  updateVolumeAuthor,
  type BookVolume,
} from "../../services/volumesService";
import { getLocalReadingProgress } from "../../services/progressService";
import { getUserStorage } from "../../services/storageService";
import type { UserStorage } from "../../types/database";

export default function LibraryPage() {
  const desktopApp = isDesktopApp();
  const [books, setBooks] = useState<Book[]>([]);
  const [volumes, setVolumes] = useState<BookVolume[]>([]);
  const [localBooks, setLocalBooks] = useState<
    Awaited<ReturnType<typeof getLocalBooks>>
  >([]);
  const [storage, setStorage] = useState<UserStorage | null>(null);
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
  const [storageError, setStorageError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<BookActionDialogState | null>(null);
  const [editingVolume, setEditingVolume] = useState<BookVolume | null>(null);
  const [volumeAuthorDraft, setVolumeAuthorDraft] = useState("");
  const [volumeAuthorError, setVolumeAuthorError] = useState<string | null>(null);
  const [volumeDeleteWarning, setVolumeDeleteWarning] =
    useState<BookVolume | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [authorDraft, setAuthorDraft] = useState("");
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

  async function refreshStorage() {
    try {
      setStorage(await getUserStorage());
      setStorageError(null);
    } catch (caughtError) {
      setStorageError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar o espaço de armazenamento.",
      );
    }
  }

  useEffect(() => {
    let active = true;

    async function loadLibrary() {
      setLoading(true);
      setLocalLoading(desktopApp);
      setError(null);
      setVolumeError(null);
      setLocalError(null);
      setLocalProgressError(null);
      setStorageError(null);
      const [
        booksResult,
        volumesResult,
        localBooksResult,
        localProgressResult,
        storageResult,
      ] = await Promise.allSettled([
        getBooks(),
        getVolumes(),
        desktopApp ? getLocalBooks() : Promise.resolve([]),
        desktopApp
          ? getLocalReadingProgress()
          : Promise.resolve(new Map<string, number>()),
        getUserStorage(),
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
        if (storageResult.status === "fulfilled") {
          setStorage(storageResult.value);
        } else {
          setStorageError(
            storageResult.reason instanceof Error
              ? storageResult.reason.message
              : "Não foi possível carregar o espaço de armazenamento.",
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
    if (volume.chapters.length > 0) {
      setVolumeDeleteWarning(volume);
      return;
    }
    if (
      !window.confirm(
        `Excluir o volume “${volume.title}”?`,
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
        message: `O volume “${volume.title}” foi excluído.`,
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

  async function handleUpdateVolumeAuthor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVolume) return;

    setActionBusy(true);
    setVolumeAuthorError(null);
    try {
      const author = await updateVolumeAuthor(
        editingVolume.id,
        volumeAuthorDraft,
      );
      setVolumes((currentVolumes) =>
        currentVolumes.map((volume) =>
          volume.id === editingVolume.id ? { ...volume, author } : volume,
        ),
      );
      setEditingVolume(null);
      setActionNotice({
        message: author
          ? `O autor do volume “${editingVolume.title}” foi atualizado.`
          : `O autor do volume “${editingVolume.title}” foi removido.`,
        type: "success",
      });
    } catch (caughtError) {
      setVolumeAuthorError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar o autor do volume.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleVolumeCoverSelect(volume: BookVolume, file: File) {
    const firstChapterBook = volume.chapters[0]?.book;
    if (!firstChapterBook) return;

    setCoverBusyId(firstChapterBook.id);
    setActionNotice(null);
    try {
      const { book: updatedBook, warning } = await uploadBookCover(
        firstChapterBook.id,
        file,
      );
      setBooks((currentBooks) =>
        currentBooks.map((book) =>
          book.id === updatedBook.id ? updatedBook : book,
        ),
      );
      setVolumes((currentVolumes) =>
        currentVolumes.map((currentVolume) => ({
          ...currentVolume,
          chapters: currentVolume.chapters.map((chapter) =>
            chapter.bookId === updatedBook.id
              ? { ...chapter, book: updatedBook }
              : chapter,
          ),
        })),
      );
      await refreshStorage();
      setActionNotice({
        message:
          warning ??
          `A capa do capítulo 1 e do volume “${volume.title}” foi atualizada.`,
        type: warning ? "warning" : "success",
      });
    } catch (caughtError) {
      setActionNotice({
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível atualizar a capa do volume.",
        type: "error",
      });
    } finally {
      setCoverBusyId(null);
    }
  }

  function openVolumeAuthorDialog(volume: BookVolume) {
    setEditingVolume(volume);
    setVolumeAuthorDraft(volume.author);
    setVolumeAuthorError(null);
    setActionNotice(null);
  }

  function openDialog(type: BookActionDialogState["type"], book: Book) {
    setDialog({ type, book });
    setTitleDraft(book.title);
    setAuthorDraft(book.author);
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

  async function handleUpdateAuthor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || dialog.type !== "author") return;

    setActionBusy(true);
    setActionError(null);
    try {
      const updatedBook = await updateBookAuthor(dialog.book.id, authorDraft);
      setBooks((currentBooks) =>
        currentBooks.map((book) =>
          book.id === updatedBook.id
            ? { ...book, author: updatedBook.author }
            : book,
        ),
      );
      setDialog(null);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar o autor da obra.",
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
      try {
        setVolumes(await getVolumes());
        setVolumeError(null);
      } catch (volumeLoadError) {
        setVolumeError(
          volumeLoadError instanceof Error
            ? volumeLoadError.message
            : "Não foi possível atualizar os capítulos dos volumes.",
        );
      }
      await refreshStorage();
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
      await refreshStorage();
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
        {storage && (
          <div className="mb-9">
            <StorageIndicator storage={storage} />
          </div>
        )}
        {storageError && (
          <div className="mt-4">
            <LibraryNotice
              notice={{ message: storageError, type: "warning" }}
            />
          </div>
        )}

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
                    coverBusy={coverBusyId === volume.chapters[0]?.book.id}
                    onEditAuthor={() => openVolumeAuthorDialog(volume)}
                    onCoverSelect={(file) =>
                      void handleVolumeCoverSelect(volume, file)
                    }
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
            onEditAuthor={(book) => openDialog("author", book)}
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
          authorDraft={authorDraft}
          actionError={actionError}
          actionBusy={actionBusy}
          onTitleChange={(event) => setTitleDraft(event.target.value)}
          onAuthorChange={(event) => setAuthorDraft(event.target.value)}
          onRename={handleRename}
          onUpdateAuthor={handleUpdateAuthor}
          onDelete={() => void handleDelete()}
          onClose={() => setDialog(null)}
        />
      )}

      {editingVolume && (
        <VolumeAuthorDialog
          volumeTitle={editingVolume.title}
          author={volumeAuthorDraft}
          busy={actionBusy}
          error={volumeAuthorError}
          onChange={setVolumeAuthorDraft}
          onSubmit={handleUpdateVolumeAuthor}
          onClose={() => setEditingVolume(null)}
        />
      )}

      {volumeDeleteWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setVolumeDeleteWarning(null);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="volume-delete-warning-title"
            className="w-full max-w-lg rounded-3xl border border-amber-200/15 bg-[#222638] p-6 shadow-2xl shadow-black/40 sm:p-8"
          >
            <h2
              id="volume-delete-warning-title"
              className="text-xl font-bold text-white"
            >
              Exclua as obras antes do volume
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              O volume “{volumeDeleteWarning.title}” ainda contém obras. Para
              excluí-lo, primeiro exclua estas obras da biblioteca. Isso também
              removerá os arquivos originais.
            </p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#171A27]/70 p-3 text-sm text-slate-200">
              {volumeDeleteWarning.chapters.map((chapter) => (
                <li key={chapter.bookId} className="truncate">
                  {chapter.book.title}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-400">
              Depois de excluir as obras, volte e exclua o volume vazio.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setVolumeDeleteWarning(null)}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto"
            >
              Entendi
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
