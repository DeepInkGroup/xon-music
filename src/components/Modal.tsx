import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useT } from '../i18n';
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useT();
  useEffect(() => { const node = ref.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}><div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label={t('close')}><X size={18}/></button></div>{children}</dialog>;
}
