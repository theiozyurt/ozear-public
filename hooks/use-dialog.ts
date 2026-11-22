"use client";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
// One shared focus/escape behavior for all dialogs, with up-to-date close guards.
export function useDialog(open: boolean | string, close: () => void, element: RefObject<HTMLElement | null>) {
  const onClose = useRef(close);
  useLayoutEffect(() => { onClose.current = close; }, [close]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(element.current?.querySelectorAll<HTMLElement>('button,input,select,textarea,summary,a[href],[tabindex="0"]') ?? []).filter(node => !node.matches(':disabled') && (!node.closest('details:not([open])') || node.tagName === 'SUMMARY') && node.getAttribute('aria-hidden') !== 'true');
    focusable()[0]?.focus();
    function key(event: KeyboardEvent) {
      if (!element.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose.current(); }
      if (event.key !== "Tab") return;
      const nodes = focusable(), first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", key, true);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key, true); if(previous?.isConnected) previous.focus(); };
  }, [open, element]);
  return element;
}
export function hasUnsavedFields(element: HTMLElement | null) {
  if (!element) return false;
  return Array.from(element.querySelectorAll<HTMLElement>('form input,form textarea,form select')).some(field => {
    if (field.matches(':disabled')) return false;
    if (field instanceof HTMLSelectElement) return field.value !== (Array.from(field.options).find(option => option.defaultSelected)?.value ?? field.options[0]?.value);
    if (field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type)) return field.checked !== field.defaultChecked;
    return (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && field.value !== field.defaultValue;
  });
}
