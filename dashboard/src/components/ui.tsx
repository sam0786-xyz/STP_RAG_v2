import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export const EASE = [0.23, 1, 0.32, 1] as const;

export function PageHead({ title, children, hint }: { title: string; children?: ReactNode; hint?: ReactNode }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
      {hint && <div className="hint"><span className="hint-label">Try this</span><span>{hint}</span></div>}
    </header>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, id }: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.span layoutId={`seg-${id}`} className="seg-bg" transition={{ duration: 0.18, ease: EASE }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button className="switch" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="switch-track">
        <motion.span className="switch-knob" initial={false} animate={{ x: checked ? 16 : 0 }}
          transition={{ duration: 0.16, ease: EASE }} />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Slider({ label, value, min, max, step, onChange, format, help }: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  help?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{format ? format(value) : value}</output>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      {help && <span className="slider-help">{help}</span>}
    </div>
  );
}

export function Readout({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="readout">
      <span className="readout-value">{value}</span>
      <span className="readout-label">{label}</span>
    </div>
  );
}

/** One expandable row; the content height animates so the reader sees what opened. */
export function Disclosure({ title, meta, children, defaultOpen = false }: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="disclosure">
      <button className="disclosure-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <motion.svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" initial={false}
          animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.16, ease: EASE }}>
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
        <span className="disclosure-title">{title}</span>
        {meta && <span className="disclosure-meta">{meta}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} className="disclosure-body" initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}>
            <div className="disclosure-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Width of a container, for responsive SVG. */
export function useWidth<T extends HTMLElement>(fallback = 900): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function Drawer({ open, onClose, title, children, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.16 }} />
          <motion.aside className={`drawer${wide ? " drawer-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}
            initial={{ x: 48, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 32, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}>
            <button className="btn drawer-close" onClick={onClose} autoFocus>Close</button>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export const fmt = (x: number | null | undefined, d = 3) => (x == null || Number.isNaN(x) ? "–" : x.toFixed(d));
export const pct = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
