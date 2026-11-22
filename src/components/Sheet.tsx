// Wysuwany od dołu panel (jak w natywnych aplikacjach iOS).
import { useEffect, useState, type ReactNode } from 'react';

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  // Trzymamy panel w DOM chwilę po zamknięciu, aby zagrała animacja wyjścia.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;
  return (
    <div className={`sheet-root ${open ? 'is-open' : 'is-closing'}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        {title && <h2 className="sheet-title">{title}</h2>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
