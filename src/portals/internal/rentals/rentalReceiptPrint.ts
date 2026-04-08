import type { RentalWithCar } from '../../../types/rental'
import {
  buildDetailRows,
  formatReceiptDateTime,
  formatReceiptToday,
  receiptNumber,
  receiptTotal,
} from './rentalReceiptFormat'
import { formatIdr } from '../../../lib/formatIdr'

const LEGAL_FOOTER =
  'Kuitansi ini dibuat secara elektronik oleh sistem dan berlaku sebagai bukti pembayaran sewa kendaraan yang sah sesuai data yang tercatat.'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Full HTML document for printing — no MUI/CSS variables (iframes lack theme :root). */
export function buildStandaloneReceiptHtml(rental: RentalWithCar, companyName: string): string {
  const issued = formatReceiptToday()
  const detailRows = buildDetailRows(rental)
  const total = receiptTotal(rental)
  const note = rental.manual_note?.trim()
  const num = receiptNumber(rental)
  const startLabel = formatReceiptDateTime(rental.start_date, rental.start_time)
  const endLabel = rental.end_date ? formatReceiptDateTime(rental.end_date, rental.end_time) : '—'
  const carName = rental.v2_cars ? rental.v2_cars.name : '—'
  const carPlate = rental.v2_cars ? rental.v2_cars.plate : ''

  const detailHtml = detailRows
    .map(
      (row) => `
    <div class="detail-row">
      <span class="detail-k">${escapeHtml(row.key)}</span>
      <span class="detail-vr">${escapeHtml(row.value)}</span>
    </div>`,
    )
    .join('')

  const noteHtml = note
    ? `
    <hr class="hr" />
    <div class="note-cap">Catatan</div>
    <p class="note-body">${escapeHtml(note)}</p>`
    : ''

  const phoneHtml = rental.renter_phone
    ? `<p class="muted nomargin">${escapeHtml(rental.renter_phone)}</p>`
    : ''

  const plateHtml = carPlate ? `<p class="muted car-plate">${escapeHtml(carPlate)}</p>` : ''

  const totalStr = total > 0 ? escapeHtml(formatIdr(total)) : '—'

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <title>Kuitansi Sewa</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      color: #1a1a1a;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt { max-width: 520px; margin: 0 auto; }
    .hdr {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 8px;
    }
    .title { font-size: 1.35rem; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em; color: #1a1a1a; }
    .company { color: #555; margin: 0; font-size: 0.9rem; }
    .meta { text-align: right; flex-shrink: 0; }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border: 1px solid #2e7d32;
      color: #2e7d32;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-bottom: 8px;
    }
    .ref { font-weight: 700; margin: 0; color: #1a1a1a; }
    .hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
    .section {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #555;
      margin: 0 0 10px 0;
    }
    .row2 {
      display: flex;
      flex-wrap: wrap;
      gap: 20px 32px;
      margin-bottom: 16px;
    }
    .grow { flex: 1 1 200px; min-width: 0; }
    .cap { font-size: 0.75rem; font-weight: 600; color: #555; display: block; margin-bottom: 4px; }
    .renter-name { font-weight: 700; margin: 0 0 4px 0; color: #1a1a1a; }
    .issued-val { font-weight: 600; margin: 0; color: #1a1a1a; }
    .muted { color: #555; }
    .nomargin { margin: 0; }
    .car-name { font-weight: 700; margin: 0 0 8px 0; color: #1a1a1a; }
    .car-plate { margin: 0 0 16px 0; font-size: 0.9rem; }
    .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .card {
      flex: 1;
      min-width: 140px;
      padding: 12px;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    .card-label { font-size: 0.7rem; font-weight: 600; color: #555; display: block; margin-bottom: 6px; }
    .card-value { font-weight: 600; font-size: 0.9rem; line-height: 1.35; margin: 0; color: #1a1a1a; }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-k { color: #555; }
    .detail-vr { font-weight: 700; text-align: right; white-space: nowrap; color: #1a1a1a; }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 16px 0 8px;
    }
    .total-label { font-size: 1rem; font-weight: 800; color: #1a1a1a; }
    .total-val { font-size: 1.15rem; font-weight: 800; color: #1a1a1a; }
    .note-cap { font-size: 0.75rem; font-weight: 600; color: #555; margin-bottom: 6px; }
    .note-body { color: #444; white-space: pre-wrap; margin: 0; }
    .footer { text-align: center; color: #555; margin-top: 24px; font-size: 0.9rem; }
    .legal {
      text-align: center;
      color: #666;
      font-size: 0.75rem;
      font-style: italic;
      line-height: 1.5;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="hdr">
      <div>
        <h1 class="title">Kuitansi Sewa</h1>
        <p class="company">${escapeHtml(companyName || '')}</p>
      </div>
      <div class="meta">
        <span class="badge">Selesai</span>
        <p class="ref">${escapeHtml(num)}</p>
      </div>
    </div>

    <hr class="hr" />
    <div class="section">PENYEWA</div>
    <div class="row2">
      <div class="grow">
        <p class="renter-name">${escapeHtml(rental.renter_name)}</p>
        ${phoneHtml}
      </div>
      <div>
        <span class="cap">Tanggal kuitansi</span>
        <p class="issued-val">${escapeHtml(issued)}</p>
      </div>
    </div>

    <hr class="hr" />
    <div class="section">KENDARAAN</div>
    <p class="car-name">${escapeHtml(carName)}</p>
    ${plateHtml}

    <div class="cards">
      <div class="card">
        <span class="card-label">Mulai</span>
        <p class="card-value">${escapeHtml(startLabel)}</p>
      </div>
      <div class="card">
        <span class="card-label">Selesai</span>
        <p class="card-value">${escapeHtml(endLabel)}</p>
      </div>
    </div>

    <hr class="hr" />
    <div class="section">RINCIAN</div>
    <div>${detailHtml}</div>

    <hr class="hr" />
    <div class="total-row">
      <span class="total-label">Total dibayar</span>
      <span class="total-val">${totalStr}</span>
    </div>

    ${noteHtml}

    <p class="footer">Terima kasih telah menyewa.</p>
    <p class="legal">${escapeHtml(LEGAL_FOOTER)}</p>
  </div>
</body>
</html>`
}

function whenDocReady(win: Window, doc: Document, fn: () => void): void {
  const run = () => {
    void doc.body?.offsetHeight
    window.setTimeout(fn, 50)
  }
  if (doc.readyState === 'complete') {
    run()
    return
  }
  win.addEventListener('load', run, { once: true })
}

/**
 * Prints via a hidden iframe (no extra tab). Iframe must have non-zero size: 0×0 clips the
 * body in Chrome/Edge print preview.
 */
export function printStandaloneReceipt(rental: RentalWithCar, companyName: string): void {
  const html = buildStandaloneReceiptHtml(rental, companyName)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('title', 'Kuitansi print')
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '210mm',
    height: '297mm',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  })
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument
  if (!win || !doc) {
    iframe.remove()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    iframe.remove()
  }

  let fallbackTimer: ReturnType<typeof setTimeout>
  win.addEventListener('afterprint', () => {
    window.clearTimeout(fallbackTimer)
    cleanup()
  })
  fallbackTimer = window.setTimeout(cleanup, 120_000)

  whenDocReady(win, doc, () => {
    win.focus()
    win.print()
  })
}
