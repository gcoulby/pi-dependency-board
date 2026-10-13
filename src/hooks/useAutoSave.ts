import { useEffect } from 'react';
import { useBoardStore, getBoardConfig } from '../store/boardStore';
import { useCardStore } from '../store/cardStore';
import { useViewStore } from '../store/viewStore';
import { useFileStore } from '../store/fileStore';
import { writeBoard } from '../file/boardWriter';
import { writeBoardFile, downloadBlob } from '../file/fileHandle';
import { encryptBlob } from '../lib/crypto';

const DEBOUNCE_MS = 1500;

// Asset map lives outside Zustand
export const assetMap = new Map<string, ArrayBuffer>();
export const contentMap = new Map<string, unknown>();
export const contentDirty = new Set<string>();

let currentFileBlob: Blob | null = null;
export function setCurrentFileBlob(blob: Blob) { currentFileBlob = blob; }
export function getCurrentFileBlob() { return currentFileBlob; }

/** Forget everything held for the previous file. */
export function resetSessionData() {
  currentFileBlob = null;
  assetMap.clear();
  contentMap.clear();
  contentDirty.clear();
}

// ── Change tracking ───────────────────────────────────────────────────────────
// Only real edits schedule a save. The latest viewport is read from the store at
// write time, so panning and zooming never rewrite the archive on their own.

let suppressed = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let viewportDirty = false;
let savedViewport = useViewStore.getState().viewport;

/** Run store updates that load a file, so they do not count as edits. */
export function withoutAutoSave<T>(fn: () => T): T {
  suppressed++;
  try {
    return fn();
  } finally {
    suppressed--;
    clearPending();
    savedViewport = useViewStore.getState().viewport;
    viewportDirty = false;
  }
}

function clearPending() {
  if (timer) { clearTimeout(timer); timer = null; }
}

// ── Shared write logic ────────────────────────────────────────────────────────

async function performSave(): Promise<void> {
  const { handle, filename, manifest, passphrase, setSaveStatus, setLastSaved } = useFileStore.getState();
  if (!manifest) return;
  const { cards, dependencies } = useCardStore.getState();
  const { viewport } = useViewStore.getState();

  const blob = await writeBoard({
    manifest, config: getBoardConfig(), cards, dependencies, viewport,
    existingFile: currentFileBlob, contentDirty, contentMap, assetMap,
  });

  // Keep the unencrypted blob in memory for future merges
  currentFileBlob = blob;
  contentDirty.clear();
  savedViewport = viewport;
  viewportDirty = false;

  // Encrypt before writing to disk if a passphrase is active
  const diskBlob = passphrase ? await encryptBlob(blob, passphrase) : blob;

  if (handle) await writeBoardFile(handle, diskBlob);
  else downloadBlob(diskBlob, filename);

  setSaveStatus('saved');
  setLastSaved(new Date().toISOString());
}

// ── Imperative save (bypasses debounce) ───────────────────────────────────────

export async function saveNow(): Promise<void> {
  const { manifest, setSaveStatus } = useFileStore.getState();
  if (!manifest) return;
  clearPending();
  setSaveStatus('saving');
  try {
    await performSave();
  } catch (err) {
    console.error('saveNow failed', err);
    setSaveStatus('error');
  }
}

function scheduleSave() {
  if (suppressed > 0) return;
  if (!useFileStore.getState().manifest) return;
  useFileStore.getState().setSaveStatus('unsaved');
  clearPending();
  timer = setTimeout(() => {
    timer = null;
    void saveNow();
  }, DEBOUNCE_MS);
}

// ── Debounced auto-save hook ───────────────────────────────────────────────────

export function useAutoSave() {
  useEffect(() => {
    const unsubs = [
      useBoardStore.subscribe(scheduleSave),
      useCardStore.subscribe(scheduleSave),
      // A pan or zoom only marks the viewport dirty. It rides along with the next real save.
      useViewStore.subscribe((s, prev) => {
        if (s.viewport !== prev.viewport && s.viewport !== savedViewport) viewportDirty = true;
      }),
    ];

    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!useFileStore.getState().manifest) return;
      if (timer || viewportDirty) void saveNow();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unsubs.forEach((u) => u());
      document.removeEventListener('visibilitychange', onVisibility);
      clearPending();
    };
  }, []);
}
