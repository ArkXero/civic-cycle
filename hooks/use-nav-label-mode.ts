'use client'

import { useSyncExternalStore } from 'react'

/**
 * Top-nav display preference: "labels" shows each tab's name next to its icon,
 * "icons" shows icons only and reveals the name on hover/focus.
 * A per-device convenience, so it lives in localStorage rather than the profile.
 */
export type NavLabelMode = 'labels' | 'icons'

const STORAGE_KEY = 'civic-cycle:nav-label-mode'
const CHANGE_EVENT = 'civic-cycle:nav-label-mode-change'
const DEFAULT_MODE: NavLabelMode = 'labels'

function readMode(): NavLabelMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'icons' ? 'icons' : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

export function setNavLabelMode(mode: NavLabelMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Storage blocked (private mode etc.) — nothing to persist to, so the default stays.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useNavLabelMode(): NavLabelMode {
  return useSyncExternalStore(subscribe, readMode, () => DEFAULT_MODE)
}

/** Subscribes to a CSS media query; false during SSR. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
