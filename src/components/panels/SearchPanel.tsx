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
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#30363d]">
          <Search size={15} className="text-[#8b949e]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Search cards by title, owner, tag, party…"
            className="flex-1 bg-transparent text-[#e6edf3] text-sm focus:outline-none placeholder-[#484f58]"
          />
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]" aria-label="Close search">
            <X size={15} />
          </button>
        </div>

        <label className="flex items-center gap-2 px-4 py-2 border-b border-[#21262d] text-[11px] text-[#8b949e] select-none cursor-pointer">
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
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#1c2333] transition-colors border-b border-[#21262d] last:border-0 text-left"
                >
                  <span className="mt-0.5 shrink-0" style={{ color: st.text }}><Icon size={13} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#e6edf3] truncate">{card.title}</div>
                    <div className="text-[11px] font-mono text-[#8b949e] mt-0.5 truncate">
                      {lane} · {sprint}{card.owner ? ` · ${teams.find((t) => t.id === card.owner)?.name ?? ''}` : ''}{card.party ? ` · ${card.party}` : ''}
                    </div>
                    {card.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {card.tags.map((t) => (
                          <span key={t} className="text-[10px] px-1 rounded bg-[#21262d] text-[#8b949e]">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {contentHits.has(card.id) && <span title="Matched in document" className="text-[#8b949e]"><BookOpen size={12} /></span>}
                </button>
              );
            })}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-[#484f58]">No results</div>
        )}
      </div>
    </div>
  );
}
