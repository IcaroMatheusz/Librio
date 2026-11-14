import { useEffect, useState, type FormEvent } from "react";

import {
  BookActionDialog,
  type BookActionDialogState,
} from "../../components/library/BookActionDialog";
import { LibraryBooksContent } from "../../components/library/LibraryBooksContent";
import { LibraryCollectionHeader } from "../../components/library/LibraryCollectionHeader";
import { LibraryDownloadLink } from "../../components/library/LibraryDownloadLink";
import { LibraryHero } from "../../components/library/LibraryHero";
import { LibraryNotice, type LibraryNoticeData } from "../../components/library/LibraryNotice";
import { LibraryPageHeader } from "../../components/library/LibraryPageHeader";
import {
  deleteBook,
  getBooks,
  renameBook,
  uploadBookCover,
} from "../../services/booksService";
import type { Book } from "../../types/database";

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<BookActionDialogState | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<LibraryNoticeData | null>(
    null,
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [coverBusyId, setCoverBusyId] = useState<string | null>(null);

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
        <LibraryHero bookCount={books.length} loading={loading} />

        <section aria-labelledby="collection-title">
          <LibraryCollectionHeader
            showSortLabel={!loading && !error && books.length > 0}
          />
          <LibraryDownloadLink />
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
