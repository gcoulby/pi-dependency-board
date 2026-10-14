import { useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronRight, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { useCardStore } from '../../store/cardStore';
import { useViewStore } from '../../store/viewStore';
import { useFileStore } from '../../store/fileStore';
import { findIssues } from '../../board/issues';
import { cardTypeIcon, cardTypeStyle } from '../../lib/cardTypeStyle';
import { EXTERNAL_LANE_ID } from '../../types';

function SectionHeader({ label, open, onToggle, badge }: { label: string; open: boolean; onToggle: () => void; badge?: React.ReactNode }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-2 text-[0.625rem] uppercase tracking-wider text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)] transition-colors"
    >
      <span className="flex items-center gap-2">{label}{badge}</span>
      {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
    </button>
  );
}

export function SidebarPanel() {
  const manifest = useFileStore((s) => s.manifest);
  const pi = useBoardStore((s) => s.pi);
  const teams = useBoardStore((s) => s.teams);
  const sprints = useBoardStore((s) => s.sprints);
  const cardTypes = useBoardStore((s) => s.cardTypes);
  const externalLabel = useBoardStore((s) => s.externalLane.label);
  const cards = useCardStore((s) => s.cards);
  const dependencies = useCardStore((s) => s.dependencies);

  const activeTypeId = useViewStore((s) => s.activeTypeId);
  const activeLaneId = useViewStore((s) => s.activeLaneId);
  const selectedDependencyId = useViewStore((s) => s.selectedDependencyId);
  const focusCardId = useViewStore((s) => s.focusCardId);
  const { setActiveType, setActiveLane, selectDependency, setFocusCard, panTo, clearFilters } = useViewStore.getState();

  const [legendOpen, setLegendOpen] = useState(true);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [issuesOpen, setIssuesOpen] = useState(true);

  const issues = useMemo(() => findIssues(cards, dependencies, sprints), [cards, dependencies, sprints]);
  const issueCount = issues.conflicts.length + issues.sameSprint.length + issues.cycles.length;

  const title = (id: string) => cards.find((c) => c.id === id)?.title ?? 'Unknown card';
  const sprintOf = (id: string) => {
    const sid = cards.find((c) => c.id === id)?.sprintId;
    return sprints.find((s) => s.id === sid)?.name ?? '?';
  };

  const hasFilter = activeTypeId !== null || activeLaneId !== null;
  const laneItems = [
    ...teams.map((t) => ({ id: t.id, name: t.name, colour: t.colour, external: false })),
    { id: EXTERNAL_LANE_ID, name: externalLabel, colour: 'var(--c-text-muted)', external: true },
  ];

  const goToDependency = (id: string) => {
    selectDependency(id);
    panTo({ kind: 'dependency', id });
  };
  const goToCard = (id: string) => {
    setFocusCard(id);
    panTo({ kind: 'card', id });
  };

  return (
    <div className="w-55 h-full bg-[var(--c-surface)] border-r border-[color:var(--c-border)] flex flex-col overflow-hidden shrink-0">

      {/* Board header */}
      <div className="px-4 py-3.5 border-b border-[color:var(--c-border)] shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <CalendarRange size={12} className="text-amber-400" />
          <span className="text-[0.625rem] uppercase tracking-wider text-amber-400 font-mono truncate">{pi.name}</span>
        </div>
        <div className="text-sm font-semibold text-[color:var(--c-text)] truncate leading-tight">
          {manifest?.title ?? 'Untitled'}
        </div>
        <div className="flex gap-3 mt-1.5 text-[0.625rem] font-mono text-[color:var(--c-text-faint)]">
          <span>{cards.length} cards</span>
          <span>{dependencies.length} deps</span>
        </div>
        {manifest?.created && (
          <div className="text-[0.625rem] font-mono text-[color:var(--c-text-dim)] mt-0.5">
            {new Date(manifest.created).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">

        {hasFilter && (
          <div className="px-3 pt-2">
            <button
              onClick={clearFilters}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-[0.625rem] text-amber-400 bg-amber-400/10 rounded border border-amber-400/30 hover:bg-amber-400/20 transition-colors"
            >
              <span className="flex-1 text-left truncate">
                {activeTypeId && (cardTypes.find((t) => t.id === activeTypeId)?.name ?? 'Type')}
                {activeTypeId && activeLaneId && ' · '}
                {activeLaneId && (laneItems.find((l) => l.id === activeLaneId)?.name ?? 'Team')}
              </span>
              <span>✕</span>
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="border-b border-[color:var(--c-subtle)] mt-2">
          <SectionHeader label="Legend" open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} />
          {legendOpen && (
            <div className="pb-2">
              {cardTypes.map((t) => {
                const st = cardTypeStyle(t.colour);
                const Icon = cardTypeIcon(t.icon);
                const count = cards.filter((c) => c.typeId === t.id).length;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveType(activeTypeId === t.id ? null : t.id)}
                    className={[
                      'w-full flex items-center justify-between px-4 py-1.5 text-[0.6875rem] transition-colors',
                      activeTypeId === t.id ? 'bg-amber-400/10 text-amber-400' : 'text-[color:var(--c-text-muted)] hover:bg-[var(--c-raised)] hover:text-[color:var(--c-text)]',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-0.5 h-3.5 rounded-full shrink-0" style={{ background: st.bar }} />
                      <span style={{ color: st.text }} className="shrink-0"><Icon size={12} /></span>
                      <span className="truncate">{t.name}</span>
                    </span>
                    <span className="text-[0.625rem] text-[color:var(--c-text-faint)]">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="border-b border-[color:var(--c-subtle)]">
          <SectionHeader label="Teams" open={teamsOpen} onToggle={() => setTeamsOpen((v) => !v)} />
          {teamsOpen && (
            <div className="pb-2">
              {laneItems.map((l) => {
                const count = cards.filter((c) => c.laneId === l.id).length;
                return (
                  <button
                    key={l.id}
                    onClick={() => setActiveLane(activeLaneId === l.id ? null : l.id)}
                    className={[
                      'w-full flex items-center justify-between px-4 py-1.5 text-[0.6875rem] transition-colors',
                      activeLaneId === l.id ? 'bg-amber-400/10 text-amber-400' : 'text-[color:var(--c-text-muted)] hover:bg-[var(--c-raised)] hover:text-[color:var(--c-text)]',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {l.external ? (
                        <ExternalLink size={11} className="shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: l.colour }} />
                      )}
                      <span className="truncate">{l.name}</span>
                    </span>
                    <span className="text-[0.625rem] text-[color:var(--c-text-faint)]">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Issues */}
        <div>
          <SectionHeader
            label="Issues"
            open={issuesOpen}
            onToggle={() => setIssuesOpen((v) => !v)}
            badge={
              issueCount > 0 && (
                <span className="px-1.5 rounded-full text-[0.5625rem] font-mono bg-[#f85149]/15 text-[#f85149] normal-case tracking-normal">{issueCount}</span>
              )
            }
          />
          {issuesOpen && (
            <div className="pb-3">
              {issueCount === 0 && <div className="px-4 py-1 text-[0.6875rem] text-[color:var(--c-text-dim)]">No scheduling problems</div>}

              {issues.conflicts.map((i) => (
                <button
                  key={i.dependencyId}
                  onClick={() => goToDependency(i.dependencyId)}
                  className={[
                    'w-full text-left px-4 py-1.5 transition-colors',
                    selectedDependencyId === i.dependencyId ? 'bg-amber-400/10' : 'hover:bg-[var(--c-raised)]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5 text-[0.5625rem] font-mono uppercase text-[#f85149]">
                    <AlertTriangle size={9} /> Conflict
                  </div>
                  <div className="text-[0.6875rem] text-[color:var(--c-text)] leading-tight truncate">{title(i.from)}</div>
                  <div className="text-[0.625rem] text-[color:var(--c-text-muted)] leading-tight truncate">
                    {sprintOf(i.from)} is after {sprintOf(i.to)}, needed by {title(i.to)}
                  </div>
                </button>
              ))}

              {issues.sameSprint.map((i) => (
                <button
                  key={i.dependencyId}
                  onClick={() => goToDependency(i.dependencyId)}
                  className={[
                    'w-full text-left px-4 py-1.5 transition-colors',
                    selectedDependencyId === i.dependencyId ? 'bg-amber-400/10' : 'hover:bg-[var(--c-raised)]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5 text-[0.5625rem] font-mono uppercase text-[#f0883e]">
                    <AlertTriangle size={9} /> Same sprint
                  </div>
                  <div className="text-[0.6875rem] text-[color:var(--c-text)] leading-tight truncate">{title(i.from)}</div>
                  <div className="text-[0.625rem] text-[color:var(--c-text-muted)] leading-tight truncate">needed by {title(i.to)} in {sprintOf(i.to)}</div>
                </button>
              ))}

              {issues.cycles.map((i, n) => (
                <button
                  key={`cycle-${n}`}
                  onClick={() => goToCard(i.cards[0])}
                  className={[
                    'w-full text-left px-4 py-1.5 transition-colors',
                    focusCardId === i.cards[0] ? 'bg-amber-400/10' : 'hover:bg-[var(--c-raised)]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5 text-[0.5625rem] font-mono uppercase text-[#f85149]">
                    <RefreshCw size={9} /> Cycle
                  </div>
                  <div className="text-[0.6875rem] text-[color:var(--c-text)] leading-tight">{i.cards.length} cards depend on each other</div>
                  <div className="text-[0.625rem] text-[color:var(--c-text-muted)] leading-tight truncate">{i.cards.map(title).join(' → ')}</div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
