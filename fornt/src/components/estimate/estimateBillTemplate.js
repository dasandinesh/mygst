// The printable Estimate/Quotation — a simplified layout (letterhead, plain
// item list, grand total, and the estimate customer's opening/closing
// balance — no HSN tax-summary table, no GST legal declaration).
// `EstimateDocument` is a plain React component that renders one estimate;
// `buildEstimateDocumentHtml` renders it to a full HTML print document (used
// by the "Print" buttons, which open a popup window and write the HTML into it).
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { formatDate } from '../../dateFormat';

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

// A4 = full-size office printer; A5 = half-page / small-counter printer.
// IN3 / IN4 = 3 inch (80 mm) / 4 inch (104 mm) thermal roll — the receipt
// layout further down (EstimateReceipt). `width` is the printable width.
const PAPER = { A4: { margin: '10mm' }, A5: { margin: '6mm' } };
const ROLL = {
  IN3: { width: '72mm', font: '11px' },
  IN4: { width: '96mm', font: '12px' },
};
export const PAPER_WINDOW = {
  A4: { width: 800, height: 900 },
  A5: { width: 560, height: 760 },
  IN3: { width: 380, height: 760 },
  IN4: { width: 470, height: 760 },
};
// Estimate template keys from Master → Print templates (EA4 / EA5 = estimate A4 / A5).
const SIZE_OF = { EA4: 'A4', EA5: 'A5' };
PAPER_WINDOW.EA4 = PAPER_WINDOW.A4;
PAPER_WINDOW.EA5 = PAPER_WINDOW.A5;

// Print stylesheet — edit this to restyle every printed estimate.
// Deliberately plainer than the GST bill's Tally-style printout: no HSN
// tax-summary table, no legal declaration wording.
const ESTIMATE_STYLE = `
  :root {
    --est-pad: 5px 8px;
    --est-font: 12.5px;
    --est-page-height: 277mm; /* A4 297mm minus 2 x 10mm @page margin */
  }
  body.paper-a5 {
    --est-pad: 4px 6px;
    --est-font: 10.5px;
    --est-page-height: 198mm; /* A5 210mm minus 2 x 6mm @page margin */
  }

  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: var(--est-font); color: #000; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: var(--est-pad); text-align: left; }
  th { font-weight: 700; text-align: center; }

  .estimate-doc { border: 1.5px solid #000; display: flex; flex-direction: column; min-height: var(--est-page-height); }
  .estimate-doc > .letterhead,
  .estimate-doc > .title-bar,
  .estimate-doc > .meta-table,
  .estimate-doc > .items-table { border-bottom: 1.5px solid #000; }

  .letterhead { text-align: center; padding: 10px 12px 8px; }
  .letterhead .company-name { font-size: 1.5em; font-weight: 700; }
  .letterhead-row { display: flex; align-items: center; gap: 10px; }
  .letterhead-logo, .letterhead-logo-spacer { flex: 0 0 100px; }
  .letterhead-logo { max-height: 56px; max-width: 100px; object-fit: contain; }
  .letterhead-text { flex: 1; text-align: center; }

  .title-bar { text-align: center; padding: 6px 12px; font-size: 1.2em; font-weight: 700; letter-spacing: .04em; }

  .meta-table td { border: none; padding: 5px 12px; vertical-align: top; }
  .meta-table td + td { border-left: 1.5px solid #000; }
  .meta-table .k { font-weight: 700; width: 40%; }

  .items-table { flex: 1 0 auto; height: 100%; }
  .items-table td { text-align: right; }
  .items-table td.l, .items-table th.l { text-align: left; }
  .items-table td.c, .items-table th.c { text-align: center; }
  .total-row td { font-weight: 700; }
  .spacer-row td { height: 100%; border-top: none; border-bottom: none; }

  .summary-table { margin: 0; }
  .summary-table td { padding: 6px 12px; }
  .summary-table .k { font-weight: 700; width: 55%; }
  .summary-table .grand td { font-weight: 700; font-size: 1.1em; }

  .footer-note { text-align: center; padding: 10px 12px; font-style: italic; }
  .footer-note strong { font-style: normal; }
`;

// One estimate's printable layout. `shop` is the active invoice setting
// (letterhead), or {}. `customer` is the matching estimate customer master
// record (for the printed address/phone), or null if not found.
// `show` is this template's details from Master → Print templates; anything missing prints.
export function EstimateDocument({ bill, shop = {}, customer = null, show: showSettings = {} }) {
  const show = (key) => showSettings[key] !== false;
  const items = bill.items || [];
  const b = bill.billDetails || {};

  const shopAddress = [shop.door, shop.street, shop.area, shop.district, shop.state, shop.pincode].filter(Boolean).join(', ');
  const shopPhones = [shop.phone, shop.phone_2].filter(Boolean).join(' / ');
  const customerAddress = customer ? [customer.door, customer.street, customer.area, customer.district, customer.state, customer.pincode].filter(Boolean).join(', ') : '';
  const totalQty = items.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

  return (
    <div className="estimate-doc">

      {/* Header Block */}
      <div className="letterhead">
        {shop.logo && show('logo') ? (
          <div className="letterhead-row">
            <img src={shop.logo} alt="" className="letterhead-logo" />
            <div className="letterhead-text">
              <div className="company-name">{shop.name || 'Estimate'}</div>
              {shopAddress && show('shopAddress') ? <div>{shopAddress}</div> : null}
              {show('shopPhone') ? <div>Contact : {shopPhones || '—'}</div> : null}
            </div>
            <div className="letterhead-logo-spacer" aria-hidden="true" />
          </div>
        ) : (
          <div className="letterhead-text">
            <div className="company-name">{shop.name || 'Estimate'}</div>
            {shopAddress && show('shopAddress') ? <div>{shopAddress}</div> : null}
            {show('shopPhone') ? <div>Contact : {shopPhones || '—'}</div> : null}
          </div>
        )}
      </div>
      <div className="title-bar">Estimate / Quotation</div>

      {/* Customer / Estimate details */}
      <table className="meta-table">
        <tbody>
          <tr>
            <td>
              <div><strong>Customer:</strong> {bill.customer?.name || ''}</div>
              {show('customerAddress') ? <div>{customerAddress || '—'}</div> : null}
              {show('customerPhone') ? <div>Phone : {customer?.phone || '—'}</div> : null}
            </td>
            <td>
              <table className="meta-table" style={{ border: 'none' }}>
                <tbody>
                  <tr><td className="k">Estimate No.</td><td>{b.estimateNumber || ''}</td></tr>
                  <tr><td className="k">Dated</td><td>{formatDate(b.date)}</td></tr>
                  {b.notes && show('remark') ? <tr><td className="k">Remark</td><td>{b.notes}</td></tr> : null}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Items Table */}
      <table className="items-table">
        <thead>
          <tr>{show('slNo') ? <th>Sl No.</th> : null}<th>Item</th><th>Qty</th>{show('unit') ? <th>Unit</th> : null}<th>Price</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={i}>
              {show('slNo') ? <td className="c">{i + 1}</td> : null}<td className="l">{p.name}</td>
              <td className="c">{p.quantity}</td>{show('unit') ? <td className="c">{p.unit || ''}</td> : null}
              <td>{money(p.rate)}</td><td>{money(p.amount)}</td>
            </tr>
          ))}
          <tr className="spacer-row"><td colSpan={4 + (show('slNo') ? 1 : 0) + (show('unit') ? 1 : 0)}></td></tr>
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={show('slNo') ? 2 : 1} className="l">Total{show('itemCount') ? ` (${items.length} items)` : ''}</td>
            <td className="c">{show('itemCount') ? totalQty : ''}</td>{show('unit') ? <td></td> : null}<td></td><td>{money(b.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Totals summary */}
      <table className="summary-table">
        <tbody>
          <tr><td className="k">Subtotal</td><td>{money(b.subtotal)}</td></tr>
          {b.roundOff && show('roundOff') ? <tr><td className="k">Round off</td><td>{money(b.roundOff)}</td></tr> : null}
          <tr className="grand"><td className="k">Grand total</td><td>{money(b.grandTotal)}</td></tr>
          {show('cashCredit') ? (
            <>
              <tr><td className="k">Cash</td><td>{money(b.cash)}</td></tr>
              <tr><td className="k">Credit</td><td>{money(b.credit)}</td></tr>
            </>
          ) : null}
          {show('balances') ? (
            <>
              <tr><td className="k">Opening balance</td><td>{money(b.openingBalance)}</td></tr>
              <tr><td className="k">Closing balance</td><td>{money(b.closingBalance)}</td></tr>
            </>
          ) : null}
        </tbody>
      </table>

      {show('footerNote') ? <div className="footer-note">This is an <strong>Estimate / Quotation</strong> — Not a Tax Invoice. Prices and availability subject to change.</div> : null}

    </div>
  );
}

// Thermal-roll receipt (3 inch / 4 inch): one narrow column, no page height —
// the roll just continues. 4 inch shows items as a table row each; 3 inch puts
// the item name on its own line with "qty × rate" and the amount under it.
const RECEIPT_STYLE = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; color: #000; }
  .receipt { width: var(--roll-width); padding: 2mm 0; font-size: var(--roll-font); line-height: 1.35; }
  .center { text-align: center; }
  .logo { display: block; max-width: 60%; max-height: 18mm; margin: 0 auto 2mm; object-fit: contain; }
  .shop-name { font-size: 1.35em; font-weight: 700; }
  .title { margin: 2mm 0 1mm; font-weight: 700; letter-spacing: .05em; }
  .rule { border-top: 1px dashed #000; margin: 1.5mm 0; }
  .row { display: flex; justify-content: space-between; gap: 2mm; }
  .row span:last-child { text-align: right; }
  .items { width: 100%; border-collapse: collapse; }
  .items th, .items td { padding: .6mm 0; text-align: right; vertical-align: top; }
  .items th { border-bottom: 1px dashed #000; font-weight: 700; }
  .items .l { text-align: left; }
  .item-name { font-weight: 600; }
  .grand { font-size: 1.25em; font-weight: 700; }
  .muted { font-size: .9em; }
`;

// `show` is this template's details from Master → Print templates; anything missing prints.
export function EstimateReceipt({ bill, shop = {}, customer = null, size = 'IN3', show: showSettings = {} }) {
  const show = (key) => showSettings[key] !== false;
  const items = bill.items || [];
  const b = bill.billDetails || {};
  const wide = size === 'IN4';
  const shopAddress = [shop.door, shop.street, shop.area, shop.district, shop.state, shop.pincode].filter(Boolean).join(', ');
  const shopPhones = [shop.phone, shop.phone_2].filter(Boolean).join(' / ');
  const customerAddress = customer ? [customer.door, customer.street, customer.area, customer.district, customer.state, customer.pincode].filter(Boolean).join(', ') : '';
  const totalQty = items.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const qty = (p) => `${p.quantity}${show('unit') && p.unit ? ` ${p.unit}` : ''}`;

  return (
    <div className="receipt">
      <div className="center">
        {shop.logo && show('logo') ? <img src={shop.logo} alt="" className="logo" /> : null}
        <div className="shop-name">{shop.name || 'Estimate'}</div>
        {shopAddress && show('shopAddress') ? <div>{shopAddress}</div> : null}
        {shopPhones && show('shopPhone') ? <div>Ph: {shopPhones}</div> : null}
        <div className="title">ESTIMATE / QUOTATION</div>
      </div>
      <div className="row"><span>No: {b.estimateNumber || ''}</span><span>Date: {formatDate(b.date)}</span></div>
      <div>Customer: <strong>{bill.customer?.name || ''}</strong></div>
      {customerAddress && show('customerAddress') ? <div className="muted">{customerAddress}</div> : null}
      {customer?.phone && show('customerPhone') ? <div className="muted">Ph: {customer.phone}</div> : null}

      <div className="rule" />
      {wide ? (
        <table className="items">
          <thead>
            <tr>{show('slNo') ? <th className="l">#</th> : null}<th className="l">Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={i}>
                {show('slNo') ? <td className="l">{i + 1}</td> : null}
                <td className="l">{p.name}</td><td>{qty(p)}</td><td>{money(p.rate)}</td><td>{money(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : items.map((p, i) => (
        <div key={i}>
          <div className="item-name">{show('slNo') ? `${i + 1}. ` : ''}{p.name}</div>
          <div className="row"><span>{qty(p)} × {money(p.rate)}</span><span>{money(p.amount)}</span></div>
        </div>
      ))}
      <div className="rule" />

      {show('itemCount') ? <div className="row muted"><span>Items: {items.length}</span><span>Qty: {totalQty}</span></div> : null}
      <div className="row"><span>Subtotal</span><span>{money(b.subtotal)}</span></div>
      {b.roundOff && show('roundOff') ? <div className="row"><span>Round off</span><span>{money(b.roundOff)}</span></div> : null}
      <div className="row grand"><span>TOTAL</span><span>{money(b.grandTotal)}</span></div>
      {show('cashCredit') ? (
        <>
          <div className="row"><span>Cash</span><span>{money(b.cash)}</span></div>
          <div className="row"><span>Credit</span><span>{money(b.credit)}</span></div>
        </>
      ) : null}
      {show('balances') ? (
        <>
          <div className="rule" />
          <div className="row"><span>Opening balance</span><span>{money(b.openingBalance)}</span></div>
          <div className="row"><span>Closing balance</span><span>{money(b.closingBalance)}</span></div>
        </>
      ) : null}
      {b.notes && show('remark') ? <><div className="rule" /><div>Remark: {b.notes}</div></> : null}
      {show('footerNote') ? <><div className="rule" /><div className="center muted">Estimate / Quotation — not a tax invoice.</div></> : null}
    </div>
  );
}

// Renders EstimateDocument (A4 / A5) or EstimateReceipt (IN3 / IN4) to a full
// HTML print document for one estimate — used by the "Print" buttons, which
// open a popup window and write this HTML into it directly (the template's own
// onload triggers window.print(); options.preview leaves that out).
export const buildEstimateDocumentHtml = (bill, shop = {}, customer = null, template = 'A4', options = {}) => {
  const size = SIZE_OF[template] || template;
  const printScript = options.preview ? '' : '<script>window.onload = function () { window.print(); };</script>';
  if (ROLL[size]) {
    const roll = ROLL[size];
    const estimateNo = bill.billDetails?.estimateNumber || '';
    // No page size: the thermal printer's own paper setting (roll width) applies.
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Estimate ${estimateNo} (${size === 'IN4' ? '4 inch' : '3 inch'})</title>
<style>@page { margin: 2mm; } :root { --roll-width: ${roll.width}; --roll-font: ${roll.font}; } ${RECEIPT_STYLE}</style>
</head>
<body>
  ${ReactDOMServer.renderToStaticMarkup(<EstimateReceipt bill={bill} shop={shop} customer={customer} size={size} show={options.show || {}} />)}
  ${printScript}
</body>
</html>
`;
  }
  const paper = PAPER[size] || PAPER.A4;
  const paperClass = size === 'A5' ? 'paper-a5' : 'paper-a4';
  const estimateNumber = bill.billDetails?.estimateNumber || '';
  const bodyHtml = ReactDOMServer.renderToStaticMarkup(
    <EstimateDocument bill={bill} shop={shop} customer={customer} show={options.show || {}} />
  );

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Estimate ${estimateNumber} (${size})</title>
<style>@page { size: ${size}; margin: ${paper.margin}; } ${ESTIMATE_STYLE}</style>
</head>
<body class="${paperClass}">
  ${bodyHtml}
  ${printScript}
</body>
</html>
`;
};
