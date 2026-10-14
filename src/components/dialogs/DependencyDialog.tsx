import { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { useCardStore } from '../../store/cardStore';
import { useBoardStore } from '../../store/boardStore';
import { checkSchedule } from '../../board/dependencies';
import type { DependencyState } from '../../types';

interface Props {
  dependencyId: string;
  onClose: () => void;
}

const STATES: { id: DependencyState; label: string; hint: string; colour: string }[] = [
  { id: 'proposed', label: 'Proposed', hint: 'Raised, not yet agreed', colour: 'var(--c-text-muted)' },
  { id: 'agreed', label: 'Agreed', hint: 'Both sides have accepted it', colour: '#3fb950' },
  { id: 'at-risk', label: 'At risk', hint: 'Agreed but in doubt', colour: '#f0883e' },
];

export function DependencyDialog({ dependencyId, onClose }: Props) {
  const dep = useCardStore((s) => s.dependencies.find((d) => d.id === dependencyId));
  const cards = useCardStore((s) => s.cards);
  const sprints = useBoardStore((s) => s.sprints);
  const updateDependency = useCardStore((s) => s.updateDependency);
  const deleteDependency = useCardStore((s) => s.deleteDependency);
  const reverseDependency = useCardStore((s) => s.reverseDependency);
  const [reverseBlocked, setReverseBlocked] = useState(false);

  const [label, setLabel] = useState(dep?.label ?? '');
  const [notes, setNotes] = useState(dep?.notes ?? '');
  const [state, setState] = useState<DependencyState>(dep?.state ?? 'proposed');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!dep) return null;

  const from = cards.find((c) => c.id === dep.from);
  const to = cards.find((c) => c.id === dep.to);
  const sprintName = (id?: string, slot?: string) => `${sprints.find((s) => s.id === id)?.name ?? '?'} · ${slot ?? 'start'}`;
  const check = checkSchedule(dep, cards, sprints);

  const save = () => {
    updateDependency(dependencyId, { label: label.trim() || undefined, notes: notes.trim() || undefined, state });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[var(--c-canvas)]/80 flex items-center justify-center z-50">
      <div className="bg-[var(--c-surface)] border border-[color:var(--c-border)] rounded-lg p-6 w-[440px] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[color:var(--c-text)] font-semibold">Dependency</h3>
          <button onClick={onClose} className="text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-stretch gap-2 mb-4">
          <div className="flex-1 min-w-0 rounded border border-[color:var(--c-border)] bg-[var(--c-canvas)] px-3 py-2">
            <div className="text-[0.5625rem] uppercase tracking-wider text-[color:var(--c-text-faint)] font-mono">Delivers first</div>
            <div className="text-[0.75rem] text-[color:var(--c-text)] truncate">{from?.title ?? 'Unknown card'}</div>
            <div className="text-[0.625rem] font-mono text-[color:var(--c-text-muted)]">{sprintName(from?.sprintId, from?.slot)}</div>
          </div>
          <button
            onClick={() => setReverseBlocked(!reverseDependency(dependencyId))}
            title="Reverse direction: swap which card delivers first"
            aria-label="Reverse direction"
            className="self-center shrink-0 p-1.5 rounded border border-[color:var(--c-border)] text-[color:var(--c-text-muted)] hover:text-amber-400 hover:border-amber-400/50 transition-colors"
          >
            <ArrowLeftRight size={14} />
          </button>
          <div className="flex-1 min-w-0 rounded border border-[color:var(--c-border)] bg-[var(--c-canvas)] px-3 py-2">
            <div className="text-[0.5625rem] uppercase tracking-wider text-[color:var(--c-text-faint)] font-mono">Needs it</div>
            <div className="text-[0.75rem] text-[color:var(--c-text)] truncate">{to?.title ?? 'Unknown card'}</div>
            <div className="text-[0.625rem] font-mono text-[color:var(--c-text-muted)]">{sprintName(to?.sprintId, to?.slot)}</div>
          </div>
        </div>

        {reverseBlocked && (
          <div className="mb-3 text-[0.6875rem] text-[#f0883e]">The opposite dependency already exists, so this one cannot be reversed.</div>
        )}
        {check === 'conflict' && (
          <div className="flex gap-2 items-start mb-4 px-3 py-2 rounded border border-[#f85149]/40 bg-[#f85149]/10 text-[0.6875rem] text-[#f85149]">
            <AlertTriangle size={13} className="shrink-0 mt-px" />
            Conflict: the card that must be delivered first is scheduled later than the card that needs it.
          </div>
        )}
        {check === 'same-sprint' && (
          <div className="flex gap-2 items-start mb-4 px-3 py-2 rounded border border-[#f0883e]/40 bg-[#f0883e]/10 text-[0.6875rem] text-[#f0883e]">
            <AlertTriangle size={13} className="shrink-0 mt-px" />
            Both cards are in the same sprint, at the same point in it. Move the provider earlier in the sprint, or into an earlier sprint.
          </div>
        )}
        {check === 'ok' && (
          <div className="flex gap-2 items-center mb-4 text-[0.6875rem] text-[#3fb950]">
            <CheckCircle2 size={13} /> Schedule works as drawn.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[0.6875rem] uppercase tracking-wider text-[color:var(--c-text-muted)] mb-1.5">State</label>
            <div className="grid grid-cols-3 gap-2">
              {STATES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setState(s.id)}
                  title={s.hint}
                  className={[
                    'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[0.75rem] transition-colors',
                    state === s.id ? 'bg-[var(--c-raised)] text-[color:var(--c-text)]' : 'border-[color:var(--c-border)] text-[color:var(--c-text-muted)] hover:border-[color:var(--c-text-faint)]',
                  ].join(' ')}
                  style={state === s.id ? { borderColor: s.colour } : undefined}
                >
                  <span className="w-3 border-t-2" style={{ borderColor: s.colour, borderTopStyle: s.id === 'proposed' ? 'dashed' : 'solid' }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[0.6875rem] uppercase tracking-wider text-[color:var(--c-text-muted)] mb-1.5">What is needed</label>
            <input
              autoFocus
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
              placeholder="API contract, test environment, sign-off…"
              className="w-full bg-[var(--c-canvas)] border border-[color:var(--c-border)] rounded px-3 py-2 text-[color:var(--c-text)] text-sm placeholder-[var(--c-text-faint)] focus:outline-none focus:border-amber-400/60"
            />
          </div>
          <div>
            <label className="block text-[0.6875rem] uppercase tracking-wider text-[color:var(--c-text-muted)] mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Who agreed, what is in doubt, links…"
              className="w-full bg-[var(--c-canvas)] border border-[color:var(--c-border)] rounded px-3 py-2 text-[color:var(--c-text)] text-sm placeholder-[var(--c-text-faint)] focus:outline-none focus:border-amber-400/60 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => { deleteDependency(dependencyId); onClose(); }}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)] transition-colors">
              Close
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm bg-amber-400 text-[color:var(--c-on-accent)] font-semibold rounded hover:bg-amber-300 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
