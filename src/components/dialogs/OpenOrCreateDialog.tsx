import { useState } from 'react';
import { FolderOpen, FilePlus, Shield, RotateCcw, Lock, Eye, EyeOff } from 'lucide-react';

export interface CreateBoardOptions {
  title: string;
  piName: string;
  sprintCount: number;
  innovationLast: boolean;
  teamNames: string[];
  passphrase?: string;
}

interface Props {
  onOpen: () => void;
  onCreate: (options: CreateBoardOptions) => void;
  onReopen?: () => void;
  lastFilename?: string | null;
}

export function OpenOrCreateDialog({ onOpen, onCreate, onReopen, lastFilename }: Props) {
  const [mode, setMode] = useState<'choose' | 'create'>('choose');
  const [title, setTitle]       = useState('');
  const [piName, setPiName]     = useState('');
  const [sprintCount, setSprintCount] = useState(5);
  const [innovationLast, setInnovationLast] = useState(true);
  const [teamText, setTeamText] = useState('Team A\nTeam B\nTeam C');
  const [encrypt, setEncrypt]   = useState(false);
  const [pass, setPass]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [show, setShow]         = useState(false);

  const tooShort  = encrypt && pass.length > 0 && pass.length < 8;
  const mismatch  = encrypt && confirm.length > 0 && pass !== confirm;
  const teamNames = teamText.split('\n').map((t) => t.trim()).filter(Boolean);
  const countOk   = Number.isInteger(sprintCount) && sprintCount >= 1 && sprintCount <= 12;
  const canCreate =
    title.trim().length > 0 && countOk && (!encrypt || (pass.length >= 8 && pass === confirm));

  const doCreate = () => {
    if (!canCreate) return;
    onCreate({
      title: title.trim(),
      piName: piName.trim() || title.trim(),
      sprintCount,
      innovationLast: innovationLast && sprintCount > 1,
      teamNames,
      passphrase: encrypt ? pass : undefined,
    });
  };

  const input = 'w-full bg-[var(--c-canvas)] border border-[color:var(--c-border)] rounded px-3 py-2 text-[color:var(--c-text)] text-sm placeholder-[var(--c-text-faint)] focus:outline-none focus:border-amber-400/60';

  if (mode === 'create') {
    return (
      <div className="fixed inset-0 bg-[var(--c-canvas)]/95 flex items-center justify-center z-50">
        <div className="bg-[var(--c-surface)] border border-[color:var(--c-border)] rounded-lg p-8 w-[480px] shadow-2xl">
          <h2 className="text-[color:var(--c-text)] text-lg font-semibold mb-6">New Board</h2>

          <div className="mb-4">
            <label className="block text-[0.6875rem] uppercase tracking-wider text-[color:var(--c-text-muted)] mb-2">Board title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setMode('choose'); }}
              placeholder="PI 2026.4 Platform ART"
              className={input}
            />
          </div>

          <div className="grid grid-cols-[1fr_110px] gap-3 mb-4">
            <div>
              <label className="block text-[0.6875rem] uppercase tracking-wider text-[color:var(--c-text-muted)] mb-2">PI name</label>
              <input type="text" value={piName} onChange={(e) => setPiName(e.target.value)} placeholder="PI 2026.4" className={input} />
            </div>
            <div>
              <label className="block text-[0.6875rem] uppercase tracking-wider text-[color:var(--c-text-muted)] mb-2">Sprints</label>
              <input
                type="number" min={1} max={12} value={sprintCount}
                onChange={(e) => setSprintCount(Math.round(Number(e.target.value)))}
                className={input}
              />
            </div>
          </div>
          {!countOk && <div className="text-[0.6875rem] text-red-400 -mt-2 mb-3">Between 1 and 12 sprints</div>}

          <label className="flex items-center gap-2.5 cursor-pointer mb-4 select-none">
            <input
              type="checkbox"
              checked={innovationLast && sprintCount > 1}
              disabled={sprintCount <= 1}
              onChange={(e) => setInnovationLast(e.target.checked)}
              className="accent-amber-400"
            />
            <span className="text-[0.75rem] text-[color:var(--c-text-muted)]">Last sprint is an Innovation and Planning sprint</span>
          </label>

          <div className="mb-5">
            <label className="block text-[0.6875rem] uppercase tracking-wider text-[color:var(--c-text-muted)] mb-2">Teams (one per line)</label>
            <textarea
              value={teamText}
              onChange={(e) => setTeamText(e.target.value)}
              rows={4}
              className={`${input} resize-none font-mono text-[0.75rem]`}
            />
          </div>

          {/* Encrypt toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer mb-4 select-none">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              className="accent-amber-400"
            />
            <Lock size={12} className={encrypt ? 'text-amber-400' : 'text-[color:var(--c-text-faint)]'} />
            <span className="text-[0.75rem] text-[color:var(--c-text-muted)]">Encrypt with passphrase</span>
          </label>

          {/* Passphrase fields — visible when encrypt is checked */}
          {encrypt && (
            <div className="space-y-2.5 mb-4 pl-5 border-l-2 border-amber-400/20">
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Passphrase (min 8 chars)"
                  className="w-full bg-[var(--c-canvas)] border border-[color:var(--c-border)] rounded px-3 py-2 pr-9 text-[color:var(--c-text)] text-sm placeholder-[var(--c-text-faint)] focus:outline-none focus:border-amber-400/60"
                />
                <button type="button" onClick={() => setShow((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--c-text-faint)] hover:text-[color:var(--c-text-muted)]">
                  {show ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doCreate(); }}
                placeholder="Confirm passphrase"
                className="w-full bg-[var(--c-canvas)] border border-[color:var(--c-border)] rounded px-3 py-2 text-[color:var(--c-text)] text-sm placeholder-[var(--c-text-faint)] focus:outline-none focus:border-amber-400/60"
              />
              {tooShort && <div className="text-[0.6875rem] text-amber-400">Minimum 8 characters</div>}
              {mismatch && <div className="text-[0.6875rem] text-red-400">Passphrases do not match</div>}
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={() => setMode('choose')}
              className="px-4 py-2 text-sm text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)] transition-colors"
            >
              Back
            </button>
            <button
              onClick={doCreate}
              disabled={!canCreate}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-400 text-[color:var(--c-on-accent)] font-semibold rounded hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {encrypt && <Lock size={12} />}
              {encrypt ? 'Encrypt & Create' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[var(--c-canvas)] flex items-center justify-center z-50">
      <div className="bg-[var(--c-surface)] border border-[color:var(--c-border)] rounded-lg p-10 w-120 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <Shield size={20} className="text-amber-400" />
          <span className="text-amber-400 text-xs font-mono uppercase tracking-widest">PI Board</span>
        </div>
        <h1 className="text-[color:var(--c-text)] text-2xl font-bold mb-2">PI Planning Dependency Board</h1>
        <p className="text-[color:var(--c-text-muted)] text-sm mb-8">Privacy-first. Offline. No telemetry.</p>

        {lastFilename && onReopen && (
          <button
            onClick={onReopen}
            className="w-full flex items-center gap-3 px-4 py-3 mb-4 rounded border border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/10 hover:border-amber-400/60 transition-all group text-left"
          >
            <RotateCcw size={16} className="text-amber-400 shrink-0" />
            <div>
              <div className="text-sm font-medium text-amber-400">Continue last session</div>
              <div className="text-[0.6875rem] text-[color:var(--c-text-muted)] font-mono truncate max-w-85">{lastFilename}</div>
            </div>
          </button>
        )}

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onOpen}
            className="flex flex-col items-center gap-3 p-6 rounded border border-[color:var(--c-border)] hover:border-amber-400/40 hover:bg-[var(--c-raised)] transition-all group"
          >
            <FolderOpen size={28} className="text-[color:var(--c-text-muted)] group-hover:text-amber-400 transition-colors" />
            <span className="text-sm font-medium text-[color:var(--c-text)]">Open Existing</span>
            <span className="text-[0.6875rem] text-[color:var(--c-text-muted)]">.piboard file</span>
          </button>
          <button
            onClick={() => setMode('create')}
            className="flex flex-col items-center gap-3 p-6 rounded border border-[color:var(--c-border)] hover:border-amber-400/40 hover:bg-[var(--c-raised)] transition-all group"
          >
            <FilePlus size={28} className="text-[color:var(--c-text-muted)] group-hover:text-amber-400 transition-colors" />
            <span className="text-sm font-medium text-[color:var(--c-text)]">New Board</span>
            <span className="text-[0.6875rem] text-[color:var(--c-text-muted)]">Start fresh</span>
          </button>
        </div>
      </div>
    </div>
  );
}
