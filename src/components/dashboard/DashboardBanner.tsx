
import { BookOpen, Sparkles } from "lucide-react";
import zatanna from "../../assets/zatanna.webp";

export function DashboardBanner() {
  return (
    <section
      aria-labelledby="librio-banner-title"
      className="relative isolate overflow-hidden rounded-[2rem] border border-violet-200/20 bg-[#211d36] shadow-[0_24px_70px_-30px_rgba(124,58,237,0.6)]"
    >
      {/* Background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(221,214,254,.48) 1px, transparent 1.5px)",
          backgroundSize: "18px 18px",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute -right-32 -top-32 -z-10 size-96 rounded-full bg-violet-500/25 blur-3xl"
      />

      <div className="relative grid min-h-[540px] grid-cols-1 lg:min-h-[390px] lg:grid-cols-[1fr_0.85fr]">

        {/* Content */}
        <div className="relative z-20 flex flex-col items-start px-6 pt-10 pb-4 sm:px-10 sm:pt-12 lg:justify-center lg:px-14 lg:py-12">

          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/25 bg-[#171426]/65 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-violet-100">
            <Sparkles size={14} aria-hidden="true" />
            Seu universo de leitura
          </span>

          <h1
            id="librio-banner-title"
            className="mt-5 text-5xl font-black tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl"
          >
            Librio<span className="text-violet-300">.</span>
          </h1>

          <p className="mt-3 max-w-md text-base leading-7 text-violet-100/85 sm:text-lg">
            Um cantinho só seu para guardar histórias e voltar sempre à página
            onde parou.
          </p>

          <div className="mt-6 inline-flex -rotate-2 items-center gap-2 border-2 border-amber-200/80 bg-amber-200 px-3 py-2 text-xs font-black uppercase tracking-wider text-[#302347] shadow-[3px_4px_0_rgba(15,10,30,0.5)] sm:text-sm">
            <BookOpen size={17} aria-hidden="true" />
            Vire a página
          </div>
        </div>

        {/* Zatanna */}

{/* Zatanna */}
<div
  aria-hidden="true"
  className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-[65%] items-end justify-end lg:w-[62%]"
>
  {/* Iluminação */}
  <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-violet-500/35 blur-[80px] sm:h-96 sm:w-96" />

  <img
    src={zatanna}
    alt=""
    className="
      relative z-10
      h-[85%] w-full
      object-contain object-bottom
      scale-125 origin-bottom-right
      drop-shadow-[0_10px_35px_rgba(8,5,30,0.7)]
      sm:h-[95%]
      sm:scale-125
      lg:h-[125%]
      lg:w-auto
      lg:max-w-none
      lg:scale-[1.4]
      lg:translate-x-[5%]
      lg:translate-y-[39%]
    "
  />
</div>

        {/* Desktop decorative gradient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-[60%] bg-gradient-to-r from-[#211d36] via-transparent to-transparent lg:block"
        />

      </div>

      {/* Decorative stamp */}
      <span
        aria-hidden="true"
        className="absolute right-5 top-5 z-20 hidden rotate-6 rounded-md border border-white/20 bg-fuchsia-300 px-2.5 py-1 text-xs font-black uppercase tracking-widest text-[#271b3d] shadow-md sm:block"
      >
        Leitura em boa companhia
      </span>
    </section>
  );
}
