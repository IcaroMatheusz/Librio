import { ArrowRight, BookOpen, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";

import type { VolumeDashboardRead } from "../../services/volumesService";

export function DashboardVolumesSection({
  volumes,
}: {
  volumes: VolumeDashboardRead[];
}) {
  if (volumes.length === 0) return null;

  return (
    <section aria-labelledby="dashboard-volumes-title" className="min-w-0">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
            Leituras organizadas
          </p>
          <h2 id="dashboard-volumes-title" className="mt-1 text-xl font-bold">
            Seus volumes
          </h2>
        </div>
        <Link
          to="/library"
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-violet-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-violet-200"
        >
          Biblioteca <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {volumes.map((volume) => {
          const cover = volume.chapters[0]?.book.cover_url;
          return (
            <Link
              key={volume.id}
              to={`/volume/${volume.id}`}
              state={{ returnTo: "/dashboard" }}
              className="group flex min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-[#202435] p-4 transition hover:border-violet-300/40 hover:bg-[#252a3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200"
            >
              <div className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-violet-300/10">
                {cover ? (
                  <img
                    src={cover}
                    alt={`Capa do volume ${volume.title}`}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-violet-200">
                    <BookOpen aria-hidden="true" size={25} />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 rounded-md bg-[#171A27]/90 p-1 text-violet-100">
                  <Layers3 aria-hidden="true" size={13} />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-white">{volume.title}</h3>
                <p className="mt-1 truncate text-xs text-slate-400">
                  Capítulo {volume.chapterNumber} de {volume.chapters.length}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-300">
                  <span>Progresso do volume</span>
                  <span className="font-semibold text-violet-100">{volume.progress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Progresso de ${volume.title}: ${volume.progress}%`}
                  aria-valuenow={volume.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/30"
                >
                  <div
                    className="h-full rounded-full bg-violet-300 transition-[width]"
                    style={{ width: `${volume.progress}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
