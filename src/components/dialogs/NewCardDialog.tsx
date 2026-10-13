import { useState } from 'react';
import { X } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { cardTypeIcon, cardTypeStyle } from '../../lib/cardTypeStyle';
import type { Cell } from '../../board/layout';
import { EXTERNAL_LANE_ID } from '../../types';

export interface NewCardValues {
  title: string;
  typeId: string;
  owner?: string;
  estimate?: number;
  party?: string;
  size: 's' | 'm' | 'l';
}

const SLOT_LABEL = { start: 'Start of sprint', mid: 'Mid sprint', end: 'End of sprint' } as const;

interface Props {
  cell: Cell;
  onConfirm: (values: NewCardValues) => void;
  onCancel: () => void;
}

export function NewCardDialog({ cell, onConfirm, onCancel }: Props) {
  const cardTypes = useBoardStore((s) => s.cardTypes);
  const teams = useBoardStore((s) => s.teams);
  const sprints = useBoardStore((s) => s.sprints);
  const externalLabel = useBoardStore((s) => s.externalLane.label);

  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState(cardTypes[0]?.id ?? '');
  const [owner, setOwner] = useState(cell.laneId === EXTERNAL_LANE_ID ? '' : cell.laneId);
  const [estimate, setEstimate] = useState('');
  const [party, setParty] = useState('');
  const [size, setSize] = useState<'s' | 'm' | 'l'>('m');

  const external = cell.laneId === EXTERNAL_LANE_ID;
  const laneName = external ? externalLabel : teams.find((t) => t.id === cell.laneId)?.name ?? '?';
  const sprintName = sprints.find((s) => s.id === cell.sprintId)?.name ?? '?';

  const submit = () => {
    if (!title.trim()) return;
    const est = estimate.trim() === '' ? undefined : Number(estimate);
    onConfirm({
      title: title.trim(),
      typeId,
      size,
      owner: owner || undefined,
      estimate: est !== undefined && Number.isFinite(est) ? est : undefined,
      party: external ? party.trim() || undefined : undefined,
    });
  };

  const field = 'w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#e6edf3] text-sm placeholder-[#484f58] focus:outline-none focus:border-amber-400/60';
  const label = 'block text-[11px] uppercase tracking-wider text-[#8b949e] mb-1.5';

  return (
    <div className="fixed inset-0 bg-[#0d1117]/80 flex items-center justify-center z-50">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 w-[420px] shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[#e6edf3] font-semibold">Add card</h3>
          <button onClick={onCancel} className="text-[#8b949e] hover:text-[#e6edf3]" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="text-[11px] font-mono text-[#8b949e] mb-5">{laneName} · {sprintName} · {SLOT_LABEL[cell.slot]}</div>

        <div className="space-y-4">
          <div>
            <label className={label}>Title *</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') onCancel();
              }}
              placeholder="Card tokenisation API"
              className={field}
            />
          </div>

          <div>
            <label className={label}>Type</label>
            <div className="flex flex-wrap gap-1.5">
              {cardTypes.map((t) => {
                const st = cardTypeStyle(t.colour);
                const Icon = cardTypeIcon(t.icon);
                const on = t.id === typeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTypeId(t.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors"
                    style={on
                      ? { color: st.text, background: st.bg, borderColor: st.border }
                      : { color: '#8b949e', borderColor: '#30363d' }}
                  >
                    <Icon size={11} />
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={label}>Size</label>
            <div className="flex gap-1.5">
              {(['s', 'm', 'l'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setSize(k)}
                  aria-pressed={size === k}
                  className={[
                    'w-9 py-1 rounded border text-[11px] font-mono uppercase transition-colors',
                    size === k ? 'border-amber-400/60 text-amber-400 bg-amber-400/10' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]',
                  ].join(' ')}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_88px] gap-3">
            <div>
              <label className={label}>Owner</label>
              <select value={owner} onChange={(e) => setOwner(e.target.value)} className={field}>
                <option value="">No owner</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Estimate</label>
              <input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="8" className={field} />
            </div>
          </div>

          {external && (
            <div>
              <label className={label}>Party</label>
              <input type="text" value={party} onChange={(e) => setParty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Vendor or other programme" className={field} />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm bg-amber-400 text-[#0d1117] font-semibold rounded hover:bg-amber-300 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
