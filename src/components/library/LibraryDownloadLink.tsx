import { Download } from "lucide-react";
import { Link } from "react-router-dom";

export function LibraryDownloadLink() {
  return (
    <Link
      to="/download"
      className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-200/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-200 sm:text-sm"
    >
      <Download aria-hidden="true" size={16} className="text-violet-200" />
      Baixar aplicativo Librio
    </Link>
  );
}
