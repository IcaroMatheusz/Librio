import { useEffect, useState, type ReactNode } from "react";
import { BookOpen } from "lucide-react";

import { AppFooter } from "../AppFooter";

const PHRASES = [
  "Seus livros.",
  "Seus quadrinhos.",
  "Seus mangás.",
  "Suas histórias.",
];

interface AuthPageLayoutProps {
  backgroundImage: string;
  mobileBackgroundImage: string;
  children: ReactNode;
}

export function AuthPageLayout({
  backgroundImage,
  mobileBackgroundImage,
  children,
}: AuthPageLayoutProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intervalId = window.setInterval(() => {
      setPhraseIndex((index) => (index + 1) % PHRASES.length);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <main className="relative grid min-h-screen min-h-dvh overflow-hidden bg-[#2F3447] lg:grid-cols-[46%_54%]">
      <section className="relative isolate flex min-h-screen min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-6 sm:px-8 sm:py-10 lg:px-8 xl:px-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat lg:hidden"
          style={{ backgroundImage: `url("${mobileBackgroundImage}")` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[#171A27]/55 via-[#2F3447]/75 to-[#2F3447]/95 lg:hidden"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[6%] top-[10%] -z-10 hidden size-72 rounded-full bg-indigo-500/25 blur-3xl lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[6%] -right-[4%] -z-10 hidden size-80 rounded-full bg-purple-500/20 blur-3xl lg:block"
        />

        <header className="relative z-10 mb-5 flex items-center gap-3 text-white md:mb-8 lg:hidden">
          <span className="flex size-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md md:size-14">
            <BookOpen aria-hidden="true" className="size-5 md:size-7" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight md:text-4xl">
            Librio
          </span>
        </header>

        {children}

        <AppFooter className="relative z-10 mt-6 md:mt-8" />
      </section>

      <aside className="relative hidden overflow-hidden lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center anim-kenburns"
          style={{ backgroundImage: `url("${backgroundImage}")` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#171A27]/80 via-[#171A27]/50 to-[#171A27]/20"
        />

        <section className="relative z-10 flex w-full flex-col justify-end p-10 text-white xl:p-20">
          <div className="anim-fade-up" style={{ animationDelay: "150ms" }}>
            <div className="relative mb-5 w-fit anim-float">
              <div
                aria-hidden="true"
                className="absolute -inset-5 rounded-full bg-indigo-400/40 blur-2xl anim-glow"
              />
              <span className="relative flex size-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md">
                <BookOpen aria-hidden="true" size={34} />
              </span>
            </div>
          </div>

          <h2
            className="anim-fade-up max-w-xl text-6xl font-extrabold tracking-tight xl:text-7xl"
            style={{ animationDelay: "300ms" }}
          >
            Librio<span className="text-indigo-300">.</span>
          </h2>
          <div className="anim-fade-up mt-4 max-w-md" style={{ animationDelay: "450ms" }}>
            <p className="sr-only">
              Seus livros, seus quadrinhos, suas histórias. Tudo em um só lugar.
            </p>
            <p
              aria-hidden="true"
              className="text-3xl font-bold leading-snug xl:text-4xl"
            >
              <span
                key={PHRASES[phraseIndex]}
                className="anim-word inline-block text-indigo-300"
              >
                {PHRASES[phraseIndex]}
              </span>
            </p>
            <p aria-hidden="true" className="mt-1 text-lg text-white/85 xl:text-xl">
              Tudo em um só lugar.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="anim-bar mt-10 h-1 w-20 rounded-full bg-indigo-300"
            style={{ animationDelay: "700ms" }}
          />
        </section>
      </aside>
    </main>
  );
}
