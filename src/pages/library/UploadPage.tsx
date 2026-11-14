import { useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, BookUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/useAuth";
import { uploadBook } from "../../services/booksService";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#171A27] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setError(null);
    setFile(null);

    if (!selectedFile) return;
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "cbr", "cbz"].includes(extension ?? "")) {
      setError("Formato não compatível. Escolha um arquivo PDF, CBR ou CBZ.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("O arquivo deve ter no máximo 100 MB.");
      return;
    }

    setFile(selectedFile);
    setTitle((currentTitle) =>
      currentTitle || selectedFile.name.replace(/\.[^.]+$/, ""),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !file) {
      setError("Escolha um arquivo antes de enviar.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      await uploadBook(user.id, file, title, author);
      navigate("/library", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível enviar a obra.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#171A27] text-white">
      <header className="border-b border-white/10">
        <nav className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-8">
          <Link
            to="/library"
            className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Minha biblioteca
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <header className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
            Adicionar à biblioteca
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Enviar uma obra
          </h1>
          <p className="mt-2 text-slate-400">
            PDF, CBR e CBZ de até 100 MB.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="book-file"
                className="text-sm font-semibold text-slate-200"
              >
                Arquivo
              </label>
              <input
                id="book-file"
                type="file"
                accept=".pdf,.cbr,.cbz,application/pdf,application/vnd.comicbook-rar,application/vnd.comicbook+zip"
                required
                onChange={handleFileChange}
                className={`${inputClass} file:mr-4 file:rounded-lg file:border-0 file:bg-violet-300/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-violet-200`}
              />
              {file && (
                <p className="mt-2 text-sm text-slate-400">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="book-title"
                className="text-sm font-semibold text-slate-200"
              >
                Título
              </label>
              <input
                id="book-title"
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="book-author"
                className="text-sm font-semibold text-slate-200"
              >
                Autor
              </label>
              <input
                id="book-author"
                type="text"
                required
                maxLength={160}
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-rose-200">
                {error}
              </p>
            )}

            <footer className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <Link
                to="/library"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={uploading || !file}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
              >
                <BookUp aria-hidden="true" size={17} />
                {uploading ? "Enviando..." : "Enviar obra"}
              </button>
            </footer>
          </form>
        </section>
      </section>
    </main>
  );
}
