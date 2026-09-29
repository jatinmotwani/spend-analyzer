'use client';

import { useEffect, useRef } from 'react';

/** Bottom sheet on phones, centred dialog on wider screens. Uses the native <dialog> for focus and Esc. */
export function Sheet({
  open,
  onClose,
  label,
  children,
  initialFocus = 'dialog',
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  initialFocus?: 'dialog' | 'first';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (initialFocus === 'dialog') d.focus();
    } else if (!open && d.open) d.close();
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      tabIndex={-1}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="grabber" aria-hidden="true" />
      {open ? children : null}
    </dialog>
  );
}
