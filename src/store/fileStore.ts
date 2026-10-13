import { create } from 'zustand';
import type { SaveStatus, BoardManifest } from '../types';

interface FileStoreState {
  handle: FileSystemFileHandle | null;
  filename: string;
  saveStatus: SaveStatus;
  lastSaved: string | null;
  manifest: BoardManifest | null;
  isEncrypted: boolean;
  passphrase: string | null;
  setHandle: (handle: FileSystemFileHandle | null, filename: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setLastSaved: (ts: string) => void;
  setManifest: (manifest: BoardManifest) => void;
  setEncryption: (isEncrypted: boolean, passphrase: string | null) => void;
  reset: () => void;
}

export const useFileStore = create<FileStoreState>((set) => ({
  handle: null,
  filename: '',
  saveStatus: 'saved',
  lastSaved: null,
  manifest: null,
  isEncrypted: false,
  passphrase: null,

  setHandle: (handle, filename) => set({ handle, filename }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setLastSaved: (lastSaved) => set({ lastSaved }),
  setManifest: (manifest) => set({ manifest }),
  setEncryption: (isEncrypted, passphrase) => set({ isEncrypted, passphrase }),
  reset: () => set({ handle: null, filename: '', saveStatus: 'saved', lastSaved: null, manifest: null, isEncrypted: false, passphrase: null }),
}));
