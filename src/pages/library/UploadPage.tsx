import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  BookUp,
  Check,
  FileArchive,
  FileText,
  ImagePlus,
  Sparkles,
  Upload,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import sanjiSitting from "../../assets/sanjiwithchopper.png";
import { UploadResultModal } from "../../components/library/UploadResultModal";
import { useAuth } from "../../contexts/useAuth";
import { uploadBook } from "../../services/booksService";
import {
  createBookCoverPreview,
  prepareManualBookCover,
} from "../../services/coverPreviewService";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#171A27] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-not-allowed disabled:opacity-60";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface UploadResult {
  type: "success" | "error";
  message: string;
  coverUnavailable?: boolean;
}

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [manualCoverFile, setManualCoverFile] = useState<File | null>(null);
  const [manualCoverUrl, setManualCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!coverUrl) return;
    return () => URL.revokeObjectURL(coverUrl);
  }, [coverUrl]);

  useEffect(() => {
    if (!manualCoverUrl) return;
    return () => URL.revokeObjectURL(manualCoverUrl);
  }, [manualCoverUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setResult(null);
    setCoverUrl(null);
    setFile(null);
    setManualCoverFile(null);
    setManualCoverUrl(null);

    if (!selectedFile) return;
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "cbr", "cbz"].includes(extension ?? "")) {
      setResult({
        type: "error",
        message: "Formato não compatível. Escolha um arquivo PDF, CBR ou CBZ.",
      });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setResult({
        type: "error",
        message: "O arquivo deve ter no máximo 100 MB.",
      });
      return;
    }

    setFile(selectedFile);
    setTitle((currentTitle) =>
      currentTitle || selectedFile.name.replace(/\.[^.]+$/, ""),
    );
  }

  function handleManualCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedCover = event.target.files?.[0] ?? null;
    setResult(null);
    setManualCoverFile(null);
    setManualCoverUrl(null);
    if (!selectedCover) return;
    if (!selectedCover.type.startsWith("image/")) {
      setResult({
        type: "error",
        message: "A capa precisa ser um arquivo de imagem.",
      });
      return;
    }
    if (selectedCover.size > 10 * 1024 * 1024) {
      setResult({
        type: "error",
        message: "A imagem da capa deve ter até 10 MB.",
      });
      return;
    }

    setManualCoverFile(selectedCover);
    setManualCoverUrl(URL.createObjectURL(selectedCover));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !file) {
      setResult({ type: "error", message: "Escolha um arquivo antes de enviar." });
      return;
    }

    setResult(null);
    setCoverUrl(null);
    setUploadProgress(0);
    setUploadStage(
      manualCoverFile
        ? "Preparando a capa escolhida..."
        : "Preparando a prévia da capa...",
    );
    setUploading(true);

    let generatedCoverUrl: string | null = null;
    let coverPreview: Blob | undefined;
    let coverUnavailable = false;

    try {
      if (manualCoverFile) {
        coverPreview = await prepareManualBookCover(manualCoverFile);
        generatedCoverUrl = URL.createObjectURL(coverPreview);
      } else {
        try {
          const cover = await createBookCoverPreview(file);
          coverPreview = cover;
          generatedCoverUrl = URL.createObjectURL(cover);
        } catch {
          coverUnavailable = true;
        }
      }

      setUploadStage("Enviando arquivo...");
      const uploadedBook = await uploadBook(
        user.id,
        file,
        title,
        author,
        setUploadProgress,
        coverPreview,
      );
      if (uploadedBook.cover_url && generatedCoverUrl) {
        setCoverUrl(generatedCoverUrl);
        generatedCoverUrl = null;
      } else if (coverPreview) {
        coverUnavailable = true;
      }
      setResult({
        type: "success",
        message: `${title.trim()} foi adicionada à sua biblioteca.`,
        coverUnavailable,
      });
    } catch (caughtError) {
      setResult({
        type: "error",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível enviar a obra.",
      });
    } finally {
      if (generatedCoverUrl) URL.revokeObjectURL(generatedCoverUrl);
      setUploading(false);
      setUploadStage("");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171A27] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-40 size-96 rounded-full bg-violet-700/10 blur-3xl"
      />
      <header className="relative border-b border-white/[0.07] bg-[#171A27]/80">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8 lg:px-12">
          <Link
            to="/library"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Minha biblioteca
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-bold tracking-wide text-violet-100">
            <BookOpen aria-hidden="true" size={18} className="text-violet-300" />
            Librio
          </span>
        </nav>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
        <header className="mb-8 max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            <Sparkles aria-hidden="true" size={14} />
            Sua próxima aventura
          </p>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Tem história nova{" "}
            <span className="text-violet-300">chegando!</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Guarde seus livros e quadrinhos favoritos num só lugar. Escolha um
            arquivo, dê os detalhes e prepare a leitura.
          </p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:gap-8">
          <section className="rounded-3xl border border-white/[0.09] bg-[#202435]/90 p-5 shadow-2xl shadow-black/20 sm:p-7 lg:p-8">
            <header className="mb-6">
              <h2 className="text-lg font-bold text-white">Adicionar uma obra</h2>
              <p className="mt-1 text-sm text-slate-400">
                Os campos marcados são necessários para salvar na biblioteca.
              </p>
            </header>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="book-file"
                  className="text-sm font-bold text-slate-200"
                >
                  Arquivo da obra
                </label>
                <input
                  id="book-file"
                  type="file"
                  accept=".pdf,.cbr,.cbz,application/pdf,application/vnd.comicbook-rar,application/vnd.comicbook+zip"
                  required
                  disabled={uploading}
                  onChange={handleFileChange}
                  className="peer sr-only"
                />
                <label
                  htmlFor="book-file"
                  className={`mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 text-center transition focus-within:ring-4 focus-within:ring-violet-300/10 ${
                    file
                      ? "border-violet-300/40 bg-violet-300/[0.07]"
                      : "border-white/15 bg-[#171A27]/70 hover:border-violet-300/40 hover:bg-violet-300/[0.04]"
                  } ${uploading ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                    {file ? (
                      <Check aria-hidden="true" size={21} />
                    ) : (
                      <Upload aria-hidden="true" size={21} />
                    )}
                  </span>
                  <span className="max-w-full break-all text-sm font-bold text-slate-100">
                    {file ? file.name : "Clique para escolher seu arquivo"}
                  </span>
                  <span className="mt-1 text-xs text-slate-400">
                    {file
                      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · pronto para enviar`
                      : "PDF, CBR ou CBZ · até 100 MB"}
                  </span>
                </label>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-200">
                  Capa personalizada{" "}
                  <span className="font-normal text-slate-500">(opcional)</span>
                </p>
                <input
                  id="manual-book-cover"
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={handleManualCoverChange}
                  className="peer sr-only"
                />
                <label
                  htmlFor="manual-book-cover"
                  className={`mt-2 flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-[#171A27]/60 p-3 transition hover:border-violet-300/40 hover:bg-violet-300/[0.04] focus-within:ring-4 focus-within:ring-violet-300/10 ${
                    uploading ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  {manualCoverUrl ? (
                    <img
                      src={manualCoverUrl}
                      alt="Prévia da capa personalizada"
                      className="h-20 w-14 rounded-lg object-cover shadow-lg"
                    />
                  ) : (
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                      <ImagePlus aria-hidden="true" size={22} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-100">
                      {manualCoverFile
                        ? manualCoverFile.name
                        : "Escolher uma imagem para a capa"}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                      {manualCoverFile
                        ? "A imagem será otimizada e enviada junto com a obra."
                        : "Opcional · JPG, PNG ou WEBP · até 10 MB"}
                    </span>
                  </span>
                </label>
              </div>

              {uploading && (
                <section
                  aria-label="Progresso do envio"
                  aria-live="polite"
                  className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.05] p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <p className="font-semibold text-slate-100">
                      {uploadStage}
                    </p>
                    <p className="tabular-nums text-violet-200">
                      {uploadProgress}%
                    </p>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progresso do envio do arquivo"
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className="h-full rounded-full bg-violet-400 transition-[width] duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </section>
              )}

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
                  disabled={uploading}
                  value={title}
                  placeholder="Ex.: A aventura começa"
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
                  disabled={uploading}
                  value={author}
                  placeholder="Nome do autor"
                  onChange={(event) => setAuthor(event.target.value)}
                  className={inputClass}
                />
              </div>

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
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-extrabold text-[#1d1930] shadow-lg shadow-violet-950/20 transition hover:-translate-y-0.5 hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
                >
                  <BookUp aria-hidden="true" size={17} />
                  {uploading ? "Enviando..." : "Enviar obra"}
                </button>
              </footer>
            </form>
          </section>

          <aside className="relative min-h-[300px] overflow-hidden rounded-3xl border border-violet-200/10 bg-gradient-to-br from-[#322b55] via-[#282442] to-[#1d2030] p-6 shadow-2xl shadow-black/20 sm:min-h-[350px] sm:p-8 lg:sticky lg:top-8 lg:min-h-[560px]">
            <div
              aria-hidden="true"
              className="absolute -right-14 -top-14 size-56 rounded-full bg-fuchsia-400/10 blur-3xl"
            />
            <div className="relative z-10 max-w-[62%] sm:max-w-[58%] lg:max-w-[65%]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-100">
                <Sparkles aria-hidden="true" size={12} />
                Clima de leitura
              </span>
              <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">
                Um cantinho para cada aventura.
              </h2>
              <p className="mt-3 text-sm leading-6 text-violet-100/70">
                Sua coleção, suas regras. Deixe tudo pronto para a próxima
                página.
              </p>
            </div>
            <img
              src={sanjiSitting}
              alt="Sanji e Chopper"
              className="pointer-events-none absolute -bottom-5 -right-3 z-0 h-[78%] w-[52%] object-contain object-bottom drop-shadow-[0_16px_30px_rgba(0,0,0,0.35)] sm:-bottom-8 sm:right-0 sm:h-[88%] sm:w-[53%] lg:-bottom-8 lg:right-[-5%] lg:h-[86%] lg:w-[72%]"
            />
            <div className="absolute bottom-5 left-5 right-5 z-10 flex flex-wrap gap-2 sm:bottom-7 sm:left-8 sm:right-8">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#171A27]/55 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                <FileText aria-hidden="true" size={14} className="text-rose-200" />
                PDF
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#171A27]/55 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                <FileArchive aria-hidden="true" size={14} className="text-amber-200" />
                CBR / CBZ
              </span>
            </div>
          </aside>
        </div>
      </div>
      {result && (
        <UploadResultModal
          type={result.type}
          message={result.message}
          coverUrl={result.type === "success" ? coverUrl : null}
          coverUnavailable={
            result.type === "success" && result.coverUnavailable
          }
          onClose={() => {
            setResult(null);
            setCoverUrl(null);
          }}
          onLibraryClick={
            result.type === "success"
              ? () => {
                  setResult(null);
                  setCoverUrl(null);
                  navigate("/library", { replace: true });
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
