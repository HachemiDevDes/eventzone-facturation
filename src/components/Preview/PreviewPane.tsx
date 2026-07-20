import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInvoice } from '../../context/InvoiceContext';
import { calculateTotals, formatCurrency, formatDateShort, amountToWords } from '../../utils/formatters';
import type { DocumentType } from '../../types';
import { Download } from 'lucide-react';
import { DraggableStamp } from './DraggableStamp';

const DOC_TITLES: Record<DocumentType, string> = {
  invoice: 'FACTURE',
  quote: 'DEVIS',
  proforma: 'FACTURE PROFORMA',
};

const MAX_LOGO_HEIGHT_PX = 48;
const MAX_LOGO_WIDTH_PX = 180;

// A4: 297mm × 210mm  →  height/width ratio
const A4_RATIO = 297 / 210;

// The hidden measurement div is fixed at exactly this CSS-pixel width,
// matching the visible page cards' max-width.
const HIDDEN_WIDTH = 760;

// Breathing-room margins (CSS px).
// PAGE_MARGIN  = whitespace above the first row on continuation pages (preview + PDF).
// BOTTOM_MARGIN = whitespace below the last row on every page (preview + PDF).
const PAGE_MARGIN   = 32; // px
const BOTTOM_MARGIN = 32; // px

// ─── Invoice Body ─────────────────────────────────────────────────────────────
// Stateless component that renders all invoice content.
// Rendered twice per visible page (once in hidden div for measurement, once for display),
// but that is fine — it is purely static JSX.

interface BodyProps {
  doc: ReturnType<typeof useInvoice>['state']['currentDocument'];
  activeProfile: ReturnType<typeof useInvoice>['activeProfile'];
  totals: ReturnType<typeof calculateTotals>;
  logoDim: { width: number; height: number } | null;
  onStampChange?: (placement: any) => void;
  isExporting?: boolean;
}

const InvoiceBody: React.FC<BodyProps> = ({ doc, activeProfile, totals, logoDim, onStampChange, isExporting = false }) => {
  const isAutoEntrepreneur = activeProfile?.businessType === 'auto-entrepreneur';
  const currency = doc.settings.currency;
  const bank = doc.senderBankDetails;
  const showBank = bank && (bank.accountNumber || bank.rib || bank.iban);

  return (
    <>
      {/* Header */}
      <div className="invoice-doc-header">
        <div>
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

      {/* Interactive Stamp / Signature */}
      {doc.settings.showStamp && (doc.stamp || activeProfile?.stamp) && (
        <DraggableStamp
          stampUrl={(doc.stamp || activeProfile?.stamp) as string}
          placement={doc.settings.stampPlacement || { x: 550, y: 900, width: 150, height: 60, rotation: 0 }}
          onChange={(placement) => {
            if (onStampChange) onStampChange(placement);
          }}
          readOnly={isExporting} // In the future, might also pass a true readOnly if viewing just a preview
        />
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

// ─── PreviewPane ──────────────────────────────────────────────────────────────
const PreviewPane: React.FC = () => {
  const { state, dispatch, activeProfile } = useInvoice();
  const doc = state.currentDocument;

  // Off-screen div used ONLY for measuring element positions.
  // Must be position:fixed so getBoundingClientRect() gives stable viewport coords.
  const hiddenRef = useRef<HTMLDivElement>(null);

  const [logoDim, setLogoDim] = useState<{ width: number; height: number } | null>(null);

  // pageStarts[i] = Y coordinate (px, relative to hiddenRef top) where page i begins.
  // pageStarts[0] is always 0.
  const [pageStarts, setPageStarts] = useState<number[]>([0]);

  // A4 page height in CSS pixels, derived from the hidden div's actual rendered width.
  const INITIAL_A4_HEIGHT = Math.round(HIDDEN_WIDTH * A4_RATIO);
  const [pageHeightPx, setPageHeightPx] = useState(INITIAL_A4_HEIGHT);

  const [isExporting] = useState(false);

  const totals = calculateTotals(
    doc.items,
    doc.settings.taxRate ?? 0,
    doc.settings.discountType,
    doc.settings.discountValue,
    doc.settings.applyStampDuty ?? false,
    doc.settings.stampDutyAmount ?? 0
  );

  // ── Logo ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!doc.logo) { setLogoDim(null); return; }
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const r = w / h;
      if (h > MAX_LOGO_HEIGHT_PX) { h = MAX_LOGO_HEIGHT_PX; w = h * r; }
      if (w > MAX_LOGO_WIDTH_PX) { w = MAX_LOGO_WIDTH_PX; h = w / r; }
      setLogoDim({ width: Math.round(w), height: Math.round(h) });
    };
    img.src = doc.logo;
  }, [doc.logo]);

  // ── Page Break Algorithm ─────────────────────────────────────────────────
  //
  // The hidden div is position:fixed at left<0, top=0.
  // containerTop ≈ 0, so element.getBoundingClientRect().top equals
  // the element's Y offset from the hidden div's top.
  //
  // Page N shows hidden-Y content from:
  //   [pageStarts[N] - topPad_N,  pageStarts[N] - topPad_N + pageH]
  // where topPad_N = 0 for N=0 (padding comes from invoice-doc class),
  //                  PAGE_MARGIN for N>0 (the inner div shift provides it).
  //
  // We leave BOTTOM_MARGIN whitespace at the bottom of every page.
  //
  const computePages = useCallback(() => {
    const container = hiddenRef.current;
    if (!container || container.offsetWidth === 0) return;

    const containerTop = container.getBoundingClientRect().top; // ≈ 0
    // Use the container's ACTUAL rendered width (should equal HIDDEN_WIDTH)
    const pageH = Math.round(container.offsetWidth * A4_RATIO);
    setPageHeightPx(pageH);

    // Collect all "atomic" elements — must NEVER be split across pages.
    const atomics = Array.from(
      container.querySelectorAll<HTMLElement>(
        'tbody tr, .invoice-totals, .invoice-amount-words, .invoice-bank-details, .invoice-notes, .invoice-legal-footer'
      )
    );

    const starts: number[] = [0];

    // Page 0: invoice-doc top padding acts as top margin.
    // Content bottom threshold: pageH - BOTTOM_MARGIN from containerTop.
    let visibleBottom = containerTop + pageH - BOTTOM_MARGIN;

    for (const el of atomics) {
      const rect = el.getBoundingClientRect();
      const elBottom = rect.bottom; // absolute viewport Y of element's bottom edge

      if (elBottom > visibleBottom) {
        // This element overflows the current page.
        // Start a new page exactly at this element's top.
        const elTopAbs = rect.top;                        // absolute viewport Y
        const elTopRel = elTopAbs - containerTop;         // relative to container top

        starts.push(elTopRel);

        // New visibleBottom: the new page shows content starting at elTopRel,
        // but we reserve PAGE_MARGIN at the top and BOTTOM_MARGIN at the bottom.
        // Content fits up to: elTopRel + (pageH - PAGE_MARGIN - BOTTOM_MARGIN)
        visibleBottom = elTopAbs + pageH - PAGE_MARGIN - BOTTOM_MARGIN;
      }
    }

    setPageStarts(starts);
  }, []);

  useEffect(() => {
    computePages();
    const t = setTimeout(computePages, 200);
    window.addEventListener('resize', computePages);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', computePages);
    };
  }, [doc, computePages]);

  // ── PDF Export ───────────────────────────────────────────────────────────
  // Use the browser's native print engine — identical to the Imprimer button.
  // The user selects "Save as PDF" in the print dialog (or it auto-saves).
  const handleDownloadPDF = () => {
    const originalTitle = document.title;
    // Fallbacks to handle empty values gracefully
    const emitterName = activeProfile?.company || activeProfile?.name || 'Emetteur';
    const clientName = doc?.recipient?.company || doc?.recipient?.name || 'Client';
    const docNumber = doc?.invoiceNumber || '';
    
    document.title = `${emitterName} - ${clientName} - ${docNumber}`.trim();
    
    window.print();
    
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  const numPages    = pageStarts.length;
  const bodyProps: BodyProps = { 
    doc, 
    activeProfile, 
    totals, 
    logoDim, 
    isExporting,
    onStampChange: (placement) => {
      dispatch({
        type: 'UPDATE_CURRENT_SETTINGS',
        payload: { stampPlacement: placement },
      });
    }
  };

  return (
    <div className="preview-pane">

      {/* ── Hidden measurement div ─────────────────────────────────────────
          Uses invoice-doc class so padding / font-size exactly match
          what the visible page cards render. position:fixed keeps it
          off-screen; visibility:hidden prevents any flash.
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        id="hidden-invoice-doc"
        ref={hiddenRef}
        className="invoice-doc"
        style={{
          position: 'fixed',
          left: -(HIDDEN_WIDTH + 300),
          top: 0,
          width: HIDDEN_WIDTH,
          // Override decorative invoice-doc styles that don't affect layout
          boxShadow: 'none',
          border: 'none',
          borderRadius: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          zIndex: -999,
        }}
      >
        <InvoiceBody {...bodyProps} />
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
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
          <button
            className="btn btn-primary"
            onClick={handleDownloadPDF}
            style={{ fontSize: '0.8rem' }}
          >
            <Download size={14} />{' '}Télécharger PDF
          </button>
        </div>
      </div>

      {/* ── Visible Page Cards ────────────────────────────────────────────
          Each card is an A4-proportioned white sheet.
          For page N (N>0):
            • Inner div is shifted up by startY, then shifted down by PAGE_MARGIN,
              so the first element on that page appears at card-Y = PAGE_MARGIN.
            • A white overlay [0, PAGE_MARGIN] masks any previous-page content
              that might bleed through at the top.
          For page 0: the invoice-doc's natural top padding provides breathing room.
      ─────────────────────────────────────────────────────────────────────── */}
      {pageStarts.map((startY, i) => {
        const isFirst  = i === 0;
        const numPagesTotal = numPages;
        const isLastPage = i === numPagesTotal - 1;

        // Shift the inner div so content at hidden-Y=startY appears at card-Y=PAGE_MARGIN
        // (for continuation pages). For page 0, no shift needed.
        const innerDivTop = isFirst ? undefined : -startY + PAGE_MARGIN;

        // All preview cards are rendered at fixed A4 height (white below last row = bottom margin).
        const cardHeight = pageHeightPx;

        return (
          <div
            key={i}
            className={`print-page ${isLastPage ? 'last-print-page' : ''}`}
            style={{
              width: '100%',
              maxWidth: 760,
              height: cardHeight,
              overflow: 'hidden',
              position: 'relative',
              background: '#ffffff',
              boxShadow: 'var(--shadow-preview)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {/* White mask: hides any previous-page content at top of continuation pages */}
            {!isFirst && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: PAGE_MARGIN,
                  background: '#ffffff',
                  zIndex: 4,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Page number badge */}
            {numPagesTotal > 1 && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: isFirst ? 10 : 10,
                  right: 14,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  color: 'var(--text-4)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  zIndex: 5,
                  userSelect: 'none',
                }}
              >
                {i + 1} / {numPagesTotal}
              </div>
            )}

            {/* White mask: hides any NEXT-page content at bottom of current page */}
            {pageStarts[i + 1] && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: (isFirst ? 0 : PAGE_MARGIN) + (pageStarts[i + 1] - startY),
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  zIndex: 4,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Invoice content — shifted to show only this page's slice.
               We do NOT use className="invoice-doc" here because that class
               has max-width, border, box-shadow etc. that conflict with the
               outer card container. Instead we replicate only the padding
               (2rem 2.75rem) that the invoice-doc class uses in CSS so that
               layout exactly matches the hidden measurement div. */}
            <div
              style={{
                position: isFirst ? 'relative' : 'absolute',
                top: innerDivTop,
                left: 0,
                right: 0,
                // Mirror invoice-doc class padding exactly
                padding: '2rem 2.75rem',
                fontSize: '0.82rem',
                lineHeight: 1.5,
                background: '#ffffff',
                color: 'var(--text-1)',
              }}
            >
              <InvoiceBody {...bodyProps} />
            </div>
          </div>
        );
      })}

      {/* Bottom spacer (hidden in print so it doesn't cause extra page) */}
      <div className="print-spacer" style={{ height: '1.5rem', flexShrink: 0 }} />
    </div>
  );
};

export default PreviewPane;
