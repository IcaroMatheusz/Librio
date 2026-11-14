import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <article className="anim-fade-up relative z-10 w-full max-w-sm rounded-3xl border border-white/60 bg-gradient-to-br from-[#FAF8FF] to-[#E9E1F5] p-5 shadow-[0_30px_70px_-15px_rgba(10,8,25,0.65)] ring-1 ring-black/5 sm:max-w-md sm:p-8 md:p-10 lg:max-w-md lg:p-9 xl:p-11">
      <header className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#202330] sm:text-4xl md:text-5xl lg:text-4xl xl:text-5xl">
          {title}
        </h1>
      </header>

      <section>{children}</section>

      <footer className="mt-6 border-t border-[#2F3447]/10 pt-5 text-center md:mt-8 md:pt-6">
        {footer}
      </footer>
    </article>
  );
}
