import { useCallback, useEffect, useRef, useState } from "react";

import { getBookCount, getRecentBooks } from "../services/booksService";
import {
  getProgressCounts,
  getRecentReads,
} from "../services/progressService";
import { getUserStorage } from "../services/storageService";
import type { Book, RecentRead, UserStorage } from "../types/database";

export interface DashboardData {
  books: Book[];
  recentReads: RecentRead[];
  totalBooks: number;
  inProgressCount: number;
  completedCount: number;
  storage: UserStorage;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const [
        books,
        recentReads,
        totalBooks,
        progressCounts,
        storage,
      ] = await Promise.all([
        getRecentBooks(),
        getRecentReads(),
        getBookCount(),
        getProgressCounts(),
        getUserStorage(),
      ]);

      if (requestId.current !== currentRequestId) return;
      setData({
        books,
        recentReads,
        totalBooks,
        inProgressCount: progressCounts.inProgress,
        completedCount: progressCounts.completed,
        storage,
      });
    } catch (caughtError) {
      if (requestId.current !== currentRequestId) return;
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocorreu um erro inesperado ao carregar o painel.",
      );
    } finally {
      if (requestId.current === currentRequestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return reload();
    });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [reload]);

  return { data, loading, error, reload };
}
