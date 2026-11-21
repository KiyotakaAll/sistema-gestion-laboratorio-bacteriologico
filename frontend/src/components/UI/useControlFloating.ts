import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react';
import { useEffect } from 'react';
import './controls.css';

const activePopups: Array<{ close: () => void; reference: HTMLElement | null }> = [];

/** Posición fija sin transform: también escapa del overflow de los modales.
 * El portal permanece dentro del diálogo activo, conservando inert y su foco. */
export function useControlFloating(open: boolean, onOpenChange: (open: boolean) => void, matchWidth = true) {
  const floating = useFloating<HTMLElement>({
    open, onOpenChange, placement: matchWidth ? 'bottom-start' : 'bottom-end', strategy: 'fixed', transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [offset(7), flip({ padding: 12 }), shift({ padding: 12 }), size({
      padding: 12,
      apply({ availableHeight, availableWidth, rects, elements }) {
        Object.assign(elements.floating.style, {
          maxHeight: `${Math.max(0, availableHeight)}px`,
          maxWidth: `${Math.max(0, availableWidth)}px`,
          ...(matchWidth ? { width: `${Math.min(Math.max(rects.reference.width, 220), availableWidth)}px` } : {}),
        });
      },
    })],
  });
  const portalRoot = floating.refs.domReference.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body;
  useEffect(() => {
    if (!open) return;
    const popup = { close: () => onOpenChange(false), reference: floating.refs.domReference.current };
    activePopups.push(popup);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || activePopups.at(-1) !== popup) return;
      event.preventDefault(); event.stopImmediatePropagation();
      popup.close(); popup.reference?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', escape, true);
    return () => {
      const index = activePopups.indexOf(popup); if (index !== -1) activePopups.splice(index, 1);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, onOpenChange, floating.refs.domReference]);
  // Tab continúa al siguiente campo; no se intercepta ni se envía el formulario.
  useEffect(() => {
    if (!open) return;
    const element = floating.refs.domReference.current;
    const closeOnTab = (e: KeyboardEvent) => { if (e.key === 'Tab') onOpenChange(false); };
    element?.addEventListener('keydown', closeOnTab);
    return () => element?.removeEventListener('keydown', closeOnTab);
  }, [open, onOpenChange, floating.refs.domReference]);
  return { ...floating, portalRoot };
}
