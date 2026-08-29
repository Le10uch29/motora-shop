"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { searchProductSuggestionsAction, type SearchSuggestion } from "@/lib/actions/search";
import type { Locale } from "@/i18n/locales";

const DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

export function useSearchSuggestions(
  query: string,
  locale: Locale,
  options?: { brandSlug?: string; containerRef?: RefObject<HTMLElement | null> }
): {
  results: SearchSuggestion[];
  total: number;
  loading: boolean;
  open: boolean;
  highlightedIndex: number;
  close: () => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>, onSelect: (result: SearchSuggestion) => void) => void;
} {
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Reopens on every new keystroke even after a prior Escape/outside-click
  // dismissal — compared during render (not in an effect) the same way
  // HeaderSearch already re-syncs its own local state from the URL.
  const [dismissed, setDismissed] = useState(false);
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setDismissed(false);
  }

  const trimmed = query.trim();
  const open = trimmed.length >= MIN_QUERY_LENGTH && !dismissed;

  const requestIdRef = useRef(0);
  const brandSlug = options?.brandSlug;
  const containerRef = options?.containerRef;

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const q = query.trim();

    const timeout = setTimeout(
      () => {
        if (requestIdRef.current !== requestId) return;
        if (q.length < MIN_QUERY_LENGTH) {
          setResults([]);
          setTotal(0);
          setLoading(false);
          setHighlightedIndex(-1);
          return;
        }
        setLoading(true);
        searchProductSuggestionsAction(locale, q, brandSlug).then((res) => {
          if (requestIdRef.current !== requestId) return;
          setResults(res.results);
          setTotal(res.total);
          setLoading(false);
          setHighlightedIndex(-1);
        });
      },
      q.length < MIN_QUERY_LENGTH ? 0 : DEBOUNCE_MS
    );

    return () => clearTimeout(timeout);
  }, [query, locale, brandSlug]);

  function close() {
    setDismissed(true);
  }

  // Closing on an outside click needs the real DOM here (which element the
  // click landed on) — not something derivable from render-phase state, so
  // this is a legitimate effect. setDismissed only runs inside the
  // (asynchronous) listener callback, never synchronously in the effect body.
  useEffect(() => {
    if (!containerRef) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef?.current && !containerRef.current.contains(event.target as Node)) {
        setDismissed(true);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [containerRef]);

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    onSelect: (result: SearchSuggestion) => void
  ) {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      onSelect(results[highlightedIndex]);
    } else if (event.key === "Escape") {
      close();
    }
  }

  return { results, total, loading, open, highlightedIndex, close, handleKeyDown };
}
