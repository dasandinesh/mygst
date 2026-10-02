// Print templates: A4 and A5 for GST bills, 3 inch and 4 inch (thermal roll)
// for estimates. Each template has its own list of details that can be hidden
// (Master → Print templates), and each document type has a default template
// used by the Print button and Ctrl+P.
//
// Saved on the business (GET/PUT /api/preferences/print) as
//   { gstDefault: 'A4'|'A5', estimateDefault: 'EA4'|'EA5'|'IN4'|'IN3', hidden: { A4: [fieldKey…], … } }
// i.e. only the details someone switched off.
import { fetchJson } from './api';

// Details of a GST tax invoice. `locked` ones are required on every tax
// invoice (CGST Rule 46) and always print; they are listed so users see why.
const GST_FIELDS = [
  { key: 'logo', label: 'Logo' },
  { key: 'headerNote', label: 'Header note (under your name)' },
  { key: 'shopPhone', label: 'Your phone numbers' },
  { key: 'buyerPhone', label: 'Buyer phone' },
  { key: 'shipTo', label: 'Ship to address' },
  { key: 'references', label: 'DC and Buyer\'s PO numbers' },
  { key: 'transport', label: 'Vehicle no. / Transporter ID' },
  { key: 'taxType', label: 'Tax type line (CGST + SGST / IGST)' },
  { key: 'remark', label: 'Remark' },
  { key: 'unitColumn', label: '"per" (unit) column' },
  { key: 'amountInWords', label: 'Amount in words' },
  { key: 'hsnSummary', label: 'HSN-wise tax summary table' },
  { key: 'taxInWords', label: 'Tax amount in words' },
  { key: 'declaration', label: 'Declaration' },
  { key: 'customerSign', label: 'Customer signature box' },
  { key: 'pageNumber', label: 'Page number strip' },
  { key: 'gstRequired', label: 'Your & buyer\'s name, address, GSTIN · invoice no. & date · place of supply · items with HSN, qty, value · tax rates & amounts · total', locked: true },
];

const ESTIMATE_FIELDS = [
  { key: 'logo', label: 'Logo' },
  { key: 'shopAddress', label: 'Your address' },
  { key: 'shopPhone', label: 'Your phone numbers' },
  { key: 'customerAddress', label: 'Customer address' },
  { key: 'customerPhone', label: 'Customer phone' },
  { key: 'remark', label: 'Remark' },
  { key: 'slNo', label: 'Serial numbers' },
  { key: 'unit', label: 'Unit (pcs, kg…)' },
  { key: 'itemCount', label: 'Item / quantity count' },
  { key: 'roundOff', label: 'Round off' },
  { key: 'cashCredit', label: 'Cash and credit' },
  { key: 'balances', label: 'Opening and closing balance' },
  { key: 'footerNote', label: '"Not a tax invoice" note' },
];

// GST bills: A4 / A5. Estimates: A4 / A5 (EA4 / EA5, their own switches) and
// 3 / 4 inch thermal rolls. `size` is what the print templates are given.
export const TEMPLATES = {
  A4: { key: 'A4', label: 'A4', kind: 'gst', size: 'A4', paper: 'A4 sheet (210 mm)', fields: GST_FIELDS },
  A5: { key: 'A5', label: 'A5', kind: 'gst', size: 'A5', paper: 'A5 sheet (148 mm)', fields: GST_FIELDS },
  EA4: { key: 'EA4', label: 'A4', kind: 'estimate', size: 'A4', paper: 'A4 sheet (210 mm)', fields: ESTIMATE_FIELDS },
  EA5: { key: 'EA5', label: 'A5', kind: 'estimate', size: 'A5', paper: 'A5 sheet (148 mm)', fields: ESTIMATE_FIELDS },
  IN4: { key: 'IN4', label: '4 inch', kind: 'estimate', size: 'IN4', paper: '4 inch thermal roll (104 mm)', fields: ESTIMATE_FIELDS },
  IN3: { key: 'IN3', label: '3 inch', kind: 'estimate', size: 'IN3', paper: '3 inch thermal roll (80 mm)', fields: ESTIMATE_FIELDS },
};
export const GST_TEMPLATES = ['A4', 'A5'];
export const ESTIMATE_TEMPLATES = ['EA4', 'EA5', 'IN4', 'IN3'];

export const EMPTY_PRINT_SETTINGS = { gstDefault: 'A4', estimateDefault: 'IN3', hidden: {} };

// { fieldKey: true|false } for one template — what to print.
export const showFor = (settings, templateKey) => {
  const hidden = new Set(settings?.hidden?.[templateKey] || []);
  return Object.fromEntries((TEMPLATES[templateKey]?.fields || []).map((f) => [f.key, f.locked || !hidden.has(f.key)]));
};

// Loaded once per visit and reused; Print templates calls clearPrintSettingsCache() after saving.
let cache = null;
export const getPrintSettings = () => {
  if (!cache) {
    cache = fetchJson('/api/preferences/print').then((s) => ({ ...EMPTY_PRINT_SETTINGS, ...s }));
    cache.catch(() => { cache = null; });
  }
  return cache;
};
export const clearPrintSettingsCache = () => { cache = null; };
