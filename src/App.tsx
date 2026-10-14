import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { useBoardStore, getBoardConfig } from './store/boardStore';
import { useCardStore } from './store/cardStore';
import { useViewStore } from './store/viewStore';
import { useFileStore } from './store/fileStore';
import {
  openBoardFile,
  createBoardFile,
  writeBoardFile,
  downloadBlob,
  saveHandleToIDB,
  getHandleFromIDB,
} from './file/fileHandle';
import { readBoard } from './file/boardReader';
import { writeBoard } from './file/boardWriter';
import { createDefaultBoard } from './board/defaults';
import type { Cell } from './board/layout';
import { isEncryptedBuffer, decryptBlob, encryptBlob } from './lib/crypto';
import { OpenOrCreateDialog, type CreateBoardOptions } from './components/dialogs/OpenOrCreateDialog';
import { PasswordDialog } from './components/dialogs/PasswordDialog';
import { NewCardDialog, type NewCardValues } from './components/dialogs/NewCardDialog';
import { DependencyDialog } from './components/dialogs/DependencyDialog';
import { BoardSettingsDialog } from './components/dialogs/BoardSettingsDialog';
import { InfoPanel } from './components/dialogs/InfoPanel';
import { ExportDialog } from './components/dialogs/ExportDialog';
import { FileExplorer } from './components/dialogs/FileExplorer';
// BlockNote is heavy and only needed when a card's detail is opened
const ContentEditor = lazy(() => import('./components/editor/ContentEditor').then((m) => ({ default: m.ContentEditor })));
import { BoardCanvas } from './components/canvas/BoardCanvas';
import { ContextMenu, type ContextMenuItem } from './components/canvas/ContextMenu';
import { CardPanel } from './components/panels/CardPanel';
import { SidebarPanel } from './components/panels/SidebarPanel';
import { SearchPanel } from './components/panels/SearchPanel';
import { useAutoSave, setCurrentFileBlob, assetMap, resetSessionData, withoutAutoSave } from './hooks/useAutoSave';
import { clearSearchCache } from './hooks/useSearch';
import { AppearanceControls } from './components/AppearanceControls';
import { useUiStore } from './store/uiStore';
import { cacheAsset, clearAssetCache } from './lib/assetCache';
import { cardTypeIcon, cardTypeStyle } from './lib/cardTypeStyle';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Pencil,
  Trash2,
  Plus,
  Maximize2,
  Link2,
  HelpCircle,
  Layers2,
  Archive,
  PanelLeft,
  Expand,
  Shrink,
  FileOutput,
  Lock,
  Settings,
  Shapes,
  X,
} from 'lucide-react';
import type { BoardManifest, Viewport } from './types';

// ── Save indicator ───────────────────────────────────────────────────────────

function SaveIndicator() {
  const saveStatus  = useFileStore((s) => s.saveStatus);
  const isEncrypted = useFileStore((s) => s.isEncrypted);
  return (
    <div className="flex items-center gap-1.5 text-[0.6875rem] font-mono">
      {isEncrypted && (
        <span title="File is encrypted"><Lock size={11} className="text-amber-400/70" /></span>
      )}
      {saveStatus === 'saving' && (
        <><Loader2 size={12} className="animate-spin text-amber-400" /><span className="text-amber-400">saving…</span></>
      )}
      {saveStatus === 'saved' && (
        <><CheckCircle2 size={12} className="text-[#3fb950]" /><span className="text-[color:var(--c-text-faint)]">saved</span></>
      )}
      {saveStatus === 'unsaved' && (
        <><Clock size={12} className="text-[color:var(--c-text-muted)]" /><span className="text-[color:var(--c-text-faint)]">unsaved</span></>
      )}
      {saveStatus === 'error' && (
        <><AlertCircle size={12} className="text-red-400" /><span className="text-red-400">error</span></>
      )}
    </div>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

interface ToolbarProps {
  onSearch: () => void;
  onFitView: () => void;
  onInfo: () => void;
  onFiles: () => void;
  onSettings: () => void;
  onExport: () => void;
}

const toolbarBtn =
  'flex items-center gap-1.5 px-2 py-1 text-[0.6875rem] text-[color:var(--c-text-muted)] hover:text-amber-400 transition-colors rounded hover:bg-[var(--c-raised)]';

function Toolbar({ onSearch, onFitView, onInfo, onFiles, onSettings, onExport }: ToolbarProps) {
  const manifest = useFileStore((s) => s.manifest);
  const sidebarHidden = useUiStore((s) => s.sidebarHidden);
  return (
    <div className="h-10 bg-[var(--c-surface)] border-b border-[color:var(--c-border)] flex items-center px-4 gap-2 shrink-0">
      <span className="text-[0.6875rem] uppercase tracking-wider text-[color:var(--c-text-faint)] font-mono mr-2">
        {manifest?.title ?? 'PI Board'}
      </span>
      <div className="h-4 w-px bg-[var(--c-border)]" />
      <button
        onClick={() => useUiStore.getState().toggleSidebar()}
        title={sidebarHidden ? 'Show sidebar  [' : 'Hide sidebar  ['}
        aria-pressed={sidebarHidden}
        className={toolbarBtn}
      >
        <PanelLeft size={12} /> Sidebar
      </button>
      <button onClick={() => useUiStore.getState().setCanvasOnly(true)} title="Full-screen canvas  F  (Esc to leave)" className={toolbarBtn}>
        <Expand size={12} /> Full screen
      </button>
      <button onClick={onFitView} title="Fit the whole board" className={toolbarBtn}>
        <Maximize2 size={12} /> Fit
      </button>
      <button onClick={onSettings} title="Teams, sprints and card types" className={toolbarBtn}>
        <Settings size={12} /> Board settings
      </button>
      <div className="h-4 w-px bg-[var(--c-border)]" />
      <button onClick={onSearch} title="Search  /  or  Ctrl+K" className={toolbarBtn}>
        <Search size={12} /> Search
      </button>
      <button onClick={onExport} title="Export as Mermaid, for draw.io" className={toolbarBtn}>
        <FileOutput size={12} /> Export
      </button>
      <button onClick={onFiles} title="Browse archive" className={toolbarBtn}>
        <Archive size={12} /> Files
      </button>
      <div className="flex-1" />
      <AppearanceControls />
      <div className="h-4 w-px bg-[var(--c-border)] mx-1" />
      <SaveIndicator />
      <div className="h-4 w-px bg-[var(--c-border)] ml-2" />
      <button onClick={onInfo} title="About PI Board"
        className="p-1 text-[color:var(--c-text-muted)] hover:text-amber-400 transition-colors rounded hover:bg-[var(--c-raised)]" aria-label="About PI Board">
        <HelpCircle size={14} />
      </button>
    </div>
  );
}

// ── Context menu state ────────────────────────────────────────────────────────

interface CtxMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

// ── Main app ──────────────────────────────────────────────────────────────────

function AppInner() {
  const { setHandle, setManifest, setSaveStatus, setLastSaved, setEncryption } = useFileStore();
  const cardCount = useCardStore((s) => s.cards.length);
  const focusCardId = useViewStore((s) => s.focusCardId);
  const editingDependencyId = useViewStore((s) => s.editingDependencyId);
  const focusedCardExists = useCardStore((s) => (focusCardId ? s.cards.some((c) => c.id === focusCardId) : false));

  const [isOpen, setIsOpen] = useState(false);
  const [lastFilename, setLastFilename] = useState<string | null>(null);
  const [lastHandle, setLastHandle] = useState<FileSystemFileHandle | null>(null);
  const [loadError, setLoadError] = useState('');

  // Encrypted-file unlock flow
  const [pendingEncBlob, setPendingEncBlob] = useState<Blob | null>(null);
  const [pendingEncHandle, setPendingEncHandle] = useState<FileSystemFileHandle | null>(null);
  const [pendingEncFilename, setPendingEncFilename] = useState<string>('');
  const [passwordError, setPasswordError] = useState('');

  const [showNewCard, setShowNewCard] = useState<Cell | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editorCardId, setEditorCardId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const sidebarHidden = useUiStore((s) => s.sidebarHidden);
  const canvasOnly = useUiStore((s) => s.canvasOnly);

  useAutoSave();

  const triggerFitView = useCallback(() => useViewStore.getState().requestFit(), []);

  // Check IDB for a previously opened handle on mount
  useEffect(() => {
    getHandleFromIDB().then((handle) => {
      if (handle) { setLastHandle(handle); setLastFilename(handle.name); }
    }).catch(() => {/* ignore */});
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearch(false); setCtxMenu(null); setShowInfo(false); setShowFiles(false); setLinkFromId(null);
        useUiStore.getState().setCanvasOnly(false);
        return;
      }
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '[') { useUiStore.getState().toggleSidebar(); return; }
        if (e.key === 'f' || e.key === 'F') { useUiStore.getState().setCanvasOnly(!useUiStore.getState().canvasOnly); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((v) => !v);
        return;
      }
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── File operations ────────────────────────────────────────────────────────

  const ingestAssets = useCallback((assets: Record<string, { buffer: ArrayBuffer; mimeType: string }>) => {
    Object.entries(assets).forEach(([id, { buffer, mimeType }]) => {
      assetMap.set(id, buffer);
      cacheAsset(id, buffer, mimeType);
    });
  }, []);

  /** Replace everything held in memory for the previous file. Loading is not an edit, so no save is scheduled. */
  const installBoard = useCallback((
    manifest: BoardManifest,
    config: ReturnType<typeof getBoardConfig>,
    cards: Parameters<ReturnType<typeof useCardStore.getState>['loadCards']>[0],
    dependencies: Parameters<ReturnType<typeof useCardStore.getState>['loadCards']>[1],
    viewport: Viewport,
  ) => {
    resetSessionData();
    clearAssetCache();
    clearSearchCache();
    withoutAutoSave(() => {
      setManifest(manifest);
      useBoardStore.getState().loadBoard(config);
      useCardStore.getState().loadCards(cards, dependencies);
      useViewStore.getState().loadView(viewport);
    });
  }, [setManifest]);

  const loadFromBlob = useCallback(async (
    zipBlob: Blob,
    handle: FileSystemFileHandle | null,
    filename: string,
  ) => {
    const data = await readBoard(zipBlob);
    installBoard(data.manifest, data.config, data.cards, data.dependencies, data.viewport);
    setCurrentFileBlob(zipBlob);
    setHandle(handle, filename);
    ingestAssets(data.assets);
    setSaveStatus('saved');
    setLoadError('');
    setIsOpen(true);
  }, [installBoard, setHandle, ingestAssets, setSaveStatus]);

  const loadFromHandle = useCallback(async (handle: FileSystemFileHandle) => {
    const file    = await handle.getFile();
    const buffer  = await file.arrayBuffer();
    if (isEncryptedBuffer(buffer)) {
      setPendingEncBlob(new Blob([buffer]));
      setPendingEncHandle(handle);
      setPendingEncFilename(handle.name);
      setPasswordError('');
      return;
    }
    await loadFromBlob(new Blob([buffer], { type: 'application/zip' }), handle, handle.name);
  }, [loadFromBlob]);

  const handleReopen = useCallback(async () => {
    if (!lastHandle) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perm = await (lastHandle as any).requestPermission({ mode: 'readwrite' }) as string;
      if (perm !== 'granted') return;
      await loadFromHandle(lastHandle);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Reopen failed', err);
        setLoadError(err.message);
      }
    }
  }, [lastHandle, loadFromHandle]);

  const handleOpen = useCallback(async () => {
    try {
      const { handle, file } = await openBoardFile();
      const buffer = await file.arrayBuffer();
      if (handle) await saveHandleToIDB(handle);
      if (isEncryptedBuffer(buffer)) {
        setPendingEncBlob(new Blob([buffer]));
        setPendingEncHandle(handle);
        setPendingEncFilename(handle?.name ?? file.name);
        setPasswordError('');
        return;
      }
      await loadFromBlob(new Blob([buffer], { type: 'application/zip' }), handle, handle?.name ?? file.name);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Open failed', err);
        setLoadError(err.message);
      }
    }
  }, [loadFromBlob]);

  const handleCreate = useCallback(async (opts: CreateBoardOptions) => {
    try {
      const { handle, filename } = await createBoardFile(opts.title);
      const now = new Date().toISOString();
      const manifest: BoardManifest = { format: 'piboard', version: 1, title: opts.title, created: now, modified: now };
      const config = createDefaultBoard({
        piName: opts.piName,
        sprintCount: opts.sprintCount,
        innovationLast: opts.innovationLast,
        teamNames: opts.teamNames,
      });
      installBoard(manifest, config, [], [], DEFAULT_VIEWPORT);
      setHandle(handle, filename);
      const blob = await writeBoard({ manifest, config, cards: [], dependencies: [], viewport: DEFAULT_VIEWPORT });
      setCurrentFileBlob(blob);
      const diskBlob = opts.passphrase ? await encryptBlob(blob, opts.passphrase) : blob;
      if (handle) { await writeBoardFile(handle, diskBlob); await saveHandleToIDB(handle); }
      else downloadBlob(diskBlob, filename);
      if (opts.passphrase) setEncryption(true, opts.passphrase);
      else setEncryption(false, null);
      setSaveStatus('saved');
      setLastSaved(now);
      setLoadError('');
      setIsOpen(true);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Create failed', err);
        setLoadError(err.message);
      }
    }
  }, [installBoard, setHandle, setSaveStatus, setLastSaved, setEncryption]);

  // Unlock an encrypted file
  const handleUnlock = async (passphrase: string) => {
    if (!pendingEncBlob) return;
    let zipBlob: Blob;
    try {
      zipBlob = await decryptBlob(pendingEncBlob, passphrase);
    } catch {
      setPasswordError('Wrong passphrase — try again');
      return;
    }
    try {
      await loadFromBlob(zipBlob, pendingEncHandle, pendingEncFilename);
      setEncryption(true, passphrase);
      if (pendingEncHandle) await saveHandleToIDB(pendingEncHandle);
      setPendingEncBlob(null);
      setPendingEncHandle(null);
    } catch (err) {
      // Decrypted fine, but the contents are not a usable board
      setPendingEncBlob(null);
      setPendingEncHandle(null);
      setLoadError(err instanceof Error ? err.message : 'Could not open this file');
    }
  };

  // ── Cards ──────────────────────────────────────────────────────────────────

  const handleNewCard = useCallback((values: NewCardValues) => {
    if (!showNewCard) return;
    const card = useCardStore.getState().addCard({
      title: values.title,
      typeId: values.typeId,
      laneId: showNewCard.laneId,
      sprintId: showNewCard.sprintId,
      slot: showNewCard.slot === 'start' ? undefined : showNewCard.slot,
      owner: values.owner,
      estimate: values.estimate,
      party: values.party,
    });
    setShowNewCard(null);
    useViewStore.getState().setFocusCard(card.id);
  }, [showNewCard]);

  const handleLinkTo = useCallback((toId: string) => {
    const from = linkFromId;
    if (!from || from === toId) return;
    setLinkFromId(null);
    const dep = useCardStore.getState().addDependency({ from, to: toId });
    if (dep) useViewStore.getState().openDependency(dep.id);
  }, [linkFromId]);

  const handleSelectCard = useCallback((cardId: string) => {
    const view = useViewStore.getState();
    view.setFocusCard(cardId);
    view.panTo({ kind: 'card', id: cardId });
  }, []);

  // ── Context menus ──────────────────────────────────────────────────────────

  const handleCardContextMenu = useCallback((cardId: string, x: number, y: number) => {
    const state = useCardStore.getState();
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return;
    const cardTypes = useBoardStore.getState().cardTypes;
    setCtxMenu({
      x, y,
      items: [
        {
          icon: <Pencil size={12} />,
          label: 'Edit',
          onClick: () => useViewStore.getState().setFocusCard(cardId),
        },
        {
          icon: <Layers2 size={12} />,
          label: 'Duplicate',
          onClick: () => {
            const dup = state.duplicateCard(cardId);
            if (dup) useViewStore.getState().setFocusCard(dup.id);
          },
        },
        {
          icon: <Shapes size={12} />,
          label: 'Change type',
          onClick: () => {},
          submenu: cardTypes.map((t) => {
            const Icon = cardTypeIcon(t.icon);
            return {
              icon: <span style={{ color: cardTypeStyle(t.colour).text }}><Icon size={12} /></span>,
              label: t.name,
              active: t.id === card.typeId,
              onClick: () => state.updateCard(cardId, { typeId: t.id }),
            };
          }),
        },
        {
          icon: <Link2 size={12} />,
          label: 'Start dependency from here',
          onClick: () => setLinkFromId(cardId),
        },
        {
          icon: <Trash2 size={12} />,
          label: 'Delete',
          danger: true,
          separator: true,
          onClick: () => {
            state.deleteCard(cardId);
            if (useViewStore.getState().focusCardId === cardId) useViewStore.getState().setFocusCard(null);
          },
        },
      ],
    });
  }, []);

  const handleCanvasContextMenu = useCallback((x: number, y: number, cell: Cell | null) => {
    const items: ContextMenuItem[] = [];
    if (cell) {
      items.push({ icon: <Plus size={12} />, label: 'Add card here', onClick: () => setShowNewCard(cell) });
    }
    items.push(
      { icon: <Maximize2 size={12} />, label: 'Fit board', separator: items.length > 0, onClick: triggerFitView },
      { icon: <Settings size={12} />, label: 'Board settings', onClick: () => setShowSettings(true) },
    );
    setCtxMenu({ x, y, items });
  }, [triggerFitView]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (pendingEncBlob) {
    return (
      <PasswordDialog
        mode="unlock"
        filename={pendingEncFilename}
        error={passwordError}
        onSubmit={(pw) => void handleUnlock(pw)}
        onCancel={() => { setPendingEncBlob(null); setPendingEncHandle(null); setPasswordError(''); }}
      />
    );
  }

  if (!isOpen) {
    return (
      <>
        <div className="fixed top-3 right-4 z-[60]"><AppearanceControls /></div>
        <OpenOrCreateDialog
          onOpen={() => void handleOpen()}
          onCreate={(opts) => void handleCreate(opts)}
          onReopen={lastHandle ? () => void handleReopen() : undefined}
          lastFilename={lastFilename}
        />
        {loadError && (
          <div role="alert" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-[520px] flex items-start gap-3 px-4 py-3 rounded-lg border border-red-400/40 bg-[var(--c-surface)] shadow-2xl text-[0.75rem] text-red-300">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span className="flex-1">{loadError}</span>
            <button onClick={() => setLoadError('')} className="text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)]" aria-label="Dismiss"><X size={13} /></button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="h-screen bg-[var(--c-canvas)] flex flex-col overflow-hidden">
      {!canvasOnly && <Toolbar
        onSearch={() => setShowSearch((v) => !v)}
        onFitView={triggerFitView}
        onInfo={() => setShowInfo(true)}
        onFiles={() => setShowFiles(true)}
        onSettings={() => setShowSettings(true)}
        onExport={() => setShowExport(true)}
      />}

      <div className="flex flex-1 overflow-hidden">
        {!canvasOnly && !sidebarHidden && <SidebarPanel />}

        <div className="flex-1 relative overflow-hidden">
          <BoardCanvas
            onCardContextMenu={handleCardContextMenu}
            onCanvasContextMenu={handleCanvasContextMenu}
            onCreateCard={setShowNewCard}
            linkFromId={linkFromId}
            onLinkTo={handleLinkTo}
          />

          {cardCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-[color:var(--c-text-faint)] text-sm">Double-click a cell to add a card</div>
                <div className="text-[color:var(--c-text-dim)] text-xs mt-1">Drag from a card's right dot to the card that needs it</div>
              </div>
            </div>
          )}

          {canvasOnly && (
            <div className="absolute top-2 right-3 z-20 flex items-center gap-2 px-2 py-1 rounded-lg border border-[color:var(--c-border)] bg-[var(--c-surface)]/90 shadow-lg">
              <AppearanceControls />
              <div className="h-4 w-px bg-[var(--c-border)]" />
              <button
                onClick={() => useUiStore.getState().setCanvasOnly(false)}
                title="Leave full screen  Esc"
                className="flex items-center gap-1.5 px-2 py-1 text-[0.6875rem] text-[color:var(--c-text-muted)] hover:text-amber-400 rounded hover:bg-[var(--c-raised)]"
              >
                <Shrink size={12} /> Exit full screen
              </button>
            </div>
          )}

          {linkFromId && (
            <div className="absolute top-[64px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3 py-1.5 rounded-lg border border-amber-400/40 bg-[var(--c-surface)] shadow-xl text-[0.75rem] text-[color:var(--c-text)]">
              <Link2 size={13} className="text-amber-400" />
              Click the card that needs this one
              <button onClick={() => setLinkFromId(null)} className="text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)]">Cancel</button>
            </div>
          )}
        </div>

        {!canvasOnly && focusCardId && focusedCardExists && (
          <CardPanel
            cardId={focusCardId}
            onClose={() => useViewStore.getState().setFocusCard(null)}
            onOpenEditor={setEditorCardId}
          />
        )}
      </div>

      {showNewCard && (
        <NewCardDialog cell={showNewCard} onConfirm={handleNewCard} onCancel={() => setShowNewCard(null)} />
      )}

      {editingDependencyId && (
        <DependencyDialog dependencyId={editingDependencyId} onClose={() => useViewStore.getState().openDependency(null)} />
      )}

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}

      {showSettings && <BoardSettingsDialog onClose={() => setShowSettings(false)} />}

      {showSearch && (
        <SearchPanel onSelectCard={handleSelectCard} onClose={() => setShowSearch(false)} />
      )}

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}

      {showInfo && <InfoPanel onClose={() => setShowInfo(false)} />}

      {showFiles && (
        <FileExplorer
          onClose={() => setShowFiles(false)}
          onOpenEditor={(id) => { setShowFiles(false); setEditorCardId(id); }}
        />
      )}

      {editorCardId && (
        <Suspense fallback={null}>
          <ContentEditor cardId={editorCardId} onClose={() => setEditorCardId(null)} />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return <AppInner />;
}
