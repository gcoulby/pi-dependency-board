import { useState, useRef } from 'react';
import { X, Plus, Trash2, Paperclip, FileText, BookOpen, ArrowRight } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCardStore } from '../../store/cardStore';
import { useBoardStore } from '../../store/boardStore';
import { useViewStore } from '../../store/viewStore';
import { assetMap } from '../../hooks/useAutoSave';
import { cacheAsset } from '../../lib/assetCache';
import { cardTypeIcon, cardTypeStyle } from '../../lib/cardTypeStyle';
import { checkSchedule } from '../../board/dependencies';
import { EXTERNAL_LANE_ID, type CardAttachment } from '../../types';

interface Props {
  cardId: string;
  onClose: () => void;
  onOpenEditor: (cardId: string) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1.5 font-mono">{children}</div>
  );
}

const input = 'w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-[#e6edf3] text-sm placeholder-[#3a3f47] focus:outline-none focus:border-amber-400/60';

export function CardPanel({ cardId, onClose, onOpenEditor }: Props) {
  const card = useCardStore((s) => s.cards.find((c) => c.id === cardId));
  const cards = useCardStore((s) => s.cards);
  const dependencies = useCardStore((s) => s.dependencies);
  const updateCard = useCardStore((s) => s.updateCard);
  const deleteCard = useCardStore((s) => s.deleteCard);
  const moveCard = useCardStore((s) => s.moveCard);

  const teams = useBoardStore((s) => s.teams);
  const sprints = useBoardStore((s) => s.sprints);
  const cardTypes = useBoardStore((s) => s.cardTypes);
  const externalLabel = useBoardStore((s) => s.externalLane.label);

  const [newTag, setNewTag] = useState('');
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropVal, setNewPropVal] = useState('');
  const attachInputRef = useRef<HTMLInputElement>(null);

  if (!card) return null;

  const allTags = Array.from(new Set(cards.flatMap((c) => c.tags))).sort();
  const external = card.laneId === EXTERNAL_LANE_ID;

  const waitsOn = dependencies.filter((d) => d.to === cardId);
  const neededBy = dependencies.filter((d) => d.from === cardId);
  const titleOf = (id: string) => cards.find((c) => c.id === id)?.title ?? 'Unknown card';

  // ── Attachments ────────────────────────────────────────────────────────────

  const uploadAttachment = async (file: File) => {
    const ext = file.name.split('.').pop() ?? 'bin';
    const assetId = `${nanoid()}.${ext}`;
    const buffer = await file.arrayBuffer();
    assetMap.set(assetId, buffer);
    if (file.type.startsWith('image/')) cacheAsset(assetId, buffer, file.type);
    const attachment: CardAttachment = { id: assetId, filename: file.name, size: file.size, mimeType: file.type };
    updateCard(cardId, { attachments: [...(card.attachments ?? []), attachment] });
  };

  const removeAttachment = (id: string) => {
    updateCard(cardId, { attachments: (card.attachments ?? []).filter((a) => a.id !== id) });
  };

  const downloadAttachment = (att: CardAttachment) => {
    const buffer = assetMap.get(att.id);
    if (!buffer) return;
    const url = URL.createObjectURL(new Blob([buffer], { type: att.mimeType }));
    const a = document.createElement('a');
    a.href = url; a.download = att.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (b: number) =>
    b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1048576).toFixed(1)}MB`;

  const addProp = () => {
    if (!newPropKey.trim()) return;
    updateCard(cardId, { properties: { ...card.properties, [newPropKey.trim()]: newPropVal.trim() } });
    setNewPropKey(''); setNewPropVal('');
  };

  return (
    <div className="w-80 h-full bg-[#161b22] border-l border-[#30363d] flex flex-col overflow-hidden shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-[#8b949e] font-mono">Card</span>
        <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]" aria-label="Close panel"><X size={14} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Title */}
          <div>
            <SectionLabel>Title</SectionLabel>
            <textarea
              value={card.title}
              rows={2}
              onChange={(e) => updateCard(cardId, { title: e.target.value })}
              className={`${input} resize-none font-semibold`}
            />
          </div>

          {/* Type */}
          <div>
            <SectionLabel>Type</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {cardTypes.map((t) => {
                const st = cardTypeStyle(t.colour);
                const Icon = cardTypeIcon(t.icon);
                const on = t.id === card.typeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => updateCard(cardId, { typeId: t.id })}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] transition-colors"
                    style={on ? { color: st.text, background: st.bg, borderColor: st.border } : { color: '#8b949e', borderColor: '#30363d' }}
                  >
                    <Icon size={10} />
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size */}
          <div>
            <SectionLabel>Size on board</SectionLabel>
            <div className="flex gap-1.5" role="group" aria-label="Card size">
              {(['s', 'm', 'l'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => updateCard(cardId, { size: k })}
                  aria-pressed={(card.size ?? 'm') === k}
                  title={{ s: 'Small', m: 'Medium', l: 'Large' }[k]}
                  className={[
                    'w-9 py-1 rounded border text-[11px] font-mono uppercase transition-colors',
                    (card.size ?? 'm') === k ? 'border-amber-400/60 text-amber-400 bg-amber-400/10' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]',
                  ].join(' ')}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Placement */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <SectionLabel>Team</SectionLabel>
              <select
                value={card.laneId}
                onChange={(e) => moveCard(cardId, e.target.value, card.sprintId, Number.MAX_SAFE_INTEGER)}
                className={input}
              >
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                <option value={EXTERNAL_LANE_ID}>{externalLabel}</option>
              </select>
            </div>
            <div>
              <SectionLabel>Sprint</SectionLabel>
              <select
                value={card.sprintId}
                onChange={(e) => moveCard(cardId, card.laneId, e.target.value, Number.MAX_SAFE_INTEGER)}
                className={input}
              >
                {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Where in the sprint */}
          <div>
            <SectionLabel>In sprint</SectionLabel>
            <div className="flex gap-1.5" role="group" aria-label="Position in sprint">
              {(['start', 'mid', 'end'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => moveCard(cardId, card.laneId, card.sprintId, Number.MAX_SAFE_INTEGER, k)}
                  aria-pressed={(card.slot ?? 'mid') === k}
                  className={[
                    'flex-1 py-1 rounded border text-[11px] capitalize transition-colors',
                    (card.slot ?? 'mid') === k ? 'border-amber-400/60 text-amber-400 bg-amber-400/10' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]',
                  ].join(' ')}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Owner + estimate */}
          <div className="grid grid-cols-[1fr_84px] gap-2">
            <div>
              <SectionLabel>Owner</SectionLabel>
              <select value={card.owner ?? ''} onChange={(e) => updateCard(cardId, { owner: e.target.value || undefined })} className={input}>
                <option value="">No owner</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <SectionLabel>Estimate</SectionLabel>
              <input
                type="number" min={0}
                value={card.estimate ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  updateCard(cardId, { estimate: v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v) });
                }}
                className={input}
              />
            </div>
          </div>

          {external && (
            <div>
              <SectionLabel>Party</SectionLabel>
              <input type="text" value={card.party ?? ''} placeholder="Vendor or other programme"
                onChange={(e) => updateCard(cardId, { party: e.target.value || undefined })} className={input} />
            </div>
          )}

          {/* Description */}
          <div>
            <SectionLabel>Description</SectionLabel>
            <textarea
              value={card.description ?? ''}
              rows={4}
              onChange={(e) => updateCard(cardId, { description: e.target.value || undefined })}
              placeholder="What is being delivered, and what does done look like?"
              className={`${input} text-[12px] leading-relaxed resize-y`}
            />
          </div>

          {/* Dependencies */}
          <div>
            <SectionLabel>Dependencies</SectionLabel>
            {waitsOn.length === 0 && neededBy.length === 0 && (
              <div className="text-[11px] text-[#3a3f47]">None. Drag from the right dot of a card to link.</div>
            )}
            {[{ heading: 'Waits on', list: waitsOn, other: 'from' as const }, { heading: 'Needed by', list: neededBy, other: 'to' as const }].map(
              (g) => g.list.length > 0 && (
                <div key={g.heading} className="mb-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#484f58] font-mono mb-1">{g.heading}</div>
                  <div className="space-y-1">
                    {g.list.map((d) => {
                      const check = checkSchedule(d, cards, sprints);
                      return (
                        <button
                          key={d.id}
                          onClick={() => useViewStore.getState().openDependency(d.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-[#0d1117] border border-[#30363d] hover:border-[#484f58] text-left"
                        >
                          <ArrowRight size={10} className="text-[#484f58] shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[11px] text-[#e6edf3] truncate">{titleOf(d[g.other])}</span>
                            {d.label && <span className="block text-[10px] text-[#8b949e] truncate">{d.label}</span>}
                          </span>
                          {check === 'conflict' && <span className="text-[9px] font-mono text-[#f85149] shrink-0">conflict</span>}
                          {check === 'same-sprint' && <span className="text-[9px] font-mono text-[#f0883e] shrink-0">same sprint</span>}
                          <span className="text-[9px] font-mono text-[#484f58] shrink-0">{d.state}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Document editor */}
          <div>
            <SectionLabel>Detail</SectionLabel>
            <button
              onClick={() => onOpenEditor(cardId)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded border border-[#30363d] hover:border-amber-400/40 hover:bg-amber-400/5 transition-colors group text-left"
            >
              <BookOpen size={14} className={card.hasContent ? 'text-amber-400' : 'text-[#484f58] group-hover:text-amber-400'} />
              <div>
                <div className={`text-[12px] font-medium ${card.hasContent ? 'text-amber-400' : 'text-[#8b949e] group-hover:text-[#e6edf3]'}`}>
                  {card.hasContent ? 'Open detail' : 'Add detail'}
                </div>
                <div className="text-[10px] text-[#484f58]">
                  {card.hasContent ? 'Block-based rich text editor' : 'Headings, lists, tables, images…'}
                </div>
              </div>
            </button>
          </div>

          {/* Tags */}
          <div>
            <SectionLabel>Tags</SectionLabel>
            <div className="flex flex-wrap gap-1 mb-2">
              {card.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                  {tag}
                  <button onClick={() => updateCard(cardId, { tags: card.tags.filter((t) => t !== tag) })}
                    className="hover:text-red-400 transition-colors" aria-label={`Remove tag ${tag}`}><X size={9} /></button>
                </span>
              ))}
            </div>
            <input type="text" value={newTag} list="tag-suggestions" placeholder="Add tag and press Enter…"
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTag.trim()) {
                  if (!card.tags.includes(newTag.trim())) updateCard(cardId, { tags: [...card.tags, newTag.trim()] });
                  setNewTag('');
                }
              }}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#e6edf3] text-xs placeholder-[#3a3f47] focus:outline-none focus:border-amber-400/60"
            />
            <datalist id="tag-suggestions">
              {allTags.filter((t) => !card.tags.includes(t)).map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>

          {/* Properties */}
          <div>
            <SectionLabel>Properties</SectionLabel>
            <div className="space-y-1.5">
              {Object.entries(card.properties).map(([k, v]) => (
                <div key={k} className="flex gap-1.5 items-center">
                  <input type="text" value={k}
                    onChange={(e) => {
                      const props = { ...card.properties }; delete props[k]; props[e.target.value] = v;
                      updateCard(cardId, { properties: props });
                    }}
                    className="w-24 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[10px] text-[#8b949e] focus:outline-none focus:border-amber-400/60 font-mono"
                  />
                  <input type="text" value={v}
                    onChange={(e) => updateCard(cardId, { properties: { ...card.properties, [k]: e.target.value } })}
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[11px] text-[#e6edf3] focus:outline-none focus:border-amber-400/60"
                  />
                  <button onClick={() => { const p = { ...card.properties }; delete p[k]; updateCard(cardId, { properties: p }); }}
                    className="text-[#484f58] hover:text-red-400 transition-colors" aria-label="Remove property">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              <input type="text" value={newPropKey} placeholder="key"
                onChange={(e) => setNewPropKey(e.target.value)}
                className="w-24 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[10px] text-[#8b949e] placeholder-[#3a3f47] focus:outline-none focus:border-amber-400/60 font-mono"
              />
              <input type="text" value={newPropVal} placeholder="value"
                onChange={(e) => setNewPropVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addProp(); }}
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[11px] text-[#e6edf3] placeholder-[#3a3f47] focus:outline-none focus:border-amber-400/60"
              />
              <button onClick={addProp} className="text-amber-400 hover:text-amber-300" aria-label="Add property"><Plus size={14} /></button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <SectionLabel>Attachments</SectionLabel>
            {(card.attachments ?? []).length === 0 ? (
              <div className="text-[11px] text-[#3a3f47] mb-2">No files attached</div>
            ) : (
              <div className="space-y-1 mb-2">
                {(card.attachments ?? []).map((att) => (
                  <div key={att.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#0d1117] border border-[#30363d] group">
                    <FileText size={10} className="text-[#484f58] shrink-0" />
                    <button onClick={() => downloadAttachment(att)}
                      className="flex-1 text-left text-[11px] text-[#8b949e] hover:text-[#e6edf3] truncate transition-colors">
                      {att.filename}
                    </button>
                    <span className="text-[10px] text-[#3a3f47] font-mono shrink-0">{formatSize(att.size)}</span>
                    <button onClick={() => removeAttachment(att.id)}
                      className="text-[#484f58] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" aria-label="Remove attachment">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => attachInputRef.current?.click()}
              className="flex items-center gap-2 text-[11px] text-[#484f58] hover:text-amber-400 transition-colors">
              <Paperclip size={11} />Attach file
            </button>
            <input ref={attachInputRef} type="file" className="hidden" multiple
              onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => void uploadAttachment(f)); e.target.value = ''; }} />
          </div>

          {/* Timestamps */}
          <div className="text-[10px] text-[#3a3f47] font-mono space-y-0.5 pb-2">
            <div>created {new Date(card.createdAt).toLocaleString()}</div>
            <div>updated {new Date(card.updatedAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Delete */}
      <div className="p-3 border-t border-[#30363d] shrink-0">
        <button onClick={() => { deleteCard(cardId); onClose(); }}
          className="w-full py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors">
          Delete card
        </button>
      </div>
    </div>
  );
}
