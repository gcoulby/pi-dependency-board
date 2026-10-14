import { X, Shield, Lock, Keyboard, FileArchive, Layers } from 'lucide-react'

interface Props {
  onClose: () => void
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-amber-400">{icon}</span>
        <h3 className="font-mono text-[0.6875rem] text-amber-400 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function KbRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-[color:var(--c-subtle)] last:border-0 border-b">
      <span className="text-[color:var(--c-text-muted)] text-[0.6875rem]">{action}</span>
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="bg-[var(--c-subtle)] px-1.5 py-0.5 border border-[color:var(--c-border)] rounded font-mono text-[color:var(--c-text)] text-[0.625rem]">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  )
}

export function InfoPanel({ onClose }: Props) {
  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-[var(--c-canvas)]/80 p-4">
      <div className="flex flex-col bg-[var(--c-surface)] shadow-2xl border border-[color:var(--c-border)] rounded-lg w-full max-w-[600px] max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-[color:var(--c-border)] border-b shrink-0">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-amber-400" />
            <div>
              <div className="font-bold text-[color:var(--c-text)] text-sm">PI Board</div>
              <div className="font-mono text-[color:var(--c-text-muted)] text-[0.625rem]">PI Planning Dependency Board · v1.0</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 overflow-y-auto">
          <Section icon={<Layers size={14} />} title="What is PI Board?">
            <p className="text-[color:var(--c-text-muted)] text-[0.75rem] leading-relaxed">
              PI Board is the wall at a PI planning event. Teams run down the side, sprints run across the top, and cards sit in the cells. A
              separate row holds external dependencies: work owned by people outside the programme. The whole board lives in a single{' '}
              <code className="bg-[var(--c-subtle)] px-1 rounded text-amber-400">.piboard</code> file on your disk.
            </p>
            <p className="mt-2 text-[color:var(--c-text-muted)] text-[0.75rem] leading-relaxed">
              Draw an arrow from the card that must be delivered first to the card that needs it. The board flags any dependency that cannot
              work on the schedule as drawn: a thick red dashed line means the provider is scheduled after the card waiting on it.
            </p>
          </Section>

          <Section icon={<Lock size={14} />} title="Privacy & Security">
            <div className="space-y-2 text-[color:var(--c-text-muted)] text-[0.75rem]">
              <div className="flex gap-2">
                <span className="mt-0.5 text-amber-400 shrink-0">→</span>
                <span>
                  <strong className="text-[color:var(--c-text)]">Fully offline.</strong> Zero network requests at runtime. No analytics, no telemetry, no CDN
                  calls.
                </span>
              </div>
              <div className="flex gap-2">
                <span className="mt-0.5 text-amber-400 shrink-0">→</span>
                <span>
                  <strong className="text-[color:var(--c-text)]">Single-file storage.</strong> Everything lives in the{' '}
                  <code className="bg-[var(--c-subtle)] px-1 rounded text-amber-400">.piboard</code> file — a ZIP archive you control.
                </span>
              </div>
              <div className="flex gap-2">
                <span className="mt-0.5 text-amber-400 shrink-0">→</span>
                <span>
                  <strong className="text-[color:var(--c-text)]">No cloud.</strong> No accounts, no sync services, no external dependencies at runtime.
                </span>
              </div>
              <div className="flex gap-2">
                <span className="mt-0.5 text-amber-400 shrink-0">→</span>
                <span>
                  <strong className="text-[color:var(--c-text)]">USB-safe.</strong> The app can run as a static bundle from a USB stick or local file server.
                </span>
              </div>
              <div className="flex gap-2 bg-amber-400/5 mt-3 p-3 border border-amber-400/20 rounded">
                <span className="mt-0.5 text-amber-400 shrink-0">⚠</span>
                <span>
                  <strong className="text-amber-400">Note:</strong> Files are only encrypted if you choose a passphrase when creating the board.
                  There is no way to recover a lost passphrase. Two people editing copies of the same file will diverge, and there is no merge.
                </span>
              </div>
            </div>
          </Section>

          <Section icon={<Keyboard size={14} />} title="Keyboard Shortcuts">
            <div className="bg-[var(--c-canvas)] p-3 border border-[color:var(--c-border)] rounded">
              <KbRow keys={['/']} action="Open search" />
              <KbRow keys={['Ctrl', 'K']} action="Open or close search" />
              <KbRow keys={['[']} action="Hide or show the sidebar" />
              <KbRow keys={['F']} action="Full-screen canvas (Esc to leave)" />
              <KbRow keys={['Esc']} action="Close panel / cancel linking" />
              <KbRow keys={['Del']} action="Delete selected card or dependency" />
              <KbRow keys={['Double-click', 'cell']} action="Add a card to that cell" />
              <KbRow keys={['Drag', 'card']} action="Move to another cell" />
              <KbRow keys={['Drag', 'right dot']} action="Make this card a prerequisite" />
              <KbRow keys={['Click', 'card']} action="Focus: light up its chain" />
              <KbRow keys={['Right-click']} action="Context menu" />
              <KbRow keys={['Double-click', 'header']} action="Rename team or sprint" />
            </div>
          </Section>

          <Section icon={<FileArchive size={14} />} title="File Format">
            <p className="mb-2 text-[color:var(--c-text-muted)] text-[0.75rem] leading-relaxed">
              A <code className="bg-[var(--c-subtle)] px-1 rounded text-amber-400">.piboard</code> file is a standard ZIP archive containing:
            </p>
            <div className="space-y-1 bg-[var(--c-canvas)] p-3 border border-[color:var(--c-border)] rounded font-mono text-[color:var(--c-text-muted)] text-[0.6875rem]">
              <div>
                <span className="text-[#3fb950]">manifest.json</span> — format id, schema version, title, timestamps
              </div>
              <div>
                <span className="text-[#3fb950]">board.json</span> — PI details, teams, sprints, card types
              </div>
              <div>
                <span className="text-[#3fb950]">cards.json</span> — cards and dependencies
              </div>
              <div>
                <span className="text-[#3fb950]">view.json</span> — viewport only
              </div>
              <div>
                <span className="text-[#3fb950]">assets/</span> — attachments
              </div>
              <div>
                <span className="text-[#3fb950]">content/</span> — long-form detail, one document per card
              </div>
            </div>
            <p className="mt-2 text-[color:var(--c-text-faint)] text-[0.6875rem]">
              You can unzip and inspect a <code className="text-amber-400">.piboard</code> file with any standard archive tool.
            </p>
          </Section>
        </div>

        <div className="px-6 py-3 border-[color:var(--c-border)] border-t text-center shrink-0">
          <button
            onClick={onClose}
            className="bg-amber-400 hover:bg-amber-300 px-6 py-1.5 rounded font-semibold text-[color:var(--c-on-accent)] text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
