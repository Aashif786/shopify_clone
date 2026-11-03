"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StorefrontLandingPageConfig } from "@calcart/stores/landing-page";

export type HistoryCategory = "element" | "layout" | "section" | "theme";

export interface HistoryEntry {
  id: string;
  config: StorefrontLandingPageConfig;
  description: string;
  category: HistoryCategory;
  timestamp: number;
}

export interface UseEditorHistoryOptions {
  maxHistory?: number;
  debounceMs?: number;
}

export function useEditorHistory(
  initialConfig: StorefrontLandingPageConfig | null,
  options: UseEditorHistoryOptions = {},
) {
  const maxHistory = options.maxHistory ?? 50;
  const debounceMs = options.debounceMs ?? 700;

  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [present, setPresent] = useState<StorefrontLandingPageConfig | null>(initialConfig);
  const [future, setFuture] = useState<HistoryEntry[]>([]);

  // Ref to hold the latest present for synchronous reads inside callbacks and event handlers
  const presentRef = useRef<StorefrontLandingPageConfig | null>(initialConfig);
  presentRef.current = present;

  // Active debounce state for grouping rapid keystrokes or slider drags
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeDebounceKeyRef = useRef<string | null>(null);

  // Synchronize initialConfig when loaded from server or reset
  const resetHistory = useCallback((config: StorefrontLandingPageConfig) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    activeDebounceKeyRef.current = null;
    presentRef.current = config;
    setPresent(config);
    setPast([]);
    setFuture([]);
  }, []);

  /**
   * Records a state change. If debounceKey is provided and matches an ongoing
   * debounce transaction within debounceMs, updates present in-place without pushing duplicate past snapshots.
   */
  const applyChange = useCallback(
    (
      newConfig: StorefrontLandingPageConfig,
      description: string,
      category: HistoryCategory = "element",
      debounceKey?: string,
    ) => {
      const currentPresent = presentRef.current;
      if (!currentPresent) {
        presentRef.current = newConfig;
        setPresent(newConfig);
        return;
      }

      // Check for identical configurations to prevent redundant snapshots
      if (JSON.stringify(currentPresent) === JSON.stringify(newConfig)) {
        return;
      }

      const now = Date.now();
      const entryId = `hist_${now}_${Math.random().toString(36).substring(2, 6)}`;

      if (debounceKey && activeDebounceKeyRef.current === debounceKey) {
        // Group with active debounce session: update present directly and reset timer
        presentRef.current = newConfig;
        setPresent(newConfig);

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          activeDebounceKeyRef.current = null;
          debounceTimerRef.current = null;
        }, debounceMs);
        return;
      }

      // If switching debounce keys or starting a new transaction
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (debounceKey) {
        activeDebounceKeyRef.current = debounceKey;
        debounceTimerRef.current = setTimeout(() => {
          activeDebounceKeyRef.current = null;
          debounceTimerRef.current = null;
        }, debounceMs);
      } else {
        activeDebounceKeyRef.current = null;
      }

      // Commit current present to past and push new present
      const newPastEntry: HistoryEntry = {
        id: entryId,
        config: currentPresent,
        description,
        category,
        timestamp: now,
      };

      setPast((prev) => {
        const next = [...prev, newPastEntry];
        return next.length > maxHistory ? next.slice(next.length - maxHistory) : next;
      });

      presentRef.current = newConfig;
      setPresent(newConfig);
      setFuture([]); // Abandon redo branch on new edits
    },
    [debounceMs, maxHistory],
  );

  /**
   * Undo operation: pops latest from past, pushes current present to future
   */
  const undo = useCallback((): StorefrontLandingPageConfig | null => {
    if (past.length === 0 || !presentRef.current) return null;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      activeDebounceKeyRef.current = null;
    }

    const current = presentRef.current;
    const previousEntry = past[past.length - 1];
    if (!previousEntry) return null;

    const remainingPast = past.slice(0, past.length - 1);
    const newFutureEntry: HistoryEntry = {
      id: `future_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      config: current,
      description: previousEntry.description,
      category: previousEntry.category,
      timestamp: Date.now(),
    };

    setPast(remainingPast);
    presentRef.current = previousEntry.config;
    setPresent(previousEntry.config);
    setFuture((prev) => [newFutureEntry, ...prev]);

    return previousEntry.config;
  }, [past]);

  /**
   * Redo operation: pops earliest from future, pushes current present to past
   */
  const redo = useCallback((): StorefrontLandingPageConfig | null => {
    if (future.length === 0 || !presentRef.current) return null;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      activeDebounceKeyRef.current = null;
    }

    const current = presentRef.current;
    const nextEntry = future[0];
    if (!nextEntry) return null;

    const remainingFuture = future.slice(1);
    const newPastEntry: HistoryEntry = {
      id: `past_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      config: current,
      description: nextEntry.description,
      category: nextEntry.category,
      timestamp: Date.now(),
    };

    setPast((prev) => {
      const next = [...prev, newPastEntry];
      return next.length > maxHistory ? next.slice(next.length - maxHistory) : next;
    });

    presentRef.current = nextEntry.config;
    setPresent(nextEntry.config);
    setFuture(remainingFuture);

    return nextEntry.config;
  }, [future, maxHistory]);

  /**
   * Jump to a specific past state by index
   */
  const jumpToPast = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= past.length || !presentRef.current) return;

      const current = presentRef.current;
      const target = past[targetIndex];
      if (!target) return;

      const remainingPast = past.slice(0, targetIndex);
      const intermediatePast = past.slice(targetIndex + 1);

      // Create future entries for the current and skipped past entries
      const skippedFutureEntries: HistoryEntry[] = [
        ...intermediatePast.map((p) => ({ ...p, id: `f_${p.id}` })),
        {
          id: `f_curr_${Date.now()}`,
          config: current,
          description: target.description,
          category: target.category,
          timestamp: Date.now(),
        },
      ];

      setPast(remainingPast);
      presentRef.current = target.config;
      setPresent(target.config);
      setFuture((prev) => [...skippedFutureEntries, ...prev]);
    },
    [past],
  );

  /**
   * Jump to a specific future state by index
   */
  const jumpToFuture = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= future.length || !presentRef.current) return;

      const current = presentRef.current;
      const target = future[targetIndex];
      if (!target) return;

      const advancedPastEntries: HistoryEntry[] = [
        {
          id: `p_curr_${Date.now()}`,
          config: current,
          description: target.description,
          category: target.category,
          timestamp: Date.now(),
        },
        ...future.slice(0, targetIndex).map((f) => ({ ...f, id: `p_${f.id}` })),
      ];

      const remainingFuture = future.slice(targetIndex + 1);

      setPast((prev) => [...prev, ...advancedPastEntries]);
      presentRef.current = target.config;
      setPresent(target.config);
      setFuture(remainingFuture);
    },
    [future],
  );

  // Global Keyboard Shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept shortcuts when user is focused inside an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Undo: Ctrl+Z / Cmd+Z
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y
      if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    past,
    present,
    future,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    applyChange,
    undo,
    redo,
    jumpToPast,
    jumpToFuture,
    resetHistory,
  };
}
