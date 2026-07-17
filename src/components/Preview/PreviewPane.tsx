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

// A4 at 96 dpi: 794 × 1123px. Our doc max-width is 760px with 44px padding each side.
// We track page breaks by the rendered height of the inner content.
// A4 height in mm = 297mm, width = 210mm.
// At scale=2 for html2canvas, 1mm = ~7.56px
const A4_RATIO = 297 / 210; // height/width

// ─── Shared Invoice Body ──────────────────────────────────────────────────────
// We render the full invoice in one go; the preview scroll wrapper shows it
// as a continuous document. Page break lines are shown via CSS @media and
// via our computed `pageBreakAtPx` markers.

interface InvoiceBodyProps {
  doc: ReturnType<typeof useInvoice>['state']['currentDocument'];
  activeProfile: ReturnType<typeof useInvoice>['activeProfile'];
  totals: ReturnType<typeof calculateTotals>;
  logoDim: { width: number; height: number } | null;
  pageBreaks?: number[]; // Y positions (in px) where page breaks occur
}

const InvoiceBody: React.FC<InvoiceBodyProps> = ({ doc, activeProfile, totals, logoDim, pageBreaks = [] }) => {
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

      {/* Page break indicators rendered as absolute lines over the document */}
      {pageBreaks.map((y, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: y,
            height: 2,
            background: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <span style={{
            background: 'var(--surface)',
            color: 'var(--text-4)',
            fontSize: '0.65rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}>
            Page {i + 2}
          </span>
        </div>
      ))}
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PreviewPane: React.FC = () => {
  const { state, activeProfile } = useInvoice();
  const doc = state.currentDocument;
  const previewRef = useRef<HTMLDivElement>(null);

  const [logoDim, setLogoDim] = useState<{ width: number; height: number } | null>(null);
  const [pageBreaks, setPageBreaks] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const totals = calculateTotals(
    doc.items,
    doc.settings.taxRate ?? 0,
    doc.settings.discountType,
    doc.settings.discountValue,
    doc.settings.applyStampDuty ?? false,
    doc.settings.stampDutyAmount ?? 0
  );

  // Load logo dimensions
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

  // Compute page break Y-positions based on rendered document height
  const computePageBreaks = useCallback(() => {
    if (!previewRef.current) return;
    const docEl = previewRef.current;
    const docWidth = docEl.offsetWidth;
    // A4 page height in pixels = docWidth * A4_RATIO (since doc fills A4 width)
    const pageHeightPx = docWidth * A4_RATIO;
    const totalHeight = docEl.scrollHeight;
    const breaks: number[] = [];
    let breakY = pageHeightPx;
    while (breakY < totalHeight) {
      breaks.push(breakY);
      breakY += pageHeightPx;
    }
    setPageBreaks(breaks);
  }, []);

  // Recompute whenever items / content changes
  useEffect(() => {
    const timer = setTimeout(computePageBreaks, 100);
    return () => clearTimeout(timer);
  }, [doc.items, doc.notes, doc.sender, doc.recipient, doc.logo, computePageBreaks]);

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!previewRef.current || isExporting) return;
    setIsExporting(true);

    const el = previewRef.current;

    // Temporarily remove the page break indicator overlays from the capture
    const overlays = el.querySelectorAll('[data-page-break]');
    overlays.forEach((o) => (o as HTMLElement).style.display = 'none');

    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfPageW = pdf.internal.pageSize.getWidth();
      const pdfPageH = pdf.internal.pageSize.getHeight();

      // Capture the full document at high resolution
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: el.offsetWidth,
        windowHeight: el.scrollHeight,
        height: el.scrollHeight,
        width: el.offsetWidth,
      });

      // px per mm on the canvas (canvas maps to pdfPageW mm wide)
      const canvasPxPerMm = canvas.width / pdfPageW;
      const pageHeightCanvas = pdfPageH * canvasPxPerMm;

      const MARGIN_MM = 10; // top/bottom margin on continuation pages
      const marginPx = MARGIN_MM * canvasPxPerMm;

      let sliceTop = 0; // where on canvas we start slicing
      let isFirstPage = true;

      while (sliceTop < canvas.height) {
        // How much canvas content fits on this page
        const availablePagePx = isFirstPage
          ? pageHeightCanvas
          : pageHeightCanvas - 2 * marginPx;

        // Find best cut: don't cut mid-row — scan backwards from ideal cut for a clear row boundary
        let idealCut = sliceTop + (isFirstPage ? pageHeightCanvas : availablePagePx);
        let sliceBottom = Math.min(idealCut, canvas.height);

        if (sliceBottom < canvas.height) {
          // Try to find a row boundary by scanning up to 40px back
          const scanRange = Math.min(40 * 3, sliceBottom - sliceTop); // *3 because scale=3
          // We look at the pixel data row by row going upward from sliceBottom
          const ctx = canvas.getContext('2d');
          if (ctx) {
            let bestCut = sliceBottom;
            for (let scanY = sliceBottom; scanY > sliceBottom - scanRange; scanY--) {
              // Sample a horizontal row — if it's all white/near-white, it's a good break
              const rowData = ctx.getImageData(0, scanY, canvas.width, 1).data;
              let isWhiteRow = true;
              for (let x = 0; x < rowData.length; x += 4) {
                if (rowData[x] < 240 || rowData[x + 1] < 240 || rowData[x + 2] < 240) {
                  isWhiteRow = false;
                  break;
                }
              }
              if (isWhiteRow) {
                bestCut = scanY;
                break;
              }
            }
            sliceBottom = bestCut;
          }
        }

        const sliceHeight = sliceBottom - sliceTop;

        // Create a canvas slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = isFirstPage
          ? pageHeightCanvas
          : pageHeightCanvas;

        const pCtx = pageCanvas.getContext('2d');
        if (pCtx) {
          pCtx.fillStyle = '#ffffff';
          pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

          const destY = isFirstPage ? 0 : marginPx;
          pCtx.drawImage(
            canvas,
            0, sliceTop, canvas.width, sliceHeight,
            0, destY, canvas.width, sliceHeight
          );
        }

        if (!isFirstPage) {
          pdf.addPage();
        }

        const pageImgData = pageCanvas.toDataURL('image/png');
        pdf.addImage(pageImgData, 'PNG', 0, 0, pdfPageW, pdfPageH);

        sliceTop = sliceBottom;
        isFirstPage = false;
      }

      pdf.save(`${doc.invoiceNumber}.pdf`);
    } finally {
      overlays.forEach((o) => (o as HTMLElement).style.display = '');
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="preview-pane">
      {/* Toolbar */}
      <div className="preview-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Aperçu du document
          {pageBreaks.length > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--text-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              — {pageBreaks.length + 1} page{pageBreaks.length + 1 > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={handlePrint} style={{ fontSize: '0.8rem' }}>
            <Printer size={14} /> Imprimer
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDownloadPDF}
            disabled={isExporting}
            style={{ fontSize: '0.8rem', opacity: isExporting ? 0.7 : 1 }}
          >
            <Download size={14} /> {isExporting ? 'Génération…' : 'Télécharger PDF'}
          </button>
        </div>
      </div>

      {/* Invoice Document — single scrollable container with page break lines */}
      <div
        className="invoice-doc"
        ref={previewRef}
        style={{ position: 'relative' }}
      >
        <InvoiceBody
          doc={doc}
          activeProfile={activeProfile}
          totals={totals}
          logoDim={logoDim}
          pageBreaks={pageBreaks}
        />

        {/* Visible page break dividers */}
        {pageBreaks.map((y, i) => (
          <div
            key={i}
            data-page-break="true"
            style={{
              position: 'absolute',
              left: '-2.75rem',
              right: '-2.75rem',
              top: y - 1,
              height: 0,
              borderTop: '2px dashed var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <span style={{
              position: 'absolute',
              background: 'var(--surface)',
              color: 'var(--text-4)',
              fontSize: '0.62rem',
              fontWeight: 600,
              padding: '2px 10px',
              borderRadius: 99,
              border: '1px solid var(--border)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}>
              ✦ Page {i + 2}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PreviewPane;
