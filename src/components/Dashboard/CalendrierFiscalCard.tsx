import React from 'react';
import { Calendar } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FiscalDeadline {
  id: string;
  label: string;
  description: string;
  date: Date;
  category: 'tva' | 'ibs' | 'irg' | 'casnos' | 'cnas' | 'other';
}

const getAlgerianFiscalDeadlines = (): FiscalDeadline[] => {
  const now = new Date();
  const year = now.getFullYear();
  const deadlines: FiscalDeadline[] = [];

  // G50 — TVA mensuelle (20 de chaque mois)
  for (let month = 0; month < 12; month++) {
    const d = new Date(year, month + 1, 20); // 20th of following month
    if (d >= now || differenceInDays(now, d) <= 0) {
      deadlines.push({
        id: `g50-${year}-${month}`,
        label: `G50 — ${format(new Date(year, month), 'MMMM yyyy', { locale: fr })}`,
        description: 'Déclaration TVA mensuelle (G50) à déposer à la DGI',
        date: d,
        category: 'tva',
      });
    }
  }

  // Bilan IBS annuel — 30 avril
  deadlines.push({
    id: `ibs-${year}`,
    label: `Déclaration IBS (G4) — Exercice ${year - 1}`,
    description: 'Liasse fiscale annuelle et règlement de l\'IBS',
    date: new Date(year, 3, 30),
    category: 'ibs',
  });
  deadlines.push({
    id: `irg-${year}`,
    label: `Déclaration IRG Annuelle — ${year - 1}`,
    description: 'Déclaration annuelle de revenus (formulaire IRG)',
    date: new Date(year, 3, 30),
    category: 'irg',
  });

  // CASNOS trimestrielle (15 jan, 15 avr, 15 juil, 15 oct)
  const casnos = [0, 3, 6, 9];
  casnos.forEach(m => {
    deadlines.push({
      id: `casnos-${year}-${m}`,
      label: `CASNOS — T${Math.floor(m / 3) + 1} ${year}`,
      description: 'Cotisation sociale trimestrielle des non-salariés (CASNOS)',
      date: new Date(year, m, 15),
      category: 'casnos',
    });
  });

  // CNAS mensuelle — 15 de chaque mois (si employés)
  // (Only show next 3 months to avoid clutter)
  for (let i = 0; i < 3; i++) {
    const d = new Date(year, now.getMonth() + i, 15);
    deadlines.push({
      id: `cnas-${year}-${now.getMonth() + i}`,
      label: `CNAS — ${format(new Date(year, now.getMonth() + i), 'MMMM yyyy', { locale: fr })}`,
      description: 'Bordereau mensuel de cotisations CNAS (si vous avez des employés)',
      date: d,
      category: 'cnas',
    });
  }

  return deadlines
    .filter(d => d.date >= new Date(now.getFullYear(), now.getMonth() - 1, 1))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 12);
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  tva: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  ibs: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  irg: { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
  casnos: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  cnas: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  other: { bg: 'var(--surface)', text: 'var(--text-2)', border: 'var(--border)' },
};

const categoryLabels: Record<string, string> = {
  tva: 'TVA / G50',
  ibs: 'IBS',
  irg: 'IRG',
  casnos: 'CASNOS',
  cnas: 'CNAS',
  other: 'Autre',
};

export const CalendrierFiscalCard: React.FC = () => {
  const deadlines = getAlgerianFiscalDeadlines();
  const now = new Date();

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Calendar size={18} color="var(--text-2)" />
        <h2 className="card-title" style={{ margin: 0 }}>Calendrier Fiscal Algérien {now.getFullYear()}</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {deadlines.map(dl => {
          const daysLeft = differenceInDays(dl.date, now);
          const isPast = daysLeft < 0;
          const isUrgent = daysLeft >= 0 && daysLeft <= 7;
          const isSoon = daysLeft > 7 && daysLeft <= 15;
          const colors = categoryColors[dl.category];

          let urgencyColor = '#16A34A';
          let urgencyBg = '#F0FDF4';
          if (isUrgent) { urgencyColor = '#BE123C'; urgencyBg = '#FFF1F2'; }
          else if (isSoon) { urgencyColor = '#B45309'; urgencyBg = '#FFFBEB'; }
          else if (isPast) { urgencyColor = 'var(--text-4)'; urgencyBg = 'var(--surface)'; }

          return (
            <div key={dl.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: 'var(--r-md)',
              background: isPast ? 'var(--surface)' : (isUrgent ? '#FFF5F5' : 'var(--bg)'),
              border: `1px solid ${isPast ? 'var(--border)' : (isUrgent ? '#FECDD3' : 'var(--border)')}`,
              opacity: isPast ? 0.55 : 1,
            }}>
              {/* Category badge */}
              <span style={{
                flexShrink: 0, fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem',
                borderRadius: 'var(--r-full)', background: colors.bg, color: colors.text,
                border: `1px solid ${colors.border}`, whiteSpace: 'nowrap', marginTop: '0.1rem',
              }}>
                {categoryLabels[dl.category]}
              </span>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isPast ? 'var(--text-3)' : 'var(--text-1)' }}>
                  {dl.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: '0.1rem' }}>
                  {dl.description}
                </div>
              </div>

              {/* Date + countdown */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)' }}>
                  {format(dl.date, 'dd/MM/yyyy')}
                </div>
                <div style={{
                  fontSize: '0.68rem', fontWeight: 700, marginTop: '0.15rem',
                  color: urgencyColor, background: urgencyBg,
                  padding: '0.1rem 0.4rem', borderRadius: 'var(--r-full)', display: 'inline-block',
                }}>
                  {isPast ? 'Passé' : daysLeft === 0 ? '⚠️ Aujourd\'hui!' : `J-${daysLeft}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-4)', lineHeight: 1.5 }}>
        * CNAS (15/mois) ne s'applique que si vous avez des employés déclarés. · CASNOS (15 jan/avr/juil/oct) pour les gérants et travailleurs indépendants.
      </div>
    </div>
  );
};
