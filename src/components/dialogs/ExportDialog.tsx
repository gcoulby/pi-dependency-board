import { useEffect, useMemo, useState } from 'react';
import { X, Copy, Check, Download } from 'lucide-react';
import { getBoardConfig } from '../../store/boardStore';
import { useCardStore } from '../../store/cardStore';
import { useFileStore } from '../../store/fileStore';
import { downloadBlob } from '../../file/fileHandle';
import { boardToMermaid } from '../../board/mermaid';
import { boardToDrawio } from '../../board/drawio';

type Format = 'drawio' | 'mermaid';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const title = useFileStore((s) => s.manifest?.title);
  const [format, setFormat] = useState<Format>('drawio');
  const texts = useMemo(() => {
    const { cards, dependencies } = useCardStore.getState();
    const config = getBoardConfig();
    return {
      drawio: boardToDrawio(config, cards, dependencies),
      mermaid: boardToMermaid(config, cards, dependencies, title),
    };
  }, [title]);
  const text = texts[format];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text is selectable below */
    }
  };

  const base = (title ?? 'board').replace(/[^a-z0-9]/gi, '_');
  const filename = format === 'drawio' ? `${base}.drawio` : `${base}.mmd`;

  return (
    <div className="fixed inset-0 bg-[#0d1117]/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl w-full max-w-[680px] max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] shrink-0">
          <h3 className="text-[#e6edf3] font-semibold">Export board</h3>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#e6edf3]" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b border-[#30363d] shrink-0">
          {([['drawio', 'draw.io (matches the board)'], ['mermaid', 'Mermaid (flowchart)']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFormat(id)}
              className={[
                'px-3 py-2 text-[12px] -mb-px border-b-2 transition-colors',
                format === id ? 'border-amber-400 text-amber-400' : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-6 pt-4 text-[12px] text-[#8b949e] leading-relaxed shrink-0">
          {format === 'drawio' ? (
            <>
              Download the file and open it in draw.io (<span className="text-[#e6edf3]">File → Open from → Device</span>), or copy the text and
              paste it onto a blank draw.io canvas. It uses the same lanes, sprint columns, card positions, sizes and colours as the board,
              and every card and arrow stays editable.
            </>
          ) : (
            <>
              A simpler flowchart for tools that read Mermaid. It cannot reproduce the grid, so use draw.io for a faithful copy. In draw.io:{' '}
              <span className="text-[#e6edf3]">Arrange → Insert → Advanced → Mermaid</span>.
            </>
          )}
        </div>

        <textarea
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          spellCheck={false}
          className="m-6 mb-4 flex-1 min-h-[240px] bg-[#0d1117] border border-[#30363d] rounded p-3 text-[11px] font-mono text-[#c9d1d9] resize-none focus:outline-none focus:border-amber-400/60"
        />

        <div className="px-6 py-3 border-t border-[#30363d] flex justify-end gap-3 shrink-0">
          <button
            onClick={() => downloadBlob(new Blob([text], { type: format === 'drawio' ? 'application/xml' : 'text/plain' }), filename)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3]"
          >
            <Download size={13} /> Download {format === 'drawio' ? '.drawio' : '.mmd'}
          </button>
          <button
            onClick={() => void copy()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-amber-400 text-[#0d1117] font-semibold rounded hover:bg-amber-300"
          >
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
      </div>
    </div>
  );
}
