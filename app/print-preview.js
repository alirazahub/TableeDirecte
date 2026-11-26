'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import Dialog from './dialog'
import { money } from './restaurant-api'
import { billDocument, paymentDocument } from './print-documents'

function PrintDocument({ document: paper }) {
  return (
    <article className="print-document">
      <header>
        <p className="print-brand">Tablée Directe</p>
        <h2>{paper.title}</h2>
      </header>
      <dl className="print-details">
        {[paper.reference, ...paper.details].map((row) => (
          <div key={row.name}>
            <dt>{row.name}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {!!paper.items?.length && (
        <table className="print-items">
          <thead>
            <tr>
              <th scope="col">Qty</th>
              <th scope="col">Item</th>
              {paper.items[0].cents !== undefined && <th scope="col">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {paper.items.map((item) => (
              <tr key={item.key}>
                <td>{item.quantity}</td>
                <td>
                  <strong>{item.name}</strong>
                  {!!item.options.length && <span>{item.options.join(' · ')}</span>}
                  {item.note && <span>Note: {item.note}</span>}
                </td>
                {item.cents !== undefined && <td>{money(item.cents)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!!paper.totals?.length && (
        <dl className="print-totals">
          {paper.totals.map((row) => (
            <div key={row.name} data-emphasis={row.emphasis}>
              <dt>{row.name}</dt>
              <dd>{money(row.cents)}</dd>
            </div>
          ))}
        </dl>
      )}
      {paper.note && (
        <p className="print-footer">
          <strong>Order note:</strong> {paper.note}
        </p>
      )}
      {paper.footer && <p className="print-footer">{paper.footer}</p>}
    </article>
  )
}

export function PrintButton({ build, label, className = 'secondary' }) {
  const [paper, setPaper] = useState(null)
  const [format, setFormat] = useState('standard')
  return (
    <>
      <button type="button" className={className} onClick={() => setPaper(build())}>
        <Printer size={16} />
        {label}
      </button>
      {paper &&
        createPortal(
          <Dialog
            label={paper.title + ' print preview'}
            className={'print-modal print-' + format}
            onClose={() => setPaper(null)}
          >
            <div className="print-toolbar">
              <label>
                Paper format
                <select value={format} onChange={(event) => setFormat(event.target.value)}>
                  <option value="standard">Standard</option>
                  <option value="thermal">80 mm receipt</option>
                </select>
              </label>
              <button type="button" className="primary" onClick={() => window.print()}>
                <Printer size={17} /> Print / save PDF
              </button>
            </div>
            <PrintDocument document={paper} />
          </Dialog>,
          window.document.body,
        )}
    </>
  )
}

export function BillPrintActions({ visit }) {
  if (!visit || (!visit.orders.some((order) => order.status !== 'Cancelled') && !visit.payments.length))
    return null
  return (
    <div className="bill-print-actions">
      <PrintButton label="Print bill" build={() => billDocument(visit, Date.now())} />
      {!!visit.payments.length && (
        <details className="payment-prints">
          <summary>Payment receipts ({visit.payments.length})</summary>
          <div>
            {[...visit.payments].reverse().map((payment, index) => (
              <PrintButton
                key={payment.id}
                label={
                  'Print payment ' +
                  (visit.payments.length - index) +
                  ' · ' +
                  money(payment.amount + payment.tip)
                }
                build={() => paymentDocument(visit, payment)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
