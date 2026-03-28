// lib/storage.ts
"use client";

import type { AppState } from "./state";

const STORAGE_KEY = "alcohol-pwa-state";

export function loadFromStorage(): AppState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export function saveToStorage(state: AppState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 失敗してもアプリは止めない
  }
}
