import { useEffect, useState } from 'react';
import { X, ArrowUp, ArrowDown, Trash2, Plus, ExternalLink } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import {
  countCardsInLane, countCardsInSprint, countCardsOfType,
  deleteTeam, deleteSprint, deleteCardType, type TeamResolution,
} from '../../store/boardActions';
import { ALL_CARD_TYPE_ICONS, CARD_TYPE_ICONS, cardTypeStyle, isValidHex } from '../../lib/cardTypeStyle';
import { COLOUR_PRESETS, PROTECTED_CARD_TYPE_IDS } from '../../board/defaults';
import { EXTERNAL_LANE_ID } from '../../types';

type Tab = 'teams' | 'sprints' | 'types';

interface Props {
  initialTab?: Tab;
  onClose: () => void;
}

const field = 'bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1.5 text-[#e6edf3] text-[13px] placeholder-[#484f58] focus:outline-none focus:border-amber-400/60';
const label = 'block text-[10px] uppercase tracking-wider text-[#8b949e] mb-1.5 font-mono';
const iconBtn = 'p-1 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-[#8b949e]';

// ── Colour picker: presets plus a native input ───────────────────────────────

function ColourPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {COLOUR_PRESETS.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(hex)}
          title={hex}
          aria-label={`Colour ${hex}`}
          className="w-4 h-4 rounded-sm border"
          style={{ background: hex, borderColor: value.toLowerCase() === hex ? '#e6edf3' : 'transparent' }}
        />
      ))}
      <input
        type="color"
        value={isValidHex(value) ? value : '#58a6ff'}
        onChange={(e) => { if (isValidHex(e.target.value)) onChange(e.target.value); }}
        className="w-5 h-5 p-0 bg-transparent border border-[#30363d] rounded cursor-pointer"
        aria-label="Custom colour"
      />
    </div>
  );
}

// ── Guarded delete prompt ─────────────────────────────────────────────────────

interface ResolveProps {
  title: string;
  message: string;
  options: { value: string; label: string }[];
  allowDelete?: boolean;
  deleteLabel?: string;
  confirmLabel: string;
  onConfirm: (value: string | 'delete') => void;
  onCancel: () => void;
}

function ResolvePrompt({ title, message, options, allowDelete, deleteLabel, confirmLabel, onConfirm, onCancel }: ResolveProps) {
  const [choice, setChoice] = useState<string>(options[0]?.value ?? (allowDelete ? 'delete' : ''));
  return (
    <div className="absolute inset-0 bg-[#0d1117]/85 flex items-center justify-center z-10 rounded-lg">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5 w-[360px] shadow-2xl">
        <h4 className="text-[#e6edf3] text-sm font-semibold mb-1.5">{title}</h4>
        <p className="text-[12px] text-[#8b949e] mb-4 leading-relaxed">{message}</p>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={`${field} w-full mb-5`}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {allowDelete && <option value="delete">{deleteLabel ?? 'Delete the cards'}</option>}
        </select>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3]">Cancel</button>
          <button
            onClick={() => onConfirm(choice)}
            disabled={!choice}
            className={[
              'px-3 py-1.5 text-sm font-semibold rounded disabled:opacity-40',
              choice === 'delete' ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-amber-400 text-[#0d1117] hover:bg-amber-300',
            ].join(' ')}
          >
            {choice === 'delete' ? 'Delete cards' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Teams ─────────────────────────────────────────────────────────────────────

function TeamsTab({ onResolve }: { onResolve: (id: string) => void }) {
  const teams = useBoardStore((s) => s.teams);
  const externalLabel = useBoardStore((s) => s.externalLane.label);
  const { updateTeam, moveTeam, addTeam, setExternalLabel } = useBoardStore.getState();

  return (
    <div>
      <div className="space-y-2">
        {teams.map((t, i) => (
          <div key={t.id} className="flex items-center gap-2 p-2 rounded border border-[#30363d] bg-[#0d1117]">
            <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: t.colour }} />
            <div className="flex-1 min-w-0 space-y-2">
              <input
                value={t.name}
                onChange={(e) => updateTeam(t.id, { name: e.target.value })}
                className={`${field} w-full`}
                aria-label="Team name"
              />
              <ColourPicker value={t.colour} onChange={(hex) => updateTeam(t.id, { colour: hex })} />
            </div>
            <div className="flex flex-col gap-0.5">
              <button className={iconBtn} disabled={i === 0} onClick={() => moveTeam(t.id, i - 1)} aria-label="Move up"><ArrowUp size={13} /></button>
              <button className={iconBtn} disabled={i === teams.length - 1} onClick={() => moveTeam(t.id, i + 1)} aria-label="Move down"><ArrowDown size={13} /></button>
            </div>
            <button
              className={`${iconBtn} hover:!text-red-400`}
              onClick={() => (countCardsInLane(t.id) > 0 ? onResolve(t.id) : deleteTeam(t.id))}
              aria-label="Delete team"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => addTeam()} className="mt-3 flex items-center gap-1.5 text-[12px] text-[#8b949e] hover:text-amber-400">
        <Plus size={12} /> Add team
      </button>

      <div className="mt-6 pt-4 border-t border-[#21262d]">
        <label className={label}>External row label</label>
        <div className="flex items-center gap-2">
          <ExternalLink size={13} className="text-[#8b949e]" />
          <input value={externalLabel} onChange={(e) => setExternalLabel(e.target.value)} className={`${field} flex-1`} />
        </div>
        <p className="text-[11px] text-[#484f58] mt-2">The external row is not a team. It always sits last and cannot be deleted or reordered.</p>
      </div>
    </div>
  );
}

// ── Sprints ───────────────────────────────────────────────────────────────────

function SprintsTab({ onResolve }: { onResolve: (id: string) => void }) {
  const pi = useBoardStore((s) => s.pi);
  const sprints = useBoardStore((s) => s.sprints);
  const { setPi, updateSprint, moveSprint, addSprint, autofillSprintDates } = useBoardStore.getState();
  const [offerFill, setOfferFill] = useState(false);

  return (
    <div>
      <div className="grid grid-cols-[1fr_150px] gap-3 mb-2">
        <div>
          <label className={label}>PI name</label>
          <input value={pi.name} onChange={(e) => setPi({ name: e.target.value })} className={`${field} w-full`} />
        </div>
        <div>
          <label className={label}>Start date</label>
          <input
            type="date"
            value={pi.startDate ?? ''}
            onChange={(e) => { setPi({ startDate: e.target.value || undefined }); setOfferFill(Boolean(e.target.value)); }}
            className={`${field} w-full`}
          />
        </div>
      </div>
      {offerFill && pi.startDate && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded border border-amber-400/30 bg-amber-400/5 text-[12px] text-[#8b949e]">
          <span className="flex-1">Fill sprint dates from this start date in two-week blocks? This replaces existing dates.</span>
          <button onClick={() => { autofillSprintDates(); setOfferFill(false); }} className="px-2.5 py-1 rounded bg-amber-400 text-[#0d1117] font-semibold hover:bg-amber-300">Fill</button>
          <button onClick={() => setOfferFill(false)} className="text-[#8b949e] hover:text-[#e6edf3]">No thanks</button>
        </div>
      )}

      <div className="space-y-2 mt-4">
        {sprints.map((sp, i) => (
          <div key={sp.id} className="flex items-center gap-2 p-2 rounded border border-[#30363d] bg-[#0d1117]">
            <div className="flex-1 min-w-0 grid grid-cols-[1fr_130px_130px] gap-2 items-center">
              <input value={sp.name} onChange={(e) => updateSprint(sp.id, { name: e.target.value })} className={field} aria-label="Sprint name" />
              <input type="date" value={sp.start ?? ''} onChange={(e) => updateSprint(sp.id, { start: e.target.value || undefined })} className={field} aria-label="Start" />
              <input type="date" value={sp.end ?? ''} onChange={(e) => updateSprint(sp.id, { end: e.target.value || undefined })} className={field} aria-label="End" />
              <label className="col-span-3 flex items-center gap-2 text-[11px] text-[#8b949e] select-none cursor-pointer">
                <input type="checkbox" checked={Boolean(sp.isInnovation)} onChange={(e) => updateSprint(sp.id, { isInnovation: e.target.checked || undefined })} className="accent-amber-400" />
                Innovation and Planning sprint
              </label>
            </div>
            <div className="flex flex-col gap-0.5">
              <button className={iconBtn} disabled={i === 0} onClick={() => moveSprint(sp.id, i - 1)} aria-label="Move earlier"><ArrowUp size={13} /></button>
              <button className={iconBtn} disabled={i === sprints.length - 1} onClick={() => moveSprint(sp.id, i + 1)} aria-label="Move later"><ArrowDown size={13} /></button>
            </div>
            <button
              className={`${iconBtn} hover:!text-red-400`}
              disabled={sprints.length <= 1}
              title={sprints.length <= 1 ? 'A board needs at least one sprint' : 'Delete sprint'}
              onClick={() => (countCardsInSprint(sp.id) > 0 ? onResolve(sp.id) : deleteSprint(sp.id))}
              aria-label="Delete sprint"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => addSprint()} className="mt-3 flex items-center gap-1.5 text-[12px] text-[#8b949e] hover:text-amber-400">
        <Plus size={12} /> Add sprint
      </button>
    </div>
  );
}

// ── Card types ────────────────────────────────────────────────────────────────

function TypesTab({ onResolve }: { onResolve: (id: string) => void }) {
  const cardTypes = useBoardStore((s) => s.cardTypes);
  const { updateCardType, moveCardType, addCardType, restoreDefaultCardTypes } = useBoardStore.getState();

  return (
    <div>
      <div className="space-y-2">
        {cardTypes.map((t, i) => {
          const st = cardTypeStyle(t.colour);
          const Icon = CARD_TYPE_ICONS[t.icon];
          return (
            <div key={t.id} className="flex items-start gap-2 p-2 rounded border border-[#30363d] bg-[#0d1117]">
              <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: st.bar }} />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-1 rounded border text-[10px] font-mono shrink-0" style={{ color: st.text, background: st.bg, borderColor: st.border }}>
                    <Icon size={11} />
                  </span>
                  <input value={t.name} onChange={(e) => updateCardType(t.id, { name: e.target.value })} className={`${field} flex-1 min-w-0`} aria-label="Type name" />
                  <span className="text-[10px] font-mono text-[#484f58] shrink-0">{countCardsOfType(t.id)} cards</span>
                </div>
                <ColourPicker value={t.colour} onChange={(hex) => updateCardType(t.id, { colour: hex })} />
                <div className="flex flex-wrap gap-1">
                  {ALL_CARD_TYPE_ICONS.map((key) => {
                    const I = CARD_TYPE_ICONS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        title={key}
                        aria-label={key}
                        onClick={() => updateCardType(t.id, { icon: key })}
                        className={[
                          'p-1 rounded border',
                          t.icon === key ? 'border-amber-400/70 text-amber-400' : 'border-[#30363d] text-[#8b949e] hover:text-[#e6edf3]',
                        ].join(' ')}
                      >
                        <I size={12} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <button className={iconBtn} disabled={i === 0} onClick={() => moveCardType(t.id, i - 1)} aria-label="Move up"><ArrowUp size={13} /></button>
                <button className={iconBtn} disabled={i === cardTypes.length - 1} onClick={() => moveCardType(t.id, i + 1)} aria-label="Move down"><ArrowDown size={13} /></button>
              </div>
              <button
                className={`${iconBtn} hover:!text-red-400`}
                disabled={cardTypes.length <= 1 || PROTECTED_CARD_TYPE_IDS.includes(t.id)}
                title={PROTECTED_CARD_TYPE_IDS.includes(t.id) ? `${t.name} is a built-in type and cannot be deleted` : cardTypes.length <= 1 ? 'A board needs at least one card type' : 'Delete type'}
                onClick={() => (countCardsOfType(t.id) > 0 ? onResolve(t.id) : deleteCardType(t.id))}
                aria-label="Delete type"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button onClick={() => addCardType()} className="flex items-center gap-1.5 text-[12px] text-[#8b949e] hover:text-amber-400">
          <Plus size={12} /> Add card type
        </button>
        <button
          onClick={() => restoreDefaultCardTypes()}
          title="Adds back any default type that is missing, such as Requirement and Dependency. Existing types are untouched."
          className="text-[12px] text-[#8b949e] hover:text-amber-400"
        >
          Restore missing default types
        </button>
      </div>
      <p className="text-[11px] text-[#484f58] mt-3">Type is always shown as icon plus label, so the board still reads in greyscale.</p>
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

type Pending = { kind: 'team' | 'sprint' | 'type'; id: string } | null;

export function BoardSettingsDialog({ initialTab = 'teams', onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, setPending] = useState<Pending>(null);
  const teams = useBoardStore((s) => s.teams);
  const sprints = useBoardStore((s) => s.sprints);
  const cardTypes = useBoardStore((s) => s.cardTypes);
  const externalLabel = useBoardStore((s) => s.externalLane.label);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pending) setPending(null);
      else onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, pending]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'teams', label: 'Teams' },
    { id: 'sprints', label: 'Sprints' },
    { id: 'types', label: 'Card types' },
  ];

  let prompt: React.ReactNode = null;
  if (pending?.kind === 'team') {
    const team = teams.find((t) => t.id === pending.id);
    const n = countCardsInLane(pending.id);
    prompt = (
      <ResolvePrompt
        title={`Delete ${team?.name ?? 'team'}?`}
        message={`${n} card${n === 1 ? '' : 's'} sit in this team's lane. Choose where they go.`}
        options={[
          ...teams.filter((t) => t.id !== pending.id).map((t) => ({ value: t.id, label: `Move to ${t.name}` })),
          { value: EXTERNAL_LANE_ID, label: `Move to ${externalLabel}` },
        ]}
        allowDelete
        confirmLabel="Move and delete team"
        onCancel={() => setPending(null)}
        onConfirm={(v) => {
          const resolution: TeamResolution = v === 'delete' ? { type: 'delete' } : { type: 'move', to: v };
          deleteTeam(pending.id, resolution);
          setPending(null);
        }}
      />
    );
  } else if (pending?.kind === 'sprint') {
    const sp = sprints.find((s) => s.id === pending.id);
    const n = countCardsInSprint(pending.id);
    prompt = (
      <ResolvePrompt
        title={`Delete ${sp?.name ?? 'sprint'}?`}
        message={`${n} card${n === 1 ? '' : 's'} are scheduled in this sprint. Choose which sprint they move to.`}
        options={sprints.filter((s) => s.id !== pending.id).map((s) => ({ value: s.id, label: `Move to ${s.name}` }))}
        confirmLabel="Move and delete sprint"
        onCancel={() => setPending(null)}
        onConfirm={(v) => { deleteSprint(pending.id, v); setPending(null); }}
      />
    );
  } else if (pending?.kind === 'type') {
    const t = cardTypes.find((x) => x.id === pending.id);
    const n = countCardsOfType(pending.id);
    prompt = (
      <ResolvePrompt
        title={`Delete ${t?.name ?? 'type'}?`}
        message={`${n} card${n === 1 ? '' : 's'} use this type. Choose the type they become.`}
        options={cardTypes.filter((x) => x.id !== pending.id).map((x) => ({ value: x.id, label: `Reassign to ${x.name}` }))}
        confirmLabel="Reassign and delete type"
        onCancel={() => setPending(null)}
        onConfirm={(v) => { deleteCardType(pending.id, v); setPending(null); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0d1117]/80 flex items-center justify-center z-50 p-4">
      <div className="relative bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl w-full max-w-[640px] max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] shrink-0">
          <h3 className="text-[#e6edf3] font-semibold">Board settings</h3>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b border-[#30363d] shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'px-3 py-2 text-[12px] -mb-px border-b-2 transition-colors',
                tab === t.id ? 'border-amber-400 text-amber-400' : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'teams' && <TeamsTab onResolve={(id) => setPending({ kind: 'team', id })} />}
          {tab === 'sprints' && <SprintsTab onResolve={(id) => setPending({ kind: 'sprint', id })} />}
          {tab === 'types' && <TypesTab onResolve={(id) => setPending({ kind: 'type', id })} />}
        </div>

        <div className="px-6 py-3 border-t border-[#30363d] text-right shrink-0">
          <button onClick={onClose} className="bg-amber-400 hover:bg-amber-300 px-5 py-1.5 rounded font-semibold text-[#0d1117] text-sm transition-colors">Done</button>
        </div>

        {prompt}
      </div>
    </div>
  );
}
