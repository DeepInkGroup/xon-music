import { useT } from '../i18n';
export function Tuner({ cents }: { cents: number | null }) {
  const t = useT();
  const state = cents === null ? null : Math.abs(cents) <= 5 ? 'inTune' : cents < 0 ? 'flat' : 'sharp';
  return <div className="tuner">
    <div className="tuner-heading"><span>{t('tuner')}</span><span className={state === 'inTune' ? 'accent' : ''} dir="ltr">{cents === null ? '—' : `${cents > 0 ? '+' : ''}${cents.toFixed(1)}`} <small>{t('cents')}</small></span></div>
    <div className="tuner-scale" role="meter" aria-label={t('tuner')} aria-valuemin={-50} aria-valuemax={50} aria-valuenow={cents ?? 0} aria-valuetext={cents === null ? t('waiting') : `${cents.toFixed(1)} ${t('cents')}`}>
      <div className="tuner-center"/><div className="tuner-ticks">{Array.from({ length: 21 }, (_, i) => <i key={i}/>)}</div>
      {cents !== null && <div className={`tuner-needle ${state === 'inTune' ? 'tuned' : ''}`} style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }}/ >}
    </div>
    <div className="tuner-labels" dir="ltr"><span className={state === 'flat' ? 'selected' : ''}>{t('flat')}</span><span className={state === 'inTune' ? 'accent' : ''}>{t('inTune')}</span><span className={state === 'sharp' ? 'selected' : ''}>{t('sharp')}</span></div>
  </div>;
}
