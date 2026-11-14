export interface LibraryNoticeData {
  message: string;
  type: "success" | "warning" | "error";
}

interface LibraryNoticeProps {
  notice: LibraryNoticeData | null;
}

export function LibraryNotice({ notice }: LibraryNoticeProps) {
  if (!notice) return null;

  const colorClass =
    notice.type === "error"
      ? "border-rose-200/15 bg-rose-200/[0.05] text-rose-100"
      : notice.type === "warning"
        ? "border-amber-200/15 bg-amber-200/[0.05] text-amber-100"
        : "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100";

  return (
    <p
      role={notice.type === "error" ? "alert" : "status"}
      className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-6 ${colorClass}`}
    >
      {notice.message}
    </p>
  );
}
