import { useEffect, useMemo, useRef, useState } from 'react';
import { TOOL_ICONS } from './iconRegistry';

export default function Hotbar({ tools, selectedToolId, onSelect, onRotate, disabledToolIds = [], paused = false, visible = true }) {
  const [openGroupId, setOpenGroupId] = useState(null);
  const rootRef = useRef(null);
  const childRefs = useRef([]);
  const selectedParentId = useMemo(() => {
    const parent = tools.find((tool) => tool.children?.some((child) => child.id === selectedToolId));
    return parent?.id || selectedToolId;
  }, [tools, selectedToolId]);

  const openGroup = (group) => {
    if (!group.children || paused) return;
    setOpenGroupId((current) => current === group.id ? null : group.id);
  };

  const selectLeaf = (tool) => {
    if (disabledToolIds.includes(tool.id) || paused) return;
    onSelect(tool.id);
    setOpenGroupId(null);
  };

  useEffect(() => {
    if (!openGroupId) return;
    const group = tools.find((tool) => tool.id === openGroupId);
    const currentIndex = group?.children?.findIndex((child) => child.id === selectedToolId) ?? -1;
    requestAnimationFrame(() => childRefs.current[Math.max(0, currentIndex)]?.focus());
  }, [openGroupId, selectedToolId, tools]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (openGroupId && !rootRef.current?.contains(event.target)) setOpenGroupId(null);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [openGroupId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (paused) return;
      const key = event.key;
      const activeGroup = tools.find((tool) => tool.id === openGroupId);
      if (activeGroup?.children) {
        const children = activeGroup.children;
        const focused = childRefs.current.indexOf(document.activeElement);
        if (/^[1-9]$/.test(key)) {
          const child = children[Number(key) - 1];
          if (child) selectLeaf(child);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowRight' || key === 'ArrowDown') {
          const direction = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
          const next = (Math.max(0, focused) + direction + children.length) % children.length;
          childRefs.current[next]?.focus();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (key === 'Enter' && focused >= 0) {
          selectLeaf(children[focused]);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (key === 'Escape') {
          setOpenGroupId(null);
          rootRef.current?.querySelector(`[data-tool-id="${activeGroup.id}"]`)?.focus();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      const index = Number(key) - 1;
      if (index >= 0 && index < tools.length) {
        const tool = tools[index];
        if (tool.children) openGroup(tool);
        else selectLeaf(tool);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (key.toLowerCase() === 'r') {
        onRotate();
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [openGroupId, onRotate, paused, selectedToolId, tools]);

  return (
    <div ref={rootRef} className={`${visible ? '' : 'hidden'} pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-2 sm:bottom-3 sm:px-4`}>
      <div className="w-fit max-w-[calc(100vw-1rem)] rounded-2xl border border-white/10 bg-[#101a2b]/90 p-2 shadow-2xl backdrop-blur-xl sm:p-2.5">

        <div className="flex items-center justify-between px-1 pb-1.5 sm:px-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#aebbd0]">Build tools</span>
          <span className="hidden text-[10px] text-[#aebbd0] sm:inline">R rotate · Q/E bridge height</span>
        </div>

        <div className="relative flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-0.5 scrollbar-none sm:justify-center sm:overflow-visible">
          {openGroupId && (() => {
            const group = tools.find((tool) => tool.id === openGroupId);
            if (!group) return null;
            return <div className="absolute bottom-[calc(100%+0.5rem)] left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-2xl border border-white/10 bg-[#101a2b]/95 p-2 shadow-2xl backdrop-blur-xl" role="menu" aria-label={`${group.label} tools`}>
              {group.children.map((child, index) => {
                const disabled = disabledToolIds.includes(child.id);
                return <button key={child.id} ref={(node) => { childRefs.current[index] = node; }} type="button" role="menuitem" data-tool-id={child.id} disabled={disabled} onClick={() => selectLeaf(child)} aria-label={disabled ? `${child.name}, unavailable until an engine exists` : child.name} aria-pressed={selectedToolId === child.id} title={disabled ? `${child.name} (needs an engine in the world)` : child.name} className={`relative flex h-16 w-16 flex-none flex-col items-center justify-center rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63c9dc] ${disabled ? 'border-transparent bg-[#18263b] opacity-40' : selectedToolId === child.id ? 'border-[#e5a94f] bg-[#244b67]' : 'border-white/5 bg-[#18263b] hover:border-[#63c9dc]/60'}`}>
                  <img src={TOOL_ICONS[child.iconKey || child.id]} alt="" aria-hidden="true" className="mb-1 h-6 w-6 object-contain" />
                  <span className="text-[10px] font-semibold text-[#f7f0df]">{child.label}</span>
                  <span className="absolute right-1 top-1 text-[9px] text-[#aebbd0]">{index + 1}</span>
                </button>;
              })}
            </div>;
          })()}
          {tools.map((tool, index) => {
            const disabled = !tool.children && disabledToolIds.includes(tool.id);
            const hasChildren = Array.isArray(tool.children);
            const icon = TOOL_ICONS[tool.iconKey || tool.id];
            return <button key={tool.id} type="button" data-tool-id={tool.id} onClick={() => hasChildren ? openGroup(tool) : selectLeaf(tool)} disabled={disabled} aria-label={tool.name} aria-haspopup={hasChildren ? 'menu' : undefined} aria-expanded={hasChildren ? openGroupId === tool.id : undefined} aria-describedby={hasChildren && selectedToolId !== tool.id ? `active-child-${tool.id}` : undefined} aria-pressed={selectedParentId === tool.id} className={`relative flex h-[4.35rem] w-[4.35rem] flex-none snap-start flex-col items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63c9dc] ${disabled ? 'border-transparent bg-[#18263b] opacity-40 cursor-not-allowed' : selectedParentId === tool.id ? 'border-[#e5a94f] bg-[#244b67] shadow-[0_0_0_2px_rgba(229,169,79,0.18)]' : 'border-white/5 bg-[#18263b] hover:border-[#63c9dc]/60 hover:bg-[#22344b]'}`}>
              <img src={icon} alt="" aria-hidden="true" draggable={false} className="mb-1 h-7 w-7 object-contain" />
              <span className="text-[11px] font-semibold leading-none text-[#f7f0df]">{tool.label}</span>
              <span className="absolute right-1 top-1 rounded bg-[#101a2b] px-1 text-[10px] font-mono text-[#aebbd0]">{index + 1}</span>
              {hasChildren && <span id={`active-child-${tool.id}`} className="sr-only">Active tool: {tool.children.find((child) => child.id === selectedToolId)?.label || 'none'}</span>}
            </button>;
          })}
        </div>
        <div className="mt-1.5 hidden text-center text-[10px] text-[#aebbd0] sm:block">Press <kbd className="rounded bg-gray-900 px-1">1-6</kbd> to select · child keys when submenu open · <kbd className="ml-1 rounded bg-gray-900 px-1">R</kbd> rotate · <kbd className="ml-1 rounded bg-gray-900 px-1">Q/E</kbd> bridge height</div>
      </div>
    </div>
  );
}
