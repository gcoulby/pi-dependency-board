import { useEffect, useMemo, useState } from 'react';
import { useCardStore } from '../store/cardStore';
import { useBoardStore } from '../store/boardStore';
import { contentMap, getCurrentFileBlob } from './useAutoSave';
import { loadCardContent } from '../file/boardReader';
import type { Card } from '../types';

/** Flatten a BlockNote document into plain text. */
function extractText(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => extractText(n, out));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.text === 'string') out.push(o.text);
    if (o.content) extractText(o.content, out);
    if (o.children) extractText(o.children, out);
  }
  return out;
}

// Plain text of card documents, filled on demand and only when the toggle is on
const textCache = new Map<string, string>();

async function documentText(card: Card): Promise<string> {
  const cached = textCache.get(card.id);
  if (cached !== undefined) return cached;
  let doc: unknown = contentMap.get(card.id);
  if (doc === undefined) {
    const blob = getCurrentFileBlob();
    doc = blob ? await loadCardContent(blob, card.id).catch(() => null) : null;
  }
  const text = extractText(doc).join(' ').toLowerCase();
  textCache.set(card.id, text);
  return text;
}

function matches(card: Card, q: string, ownerName: string | undefined): boolean {
  if (card.title.toLowerCase().includes(q)) return true;
  if (ownerName?.toLowerCase().includes(q)) return true;
  if (card.description?.toLowerCase().includes(q)) return true;
  if (card.party?.toLowerCase().includes(q)) return true;
  if (card.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return Object.entries(card.properties).some(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q));
}

export function useSearch() {
  const cards = useCardStore((s) => s.cards);
  const teams = useBoardStore((s) => s.teams);
  const [query, setQuery] = useState('');
  const [includeContent, setIncludeContent] = useState(false);
  const [found, setFound] = useState<{ q: string; hits: Set<string> }>({ q: '', hits: new Set() });

  const q = query.trim().toLowerCase();

  // Documents are searched only behind the explicit toggle, and only those cards that have one
  useEffect(() => {
    if (!includeContent || !q) return;
    let cancelled = false;
    void (async () => {
      const hits = new Set<string>();
      for (const c of cards.filter((x) => x.hasContent)) {
        if ((await documentText(c)).includes(q)) hits.add(c.id);
      }
      if (!cancelled) setFound({ q, hits });
    })();
    return () => { cancelled = true; };
  }, [includeContent, q, cards]);

  // Hits only count for the query they were computed for, and only while the toggle is on
  const contentHits = useMemo(
    () => (includeContent && q && found.q === q ? found.hits : new Set<string>()),
    [includeContent, q, found],
  );

  const results = useMemo(() => {
    if (!q) return [];
    const names = new Map(teams.map((t) => [t.id, t.name]));
    return cards.filter((c) => matches(c, q, c.owner ? names.get(c.owner) : undefined) || contentHits.has(c.id));
  }, [cards, teams, q, contentHits]);

  return { query, setQuery, results, includeContent, setIncludeContent, contentHits };
}

/** Drop cached document text when a different file is opened or a document is edited. */
export function clearSearchCache(cardId?: string) {
  if (cardId) textCache.delete(cardId);
  else textCache.clear();
}
