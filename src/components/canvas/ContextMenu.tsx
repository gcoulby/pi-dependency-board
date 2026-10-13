import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean; // show divider BEFORE this item
  submenu?: ContextMenuItem[]; // opens a flyout on hover; onClick is ignored
  active?: boolean; // marks the current choice in a submenu
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const itemCount = items.length;
  const menuHeight = itemCount * 30 + 16;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - menuHeight),
    zIndex: 1000,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="bg-[#1c2333] border border-[#30363d] rounded-lg shadow-2xl py-1 min-w-[160px] select-none"
    >
      {items.map((item, i) => (
        <div key={i} className="relative group/item">
          {item.separator && <div className="my-1 border-t border-[#30363d]" />}
          <button
            onClick={() => { if (item.submenu) return; item.onClick(); onClose(); }}
            className={[
              'w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-left transition-colors',
              item.danger
                ? 'text-red-400 hover:bg-red-400/10'
                : 'text-[#e6edf3] hover:bg-[#30363d]',
              item.active ? 'font-semibold' : '',
            ].join(' ')}
          >
            {item.icon && <span className="opacity-60 flex-shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.active && <span className="text-amber-400">•</span>}
            {item.submenu && <ChevronRight size={11} className="opacity-60" />}
          </button>
          {item.submenu && (
            <div className="hidden group-hover/item:block absolute left-full top-0 -ml-1 pl-1">
              <div className="bg-[#1c2333] border border-[#30363d] rounded-lg shadow-2xl py-1 min-w-[150px]">
                {item.submenu.map((sub, j) => (
                  <button
                    key={j}
                    onClick={() => { sub.onClick(); onClose(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-left text-[#e6edf3] hover:bg-[#30363d] transition-colors"
                  >
                    {sub.icon && <span className="flex-shrink-0">{sub.icon}</span>}
                    <span className="flex-1">{sub.label}</span>
                    {sub.active && <span className="text-amber-400">•</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
