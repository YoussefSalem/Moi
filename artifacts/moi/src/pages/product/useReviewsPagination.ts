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
  batchBase: number;
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
  // batchBase tracks the index of the first review in the current batch,
  // used by ProductReviews to stagger animations only for newly loaded cards.
  const [batchBase, setBatchBase] = useState(0);

  // Ref-tracked length to avoid stale closures when computing batch base
  const reviewsLengthRef = useRef(0);
  const inflightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

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

        const base = isInitial ? 0 : reviewsLengthRef.current;
        setBatchBase(base);

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
        inflightRef.current = false;
        if (isInitial) setLoading(false);
        else setLoadingMore(false);
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
    setBatchBase(0);
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
    batchBase,
    initialLoaded,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    retry,
  };
}
