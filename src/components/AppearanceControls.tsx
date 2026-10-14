import { Moon, Sun } from 'lucide-react';
import { FONT_SCALES, useUiStore } from '../store/uiStore';

const btn =
  'flex items-center justify-center min-w-6 h-6 px-1.5 rounded text-[0.6875rem] font-mono text-[color:var(--c-text-muted)] hover:text-amber-400 hover:bg-[var(--c-raised)] disabled:opacity-30 disabled:hover:text-[color:var(--c-text-muted)] disabled:hover:bg-transparent transition-colors';

/** Theme toggle and card / header text size. Shown in the toolbar and on the launch screen. */
export function AppearanceControls() {
  const theme = useUiStore((s) => s.theme);
  const fontScale = useUiStore((s) => s.fontScale);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const stepFont = useUiStore((s) => s.stepFont);

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => stepFont(-1)} disabled={fontScale <= FONT_SCALES[0]} title="Smaller card and header text" aria-label="Smaller text" className={btn}>
        A−
      </button>
      <span className="text-[0.625rem] font-mono text-[color:var(--c-text-faint)] w-8 text-center" title="Card and header text size">
        {Math.round(fontScale * 100)}%
      </span>
      <button onClick={() => stepFont(1)} disabled={fontScale >= FONT_SCALES[FONT_SCALES.length - 1]} title="Larger card and header text" aria-label="Larger text" className={btn}>
        A+
      </button>
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className={btn}
      >
        {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
      </button>
    </div>
  );
}
