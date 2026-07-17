import React, { useRef, useState, useEffect } from 'react';
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

const PreviewPane: React.FC = () => {
  const { state, activeProfile } = useInvoice();
  const doc = state.currentDocument;
  const previewRef = useRef<HTMLDivElement>(null);
  const isAutoEntrepreneur = activeProfile?.businessType === 'auto-entrepreneur';
  // Track the logo's scaled dimensions (prevents html2canvas distortion)
  const [logoDim, setLogoDim] = useState<{width: number, height: number} | null>(null);

  const totals = calculateTotals(
    doc.items,
    doc.settings.taxRate ?? 0,
    doc.settings.discountType,
    doc.settings.discountValue,
    doc.settings.applyStampDuty ?? false,
    doc.settings.stampDutyAmount ?? 0
  );

  const currency = doc.settings.currency;

  // Whenever the logo changes, load it and capture its natural aspect ratio
  useEffect(() => {
    if (!doc.logo) { setLogoDim(null); return; }
    const img = new Image();
    img.onload = () => {
      let finalW = img.naturalWidth;
      let finalH = img.naturalHeight;
      const ratio = finalW / finalH;
      
      if (finalH > MAX_LOGO_HEIGHT_PX) {
        finalH = MAX_LOGO_HEIGHT_PX;
        finalW = MAX_LOGO_HEIGHT_PX * ratio;
      }
      if (finalW > MAX_LOGO_WIDTH_PX) {
        finalW = MAX_LOGO_WIDTH_PX;
        finalH = MAX_LOGO_WIDTH_PX / ratio;
      }
      
      setLogoDim({ width: Math.round(finalW), height: Math.round(finalH) });
    };
    img.src = doc.logo;
  }, [doc.logo]);

  const handleDownloadPDF = async () => {
    if (!previewRef.current) return;
    
    // Add a temporary class to ensure it's not scaled down or constrained during capture
    const originalStyle = previewRef.current.style.cssText;
    previewRef.current.style.height = 'auto';
    previewRef.current.style.overflow = 'visible';

    const canvas = await html2canvas(previewRef.current, { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff',
      windowHeight: previewRef.current.scrollHeight 
    });

    // Restore original styles
    previewRef.current.style.cssText = originalStyle;

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const imgRatio = canvas.height / canvas.width;
    const pdfImgHeight = pdfWidth * imgRatio;
    
    let heightLeft = pdfImgHeight;
    let position = 0;
    
    // First page
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
    heightLeft -= pdfPageHeight;
    
    // Subsequent pages
    while (heightLeft > 0) {
      position = position - pdfPageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
      heightLeft -= pdfPageHeight;
    }
    
    pdf.save(`${doc.invoiceNumber}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const bank = doc.senderBankDetails;
  const showBank = bank && (bank.accountNumber || bank.rib || bank.iban);

  return (
    <div className="preview-pane">
      {/* Preview Toolbar */}
      <div className="preview-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Aperçu du document
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={handlePrint} style={{ fontSize: '0.8rem' }}>
            <Printer size={14} /> Imprimer
          </button>
          <button className="btn btn-primary" onClick={handleDownloadPDF} style={{ fontSize: '0.8rem' }}>
            <Download size={14} /> Télécharger PDF
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="invoice-doc" ref={previewRef}>
        {/* Header */}
        <div className="invoice-doc-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {doc.logo ? (
              <img
                src={doc.logo}
                alt="Logo"
                style={{
                  display: 'block',
                  // Explicit pixel dimensions prevent html2canvas from stretching
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
          {/* Sender */}
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
          {/* Recipient */}
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

        {/* Amount in Words (required for Algerian invoices) */}
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
      </div>
    </div>
  );
};

export default PreviewPane;
