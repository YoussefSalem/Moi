import { useState, useEffect, useRef, useCallback } from "react";
import type { ReviewItem } from "./ProductReviews";

const PAGE_SIZE = 12;

interface ReviewsPage {
  reviews: ReviewItem[];
  nextCursor: number | null;
  total: number;
  avgRating: number;
}

export interface ReviewsPaginationState {
  reviews: ReviewItem[];
  total: number;
  avgRating: number;
  initialLoaded: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  retry: () => void;
}

export function useReviewsPagination(
  handle: string,
  variantId: string | undefined,
): ReviewsPaginationState {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref-tracked length to avoid stale closures when computing batch base
  const reviewsLengthRef = useRef(0);
  const inflightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Generation counter: each new fetchPage call increments this; the finally
  // block only clears state if the generation still matches, preventing a
  // stale abort's finally from resetting the in-flight lock of a newer fetch.
  const fetchGenRef = useRef(0);

  const buildUrl = useCallback(
    (cursor: number | null) => {
      const params = new URLSearchParams();
      params.set("handle", handle);
      if (variantId) params.set("variantId", variantId);
      params.set("limit", String(PAGE_SIZE));
      if (cursor !== null) params.set("cursor", String(cursor));
      return `/api/reviews/public?${params.toString()}`;
    },
    [handle, variantId],
  );

  const fetchPage = useCallback(
    async (cursor: number | null, isInitial: boolean) => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      const fetchId = ++fetchGenRef.current;

      // Cancel any previous in-flight request
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const res = await fetch(buildUrl(cursor), { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ReviewsPage;

        setReviews((prev) => {
          const next = isInitial ? data.reviews : [...prev, ...data.reviews];
          reviewsLengthRef.current = next.length;
          return next;
        });

        setNextCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
        setTotal(data.total);
        setAvgRating(data.avgRating);
        setInitialLoaded(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Couldn't load reviews.");
      } finally {
        // Only clear state for the fetch that is still current.
        // Without this guard, an aborted request's finally block would clear
        // inflightRef for the newer request that replaced it.
        if (fetchGenRef.current === fetchId) {
          inflightRef.current = false;
          if (isInitial) setLoading(false);
          else setLoadingMore(false);
        }
      }
    },
    [buildUrl],
  );

  // Reset and re-fetch whenever handle or variantId changes
  useEffect(() => {
    setReviews([]);
    reviewsLengthRef.current = 0;
    setNextCursor(null);
    setHasMore(true);
    setInitialLoaded(false);
    setError(null);
    inflightRef.current = false;
    void fetchPage(null, true);

    return () => {
      abortRef.current?.abort();
      inflightRef.current = false;
    };
  }, [handle, variantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (!hasMore || inflightRef.current || loadingMore) return;
    void fetchPage(nextCursor, false);
  }, [hasMore, nextCursor, fetchPage, loadingMore]);

  const retry = useCallback(() => {
    const isInitial = reviews.length === 0;
    void fetchPage(isInitial ? null : nextCursor, isInitial);
  }, [fetchPage, reviews.length, nextCursor]);

  return {
    reviews,
    total,
    avgRating,
    initialLoaded,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    retry,
  };
}
