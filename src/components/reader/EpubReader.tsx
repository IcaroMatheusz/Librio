import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Maximize,
} from "lucide-react";

import {
  extractEpub,
  type EpubContentNode,
  type EpubDocument,
} from "../../services/epubReaderService";
import { ReaderLoading } from "./ReaderLoading";

interface EpubReaderProps {
  file: Blob;
  initialProgress: number;
  onProgressChange: (progress: number) => Promise<void>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const CONTENT_CLASSES: Partial<Record<EpubContentNode["type"], string>> = {
  blockquote:
    "my-6 border-l-2 border-violet-300/50 pl-4 italic text-slate-300",
  code: "rounded bg-black/20 px-1.5 py-0.5 font-mono text-violet-100",
  dd: "ml-5 mt-1 text-slate-300",
  dl: "my-5",
  dt: "mt-3 font-semibold text-slate-100",
  em: "italic",
  figcaption: "mt-2 text-center text-sm text-slate-400",
  figure: "my-6 flex flex-col items-center",
  h1: "mb-6 mt-10 text-3xl font-bold tracking-tight text-white",
  h2: "mb-5 mt-9 text-2xl font-bold tracking-tight text-white",
  h3: "mb-4 mt-7 text-xl font-bold text-white",
  h4: "mb-3 mt-6 text-lg font-bold text-white",
  h5: "mb-3 mt-5 font-bold text-white",
  h6: "mb-2 mt-4 font-bold text-slate-200",
  i: "italic",
  img: "h-auto max-h-[75dvh] max-w-full rounded-lg object-contain",
  li: "my-1 pl-1",
  ol: "my-5 list-decimal space-y-1 pl-7 marker:text-violet-200",
  p: "my-5 whitespace-pre-wrap text-[1.05rem] leading-[1.9] text-slate-200",
  pre: "my-5 overflow-x-auto rounded-xl bg-black/25 p-4 font-mono text-sm",
  section: "my-4",
  small: "text-sm text-slate-400",
  strong: "font-bold text-white",
  table: "my-6 w-full border-collapse text-left text-sm",
  td: "border border-white/10 px-3 py-2",
  th: "border border-white/10 bg-white/[0.05] px-3 py-2 font-semibold",
  tr: "border-b border-white/10",
  ul: "my-5 list-disc space-y-1 pl-7 marker:text-violet-200",
};

function renderContent(nodes: EpubContentNode[], parentKey = "content"): ReactNode {
  return nodes.map((node, index) => {
    const key = `${parentKey}-${index}`;
    if (node.type === "img") {
      return node.src
        ? createElement("img", {
            key,
            src: node.src,
            alt: node.alt ?? "",
            className: CONTENT_CLASSES.img,
          })
        : null;
    }

    if (node.type === "br" || node.type === "hr") {
      return createElement(node.type, { key });
    }

    return createElement(
      node.type,
      {
        key,
        className: CONTENT_CLASSES[node.type],
      },
      node.text ?? renderContent(node.children ?? [], key),
    );
  });
}

function getChapterPosition(progress: number, chapterCount: number) {
  const position = (Math.min(100, Math.max(0, progress)) / 100) * chapterCount;
  const index = Math.min(chapterCount - 1, Math.floor(position));
  return {
    index: Math.max(0, index),
    offset: progress >= 100 ? 1 : position - index,
  };
}

export function EpubReader({
  file,
  initialProgress,
  onProgressChange,
}: EpubReaderProps) {
  const readerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRequestRef = useRef(0);
  const restoredOffsetRef = useRef<number | null>(null);
  const [book, setBook] = useState<EpubDocument | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chapterProgress, setChapterProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAttempt, setSaveAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let loadedBook: EpubDocument | null = null;

    void extractEpub(file, (completed, total) => {
      if (active && total > 0) setLoadProgress(Math.round((completed / total) * 100));
    })
      .then((result) => {
        loadedBook = result;
        if (!active) {
          result.imageUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }
        const restoredPosition = getChapterPosition(
          initialProgress,
          result.chapters.length,
        );
        restoredOffsetRef.current = restoredPosition.offset;
        setBook(result);
        setChapterIndex(restoredPosition.index);
        setChapterProgress(restoredPosition.offset);
        setLoading(false);
      })
      .catch((caughtError: unknown) => {
        if (!active) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível abrir este EPUB.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
      loadedBook?.imageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file, initialProgress]);

  useEffect(() => {
    const content = contentRef.current;
    if (!book || !content) return;

    const offset = restoredOffsetRef.current;
    restoredOffsetRef.current = null;
    content.scrollTop = offset === null ? 0 : (content.scrollHeight - content.clientHeight) * offset;
  }, [book, chapterIndex]);

  const currentProgress = book
    ? Math.min(
        100,
        Math.max(
          1,
          Math.round(((chapterIndex + chapterProgress) / book.chapters.length) * 100),
        ),
      )
    : 0;

  useEffect(() => {
    if (!book) return;
    let active = true;
    const requestId = ++saveRequestRef.current;
    const timeoutId = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => {})
        .then(() => {
          if (!active || requestId !== saveRequestRef.current) return;
          setSaveStatus("saving");
          setSaveError(null);
          return onProgressChange(currentProgress);
        })
        .then(() => {
          if (active && requestId === saveRequestRef.current) {
            setSaveStatus("saved");
          }
        })
        .catch((caughtError: unknown) => {
          if (active && requestId === saveRequestRef.current) {
            setSaveError(
              caughtError instanceof Error
                ? caughtError.message
                : "Erro desconhecido ao sincronizar o progresso.",
            );
            setSaveStatus("error");
          }
        });
    }, 500);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [book, currentProgress, onProgressChange, saveAttempt]);

  const changeChapter = useCallback(
    (direction: number) => {
      if (!book) return;
      setChapterIndex((current) =>
        Math.min(book.chapters.length - 1, Math.max(0, current + direction)),
      );
      setChapterProgress(0);
    },
    [book],
  );

  function handleScroll() {
    const content = contentRef.current;
    if (!content) return;
    const scrollRange = content.scrollHeight - content.clientHeight;
    setChapterProgress(
      scrollRange > 0 ? content.scrollTop / scrollRange : 1,
    );
  }

  function handlePageClick(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || !(event.target instanceof HTMLElement)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    changeChapter(event.clientX >= bounds.left + bounds.width / 2 ? 1 : -1);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowLeft") changeChapter(-1);
      if (event.key === "ArrowRight") changeChapter(1);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeChapter]);

  if (loading) {
    return (
      <ReaderLoading
        title="Preparando seu EPUB"
        detail={`Organizando capítulos e ilustrações… ${loadProgress}%`}
        percent={loadProgress}
      />
    );
  }

  if (error || !book || book.chapters.length === 0) {
    return (
      <p role="alert" className="m-auto max-w-lg p-8 text-center text-rose-200">
        {error ?? "Este EPUB não possui capítulos compatíveis para leitura."}
      </p>
    );
  }

  const currentChapter = book.chapters[chapterIndex];

  return (
    <section
      ref={readerRef}
      aria-label="Leitor de EPUB"
      className="flex min-h-[72dvh] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151827] shadow-2xl shadow-black/25"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#202435]/90 px-3 py-2.5 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <BookOpen
            aria-hidden="true"
            size={18}
            className="shrink-0 text-violet-200"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{book.title}</p>
            <p className="truncate text-xs text-slate-400">
              {currentChapter.title}
            </p>
          </div>
        </div>
        <span
          aria-live="polite"
          className="shrink-0 text-xs font-semibold tabular-nums text-slate-300"
        >
          Capítulo {chapterIndex + 1} de {book.chapters.length}
        </span>
      </header>

      <div className="grid flex-1 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-stretch gap-1 overflow-hidden bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.07),transparent_65%)] p-2 sm:gap-3 sm:p-4">
        <button
          type="button"
          onClick={() => changeChapter(-1)}
          disabled={chapterIndex === 0}
          aria-label="Capítulo anterior"
          className="z-10 my-auto inline-flex size-10 items-center justify-center justify-self-center rounded-full border border-white/10 bg-[#202435]/90 text-slate-200 shadow-lg transition hover:border-violet-200/30 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div
          ref={contentRef}
          onScroll={handleScroll}
          onClick={handlePageClick}
          className="min-w-0 overflow-y-auto rounded-xl px-4 py-6 sm:px-8 sm:py-10 lg:px-14"
        >
          <article className="mx-auto max-w-3xl">
            {renderContent(currentChapter.content, currentChapter.id)}
          </article>
        </div>
        <button
          type="button"
          onClick={() => changeChapter(1)}
          disabled={chapterIndex === book.chapters.length - 1}
          aria-label="Próximo capítulo"
          className="z-10 my-auto inline-flex size-10 items-center justify-center justify-self-center rounded-full border border-white/10 bg-[#202435]/90 text-slate-200 shadow-lg transition hover:border-violet-200/30 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>

      <footer className="flex min-h-11 items-center justify-between gap-3 border-t border-white/[0.08] bg-[#202435]/70 px-3 text-xs text-slate-400 sm:px-4">
        <span
          className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-violet-100"
          aria-label={`${currentProgress}% do EPUB lido`}
        >
          <BookOpen aria-hidden="true" size={15} className="text-violet-200" />
          {currentProgress}% <span className="hidden sm:inline">lido</span>
        </span>
        <button
          type="button"
          onClick={() => {
            if (document.fullscreenElement) {
              void document.exitFullscreen();
            } else {
              void readerRef.current?.requestFullscreen();
            }
          }}
          aria-label="Alternar tela cheia"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200"
        >
          <Maximize aria-hidden="true" size={16} />
        </button>
        {saveStatus === "saving" && (
          <span role="status" className="inline-flex min-w-0 items-center gap-1.5">
            <LoaderCircle
              aria-hidden="true"
              size={14}
              className="shrink-0 animate-spin text-violet-200"
            />
            <span className="truncate">Salvando progresso…</span>
          </span>
        )}
        {saveStatus === "saved" && (
          <span role="status" className="inline-flex items-center gap-1.5">
            <CircleCheck
              aria-hidden="true"
              size={14}
              className="text-emerald-300"
            />
            Progresso salvo
          </span>
        )}
        {saveStatus === "error" && (
          <span className="flex min-w-0 items-center gap-1.5 text-rose-200">
            <CircleAlert aria-hidden="true" size={14} className="shrink-0" />
            <span className="truncate" title={saveError ?? undefined}>
              {saveError ?? "Não foi possível sincronizar o progresso."}
            </span>
            <button
              type="button"
              onClick={() => setSaveAttempt((attempt) => attempt + 1)}
              className="shrink-0 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-violet-200"
            >
              Tentar novamente
            </button>
          </span>
        )}
      </footer>
    </section>
  );
}
