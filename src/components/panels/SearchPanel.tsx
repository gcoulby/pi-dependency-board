import { useRef, useEffect } from 'react';
import { X, Search, BookOpen } from 'lucide-react';
import { useSearch } from '../../hooks/useSearch';
import { useBoardStore } from '../../store/boardStore';
import { cardTypeIcon, cardTypeStyle } from '../../lib/cardTypeStyle';
import { EXTERNAL_LANE_ID } from '../../types';

interface Props {
  onSelectCard: (cardId: string) => void;
  onClose: () => void;
}

export function SearchPanel({ onSelectCard, onClose }: Props) {
  const { query, setQuery, results, includeContent, setIncludeContent, contentHits } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardTypes = useBoardStore((s) => s.cardTypes);
  const teams = useBoardStore((s) => s.teams);
  const sprints = useBoardStore((s) => s.sprints);
  const externalLabel = useBoardStore((s) => s.externalLane.label);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 w-[520px] z-40">
      <div className="bg-[var(--c-surface)] border border-[color:var(--c-border)] rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--c-border)]">
          <Search size={15} className="text-[color:var(--c-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Search cards by title, owner, tag, party…"
            className="flex-1 bg-transparent text-[color:var(--c-text)] text-sm focus:outline-none placeholder-[var(--c-text-faint)]"
          />
          <button onClick={onClose} className="text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)]" aria-label="Close search">
            <X size={15} />
          </button>
        </div>

        <label className="flex items-center gap-2 px-4 py-2 border-b border-[color:var(--c-subtle)] text-[0.6875rem] text-[color:var(--c-text-muted)] select-none cursor-pointer">
          <input type="checkbox" checked={includeContent} onChange={(e) => setIncludeContent(e.target.checked)} className="accent-amber-400" />
          Also search long-form card documents
        </label>

        {results.length > 0 && (
          <div className="max-h-[320px] overflow-y-auto">
            {results.map((card) => {
              const type = cardTypes.find((t) => t.id === card.typeId);
              const st = cardTypeStyle(type?.colour ?? '#8b949e');
              const Icon = cardTypeIcon(type?.icon);
              const lane = card.laneId === EXTERNAL_LANE_ID ? externalLabel : teams.find((t) => t.id === card.laneId)?.name ?? '?';
              const sprint = sprints.find((s) => s.id === card.sprintId)?.name ?? '?';
              return (
                <button
                  key={card.id}
                  onClick={() => { onSelectCard(card.id); onClose(); }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[var(--c-raised)] transition-colors border-b border-[color:var(--c-subtle)] last:border-0 text-left"
                >
                  <span className="mt-0.5 shrink-0" style={{ color: st.text }}><Icon size={13} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[color:var(--c-text)] truncate">{card.title}</div>
                    <div className="text-[0.6875rem] font-mono text-[color:var(--c-text-muted)] mt-0.5 truncate">
                      {lane} · {sprint}{card.owner ? ` · ${teams.find((t) => t.id === card.owner)?.name ?? ''}` : ''}{card.party ? ` · ${card.party}` : ''}
                    </div>
                    {card.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {card.tags.map((t) => (
                          <span key={t} className="text-[0.625rem] px-1 rounded bg-[var(--c-subtle)] text-[color:var(--c-text-muted)]">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {contentHits.has(card.id) && <span title="Matched in document" className="text-[color:var(--c-text-muted)]"><BookOpen size={12} /></span>}
                </button>
              );
            })}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-[color:var(--c-text-faint)]">No results</div>
        )}
      </div>
    </div>
  );
}
