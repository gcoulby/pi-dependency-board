import JSZip from 'jszip';
import type { BoardConfig, BoardManifest, Card, CardId, Dependency, Viewport } from '../types';

interface WriteOptions {
  manifest: BoardManifest;
  config: BoardConfig;
  cards: Card[];
  dependencies: Dependency[];
  viewport: Viewport;
  existingFile?: File | Blob | null;
  contentDirty?: Set<CardId>;
  contentMap?: Map<CardId, unknown>;
  assetMap?: Map<string, ArrayBuffer>;
}

export async function writeBoard(opts: WriteOptions): Promise<Blob> {
  let zip = new JSZip();

  // If there's an existing file, load it first to preserve assets and content blobs
  if (opts.existingFile) {
    try {
      zip = await JSZip.loadAsync(opts.existingFile);
    } catch {
      zip = new JSZip();
    }
  }

  const manifest: BoardManifest = { ...opts.manifest, format: 'piboard', modified: new Date().toISOString() };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Teams, sprints and card types travel with the file
  zip.file('board.json', JSON.stringify(opts.config, null, 2));

  // Cards and dependencies. Pixel positions are never stored.
  zip.file('cards.json', JSON.stringify({ cards: opts.cards, dependencies: opts.dependencies }, null, 2));

  zip.file('view.json', JSON.stringify({ viewport: opts.viewport }, null, 2));

  // Write dirty content blobs
  if (opts.contentDirty && opts.contentMap) {
    for (const cardId of opts.contentDirty) {
      const content = opts.contentMap.get(cardId);
      if (content !== undefined) {
        zip.file(`content/${cardId}.json`, JSON.stringify(content, null, 2));
      }
    }
  }

  // Drop documents of cards that no longer exist
  const live = new Set(opts.cards.map((c) => c.id));
  Object.keys(zip.files)
    .filter((p) => p.startsWith('content/') && !p.endsWith('/'))
    .filter((p) => !live.has(p.slice('content/'.length).replace(/\.json$/, '')))
    .forEach((p) => zip.remove(p));

  // Write assets — purge existing entries first so deletions take effect
  if (opts.assetMap) {
    Object.keys(zip.files)
      .filter((p) => p.startsWith('assets/'))
      .forEach((p) => zip.remove(p));
    for (const [assetId, buffer] of opts.assetMap) {
      zip.file(`assets/${assetId}`, buffer);
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
