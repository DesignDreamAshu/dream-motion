import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from './ui/input';
import { Tooltip } from './ui/tooltip';

export type CommandItem = {
  id: string;
  label: string;
  group: string;
  keywords: string[];
  shortcut?: string;
  enabled: boolean;
  reason?: string;
  onSelect?: () => void;
  submenu?: string;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menus: Record<string, CommandItem[]>;
  initialMenu?: string;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  menus,
  initialMenu = 'root'
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuId, setMenuId] = useState(initialMenu);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setMenuId(initialMenu);
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, initialMenu]);

  const items = menus[menuId] ?? [];
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const needle = query.toLowerCase();
    return items.filter((item) =>
      [item.label, item.group, ...item.keywords].some((word) =>
        word.toLowerCase().includes(needle)
      )
    );
  }, [items, query]);

  const flat = filtered;
  const grouped = useMemo(() => {
    const output = new Map<string, CommandItem[]>();
    flat.forEach((item) => {
      const groupItems = output.get(item.group) ?? [];
      groupItems.push(item);
      output.set(item.group, groupItems);
    });
    return output;
  }, [flat]);

  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(0);
  }, [activeIndex, flat.length]);

  const handleSelect = (item: CommandItem) => {
    if (!item.enabled) return;
    if (item.submenu) {
      setMenuId(item.submenu);
      setQuery('');
      setActiveIndex(0);
      return;
    }
    item.onSelect?.();
    onOpenChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(1, flat.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flat.length) % Math.max(1, flat.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = flat[activeIndex];
      if (item) handleSelect(item);
    }
  };

  if (!open) return null;

  return (
    <div className="CommandPaletteOverlay" onMouseDown={() => onOpenChange(false)}>
      <div
        className="CommandPalette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="CommandPaletteHeader">
          <Input
            ref={inputRef}
            className="CommandPaletteInput"
            placeholder="Actions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="CommandPaletteHint">Ctrl / Cmd + K</div>
        </div>
        {menuId !== 'root' && (
          <button
            className="CommandPaletteBack"
            onClick={() => {
              setMenuId('root');
              setQuery('');
              setActiveIndex(0);
            }}
          >
            {'<- Back'}
          </button>
        )}
        <div className="CommandPaletteList">
          {[...grouped.entries()].map(([group, groupItems]) => (
            <div key={group} className="CommandPaletteGroup">
              <div className="CommandPaletteGroupLabel">{group}</div>
              <div className="CommandPaletteGroupItems">
                {groupItems.map((item, index) => {
                  const flatIndex = flat.findIndex((entry) => entry.id === item.id);
                  const row = (
                    <div
                      key={item.id}
                      className={`CommandPaletteItem ${flatIndex === activeIndex ? 'is-selected' : ''} ${item.enabled ? '' : 'is-disabled'}`}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      onClick={() => handleSelect(item)}
                    >
                      <span className="CommandPaletteItemLabel">{item.label}</span>
                      <span className="CommandPaletteItemMeta">
                        {item.submenu ? '>' : item.shortcut ?? ''}
                      </span>
                    </div>
                  );
                  if (!item.enabled && item.reason) {
                    return (
                      <Tooltip key={item.id} title={item.reason} tooltipFor="play">
                        {row}
                      </Tooltip>
                    );
                  }
                  return row;
                })}
              </div>
            </div>
          ))}
          {!flat.length && <div className="CommandPaletteEmpty">No results</div>}
        </div>
      </div>
    </div>
  );
};

