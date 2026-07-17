import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { calculateTotals, formatCurrency, formatDateShort, amountToWords } from '../../utils/formatters';
import type { DocumentType } from '../../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, Printer } from 'lucide-react';

const DOC_TITLES: Record<DocumentType, string> = {
  invoice: 'FACTURE',
  quote: 'DEVIS',
  proforma: 'FACTURE PROFORMA',
};

const MAX_LOGO_HEIGHT_PX = 48;
const MAX_LOGO_WIDTH_PX = 180;

// A4 aspect ratio: height / width = 297 / 210
const A4_RATIO = 297 / 210;

// Padding inside each page (px) – must match invoice-doc padding
const DOC_PADDING_H = 32; // 2rem ≈ 32px
const DOC_PADDING_V = 44; // 2.75rem ≈ 44px

// Extra top breathing room on continuation pages (px)
const CONTINUATION_TOP_PAD = 28;

// ─── Shared Invoice Content ──────────────────────────────────────────────────
interface BodyProps {
  doc: ReturnType<typeof useInvoice>['state']['currentDocument'];
  activeProfile: ReturnType<typeof useInvoice>['activeProfile'];
  totals: ReturnType<typeof calculateTotals>;
  logoDim: { width: number; height: number } | null;
}

const InvoiceBody: React.FC<BodyProps> = ({ doc, activeProfile, totals, logoDim }) => {
  const isAutoEntrepreneur = activeProfile?.businessType === 'auto-entrepreneur';
  const currency = doc.settings.currency;
  const bank = doc.senderBankDetails;
  const showBank = bank && (bank.accountNumber || bank.rib || bank.iban);

  return (
    <>
      {/* Header */}
      <div className="invoice-doc-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {doc.logo ? (
            <img
              src={doc.logo}
              alt="Logo"
              style={{
                display: 'block',
                width: logoDim ? logoDim.width : 'auto',
                height: logoDim ? logoDim.height : MAX_LOGO_HEIGHT_PX,
              }}
            />
          ) : (
            <div style={{
              width: 44, height: 44, background: 'var(--accent)', borderRadius: 'var(--r-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-1)',
            }}>
              {(doc.sender.company || doc.sender.name || 'E').charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-1)' }}>
            {doc.sender.company || doc.sender.name || 'Votre entreprise'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="invoice-doc-type">{DOC_TITLES[doc.type]}</div>
          <div className="invoice-doc-number">{doc.invoiceNumber}</div>
        </div>
      </div>

      {/* Meta Info Row */}
      <div className="invoice-meta-row">
        <div>
          <div className="invoice-meta-key">Date d'émission</div>
          <div className="invoice-meta-value">{formatDateShort(doc.date)}</div>
        </div>
        <div>
          <div className="invoice-meta-key">Échéance</div>
          <div className="invoice-meta-value">{formatDateShort(doc.dueDate)}</div>
        </div>
        <div>
          <div className="invoice-meta-key">Référence</div>
          <div className="invoice-meta-value">{doc.invoiceNumber}</div>
        </div>
      </div>

      {/* Parties */}
      <div className="invoice-parties">
        <div>
          <div className="invoice-party-label">Émetteur</div>
          <div className="invoice-party-name">{doc.sender.company || doc.sender.name || '—'}</div>
          {doc.sender.name && doc.sender.company && (
            <div className="invoice-party-detail">{doc.sender.name}</div>
          )}
          {doc.sender.address && <div className="invoice-party-detail">{doc.sender.address}</div>}
          {doc.sender.phone && <div className="invoice-party-detail">Tél: {doc.sender.phone}</div>}
          {doc.sender.email && <div className="invoice-party-detail">{doc.sender.email}</div>}
          {(doc.sender.nif || doc.sender.rc || doc.sender.cae) && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-4)', lineHeight: 1.8 }}>
              {doc.sender.nif && <div>NIF: {doc.sender.nif}</div>}
              {!isAutoEntrepreneur && doc.sender.nis && <div>NIS: {doc.sender.nis}</div>}
              {!isAutoEntrepreneur && doc.sender.rc && <div>RC: {doc.sender.rc}</div>}
              {isAutoEntrepreneur && doc.sender.cae && <div>N° C.A.E: {doc.sender.cae}</div>}
              {!isAutoEntrepreneur && doc.sender.art && <div>Art. Imp.: {doc.sender.art}</div>}
            </div>
          )}
        </div>
        <div>
          <div className="invoice-party-label">Destinataire</div>
          <div className="invoice-party-name">{doc.recipient.name || '—'}</div>
          {doc.recipient.company && <div className="invoice-party-detail">{doc.recipient.company}</div>}
          {doc.recipient.address && <div className="invoice-party-detail">{doc.recipient.address}</div>}
          {doc.recipient.phone && <div className="invoice-party-detail">Tél: {doc.recipient.phone}</div>}
          {doc.recipient.email && <div className="invoice-party-detail">{doc.recipient.email}</div>}
          {(doc.recipient.nif || doc.recipient.rc) && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-4)', lineHeight: 1.8 }}>
              {doc.recipient.nif && <div>NIF: {doc.recipient.nif}</div>}
              {doc.recipient.rc && <div>RC: {doc.recipient.rc}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="invoice-items-table">
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Désignation</th>
            <th>Qté</th>
            <th>Prix Unitaire HT</th>
            <th>Montant HT</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '1.5rem', fontStyle: 'italic' }}>
                Aucun article ajouté
              </td>
            </tr>
          ) : (
            doc.items.map((item) => {
              const amount = item.quantity * item.rate;
              return (
                <tr key={item.id}>
                  <td>{item.description || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{item.quantity.toLocaleString('fr-DZ')}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.rate, currency)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-1)' }}>{formatCurrency(amount, currency)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="invoice-totals">
        <div className="invoice-totals-box">
          <div className="invoice-total-row">
            <span>Montant HT</span>
            <span>{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="invoice-total-row" style={{ color: 'var(--status-overdue-text)' }}>
              <span>
                Remise {doc.settings.discountType === 'percentage' ? `(${doc.settings.discountValue}%)` : ''}
              </span>
              <span>– {formatCurrency(totals.discountAmount, currency)}</span>
            </div>
          )}
          {totals.discountAmount > 0 && (
            <div className="invoice-total-row">
              <span>Base TVA</span>
              <span>{formatCurrency(totals.taxableAmount, currency)}</span>
            </div>
          )}
          {doc.settings.taxRate > 0 && (
            <div className="invoice-total-row">
              <span>TVA ({doc.settings.taxRate}%)</span>
              <span>{formatCurrency(totals.tvaAmount, currency)}</span>
            </div>
          )}
          {totals.stampDuty > 0 && (
            <div className="invoice-total-row">
              <span>Droit de timbre</span>
              <span>{formatCurrency(totals.stampDuty, currency)}</span>
            </div>
          )}
          <div className="invoice-total-row">
            <span>Total TTC</span>
            <span>{formatCurrency(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="invoice-amount-words">
        <div className="invoice-amount-words-label">Arrêté à la somme de</div>
        <div className="invoice-amount-words-text">
          {amountToWords(totals.total, currency)}
        </div>
      </div>

      {/* Bank Details */}
      {showBank && (
        <div className="invoice-bank-details">
          <div className="invoice-bank-title">Règlement par virement bancaire</div>
          <div className="invoice-bank-row">
            {bank.bankName && (
              <div className="invoice-bank-item">
                <div className="invoice-bank-item-key">Banque</div>
                <div className="invoice-bank-item-value">{bank.bankName}</div>
              </div>
            )}
            {bank.accountHolder && (
              <div className="invoice-bank-item">
                <div className="invoice-bank-item-key">Titulaire</div>
                <div className="invoice-bank-item-value">{bank.accountHolder}</div>
              </div>
            )}
            {bank.accountNumber && (
              <div className="invoice-bank-item">
                <div className="invoice-bank-item-key">N° de compte</div>
                <div className="invoice-bank-item-value">{bank.accountNumber}</div>
              </div>
            )}
            {bank.rib && (
              <div className="invoice-bank-item">
                <div className="invoice-bank-item-key">RIB</div>
                <div className="invoice-bank-item-value">{bank.rib}</div>
              </div>
            )}
            {bank.iban && (
              <div className="invoice-bank-item">
                <div className="invoice-bank-item-key">IBAN</div>
                <div className="invoice-bank-item-value">{bank.iban}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {doc.notes && (
        <div className="invoice-notes">
          <div className="invoice-notes-label">Conditions & Notes</div>
          <div className="invoice-notes-text">{doc.notes}</div>
        </div>
      )}

      {/* Legal Footer */}
      <div className="invoice-legal-footer">
        <div>
          {[
            doc.sender.company || doc.sender.name,
            doc.sender.nif && `NIF: ${doc.sender.nif}`,
            !isAutoEntrepreneur && doc.sender.nis && `NIS: ${doc.sender.nis}`,
            !isAutoEntrepreneur && doc.sender.rc && `RC: ${doc.sender.rc}`,
            isAutoEntrepreneur && doc.sender.cae && `N° C.A.E: ${doc.sender.cae}`,
            !isAutoEntrepreneur && doc.sender.art && `Art. Imp.: ${doc.sender.art}`
          ].filter(Boolean).join(' · ')}
        </div>
        {isAutoEntrepreneur && (
          <div style={{ marginTop: '0.3rem', fontStyle: 'italic' }}>
            Non assujetti à la TVA — Art. 282 ter du Code Général des Impôts
          </div>
        )}
      </div>
    </>
  );
};

// ─── Main PreviewPane ─────────────────────────────────────────────────────────
const PreviewPane: React.FC = () => {
  const { state, activeProfile } = useInvoice();
  const doc = state.currentDocument;

  // Hidden div used only for measuring content height & row positions
  const hiddenRef = useRef<HTMLDivElement>(null);
  // One ref per visible page container (for PDF capture)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [logoDim, setLogoDim] = useState<{ width: number; height: number } | null>(null);
  // pageStarts[i] = Y (in px, relative to hidden content top) where page i begins
  const [pageStarts, setPageStarts] = useState<number[]>([0]);
  const [pageHeightPx, setPageHeightPx] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const totals = calculateTotals(
    doc.items,
    doc.settings.taxRate ?? 0,
    doc.settings.discountType,
    doc.settings.discountValue,
    doc.settings.applyStampDuty ?? false,
    doc.settings.stampDutyAmount ?? 0
  );

  // ── Logo ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!doc.logo) { setLogoDim(null); return; }
    const img = new Image();
    img.onload = () => {
      let finalW = img.naturalWidth;
      let finalH = img.naturalHeight;
      const ratio = finalW / finalH;
      if (finalH > MAX_LOGO_HEIGHT_PX) { finalH = MAX_LOGO_HEIGHT_PX; finalW = MAX_LOGO_HEIGHT_PX * ratio; }
      if (finalW > MAX_LOGO_WIDTH_PX) { finalW = MAX_LOGO_WIDTH_PX; finalH = MAX_LOGO_WIDTH_PX / ratio; }
      setLogoDim({ width: Math.round(finalW), height: Math.round(finalH) });
    };
    img.src = doc.logo;
  }, [doc.logo]);

  // ── Page Break Computation ────────────────────────────────────────────────
  const computePages = useCallback(() => {
    const container = hiddenRef.current;
    if (!container || container.offsetWidth === 0) return;

    const containerTop = container.getBoundingClientRect().top;
    // Page height = container width * A4 ratio (minus vertical padding used in the hidden div)
    const pageH = Math.floor(container.offsetWidth * A4_RATIO);
    setPageHeightPx(pageH);

    // Content area per page (page height minus the padding we apply to each page)
    // Page 1: loses DOC_PADDING_H at top and bottom → effectively (pageH - 2*DOC_PADDING_H) of content
    // Continuation pages: also lose CONTINUATION_TOP_PAD at top for breathing room
    const page1ContentH = pageH - 2 * DOC_PADDING_H;
    const pageNContentH = pageH - DOC_PADDING_H - CONTINUATION_TOP_PAD;

    // Collect elements that should NOT be split: each table row + key blocks
    const breakableSelectors = [
      'tbody tr',
      '.invoice-totals',
      '.invoice-amount-words',
      '.invoice-bank-details',
      '.invoice-notes',
      '.invoice-legal-footer',
    ];

    const elements: HTMLElement[] = [];
    for (const sel of breakableSelectors) {
      elements.push(...Array.from(container.querySelectorAll<HTMLElement>(sel)));
    }

    const starts: number[] = [0];
    let currentPageIndex = 0;
    let currentPageContentBottom =
      containerTop + DOC_PADDING_H + page1ContentH; // absolute viewport Y

    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const elBottom = rect.bottom;

      if (elBottom > currentPageContentBottom + 4) {
        // Element would overflow this page → start a new page at el.top (relative to container)
        const elTopRelative = rect.top - containerTop;
        const newStart = Math.max(0, elTopRelative - CONTINUATION_TOP_PAD);
        starts.push(newStart);
        currentPageIndex++;
        // New page content bottom in absolute viewport coordinates:
        currentPageContentBottom = rect.top - CONTINUATION_TOP_PAD + pageNContentH;
      }
    }

    setPageStarts(starts);
  }, []);

  useEffect(() => {
    const t = setTimeout(computePages, 200);
    return () => clearTimeout(t);
  }, [doc.items, doc.notes, doc.sender, doc.recipient, doc.logo, doc.settings, computePages]);

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      const validRefs = pageRefs.current.filter(Boolean) as HTMLDivElement[];

      for (let i = 0; i < validRefs.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(validRefs[i], {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      }

      pdf.save(`${doc.invoiceNumber}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  const numPages = pageStarts.length;
  const bodyProps: BodyProps = { doc, activeProfile, totals, logoDim };

  return (
    <div className="preview-pane">
      {/* ── Hidden measurement div ──────────────────────────────────────── */}
      {/* Fixed position, off-screen but same width as invoice-doc max-width */}
      <div
        ref={hiddenRef}
        style={{
          position: 'fixed',
          left: -2000,
          top: 0,
          width: 760,
          padding: `${DOC_PADDING_H}px ${DOC_PADDING_V}px`,
          background: 'white',
          fontSize: '0.82rem',
          lineHeight: 1.5,
          visibility: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <InvoiceBody {...bodyProps} />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="preview-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-4)',
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          Aperçu du document
          {numPages > 1 && (
            <span style={{
              marginLeft: 8, color: 'var(--text-3)',
              fontWeight: 500, textTransform: 'none', letterSpacing: 0,
            }}>
              — {numPages} pages
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => window.print()} style={{ fontSize: '0.8rem' }}>
            <Printer size={14} /> Imprimer
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDownloadPDF}
            disabled={isExporting}
            style={{ fontSize: '0.8rem', opacity: isExporting ? 0.7 : 1 }}
          >
            <Download size={14} />{' '}
            {isExporting ? 'Génération…' : 'Télécharger PDF'}
          </button>
        </div>
      </div>

      {/* ── Visible A4 Page Cards ────────────────────────────────────────── */}
      {pageStarts.map((startY, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === numPages - 1;

        // Vertical offset of the inner content div:
        // - Page 1: no offset needed (startY = 0)
        // - Other pages: shift content up by startY, then add continuation padding
        const contentTop = isFirst
          ? 0
          : -startY + CONTINUATION_TOP_PAD;

        return (
          <div
            key={pageIndex}
            ref={(el) => { pageRefs.current[pageIndex] = el; }}
            style={{
              width: '100%',
              maxWidth: 760,
              // Fixed A4 height for all pages except last (which can be shorter)
              height: (!isLast && pageHeightPx > 0) ? pageHeightPx : undefined,
              minHeight: isLast && pageHeightPx > 0 ? undefined : undefined,
              overflow: 'hidden',
              position: 'relative',
              background: '#ffffff',
              boxShadow: 'var(--shadow-preview)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {/* Page number badge */}
            {numPages > 1 && (
              <div style={{
                position: 'absolute',
                top: 10,
                right: 14,
                fontSize: '0.62rem',
                fontWeight: 700,
                color: 'var(--text-4)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                zIndex: 10,
                userSelect: 'none',
              }}>
                {pageIndex + 1} / {numPages}
              </div>
            )}

            {/* Full invoice body offset to show only this page's slice */}
            <div
              style={{
                position: isFirst ? 'relative' : 'absolute',
                top: isFirst ? undefined : contentTop,
                left: 0,
                right: 0,
                padding: `${DOC_PADDING_H}px ${DOC_PADDING_V}px`,
                background: 'white',
                fontSize: '0.82rem',
                lineHeight: 1.5,
              }}
            >
              <InvoiceBody {...bodyProps} />
            </div>
          </div>
        );
      })}

      {/* Bottom spacer */}
      <div style={{ height: '1rem', flexShrink: 0 }} />
    </div>
  );
};

export default PreviewPane;
