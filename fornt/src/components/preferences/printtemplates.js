import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson } from '../../api';
import { fetchLatest } from '../common/entryShortcuts';
import { getActiveSetting, withLogo } from '../../shopSettings';
import {
  TEMPLATES, GST_TEMPLATES, ESTIMATE_TEMPLATES, EMPTY_PRINT_SETTINGS, showFor, clearPrintSettingsCache,
} from '../../printSettings';
import { buildGstBillDocumentHtml } from '../sale/gstBillTemplate';
import { buildEstimateDocumentHtml } from '../estimate/estimateBillTemplate';
import './entrypreferences.css';

// Master → Print templates: A4 / A5 for GST bills; A4, A5, 4 inch, 3 inch for estimates.
// Pick the default template for each, switch details off per template, and
// see a live preview — filled with your latest bill / estimate, or a sample.

// Shown when there's no saved bill / estimate yet.
const SAMPLE_GST_BILL = {
  customer: { name: 'Sample Customer', gstin: '33ABCDE1234F1Z5', state: 'Tamil Nadu' },
  items: [
    { name: 'Sample product one', hsnCode: '7117', quantity: 2, unit: 'Nos', rate: 250, taxableValue: 500, gstRate: 3, cgstRate: 1.5, sgstRate: 1.5, igstRate: 0, cgstAmount: 7.5, sgstAmount: 7.5, igstAmount: 0 },
    { name: 'Sample product two', hsnCode: '7117', quantity: 1, unit: 'Nos', rate: 400, taxableValue: 400, gstRate: 3, cgstRate: 1.5, sgstRate: 1.5, igstRate: 0, cgstAmount: 6, sgstAmount: 6, igstAmount: 0 },
  ],
  billDetails: {
    invoiceNumber: 'GB/26-27/0001', date: new Date(), taxType: 'CGST_SGST', placeOfSupply: 'Tamil Nadu',
    deliveryChallanNumber: 'DC/26-27/0001', deliveryChallanDate: new Date(), transport: { vehicleNumber: 'TN01AB1234' },
    notes: 'Sample remark', totalTaxableValue: 900, totalCgst: 13.5, totalSgst: 13.5, totalIgst: 0, totalGst: 27, roundOff: 0, grandTotal: 927,
  },
};
const SAMPLE_ESTIMATE = {
  customer: { name: 'Sample Customer' },
  items: [
    { name: 'Sample product one', quantity: 2, unit: 'Nos', rate: 250, amount: 500 },
    { name: 'Sample product two with a longer name', quantity: 1, unit: 'Nos', rate: 400, amount: 400 },
  ],
  billDetails: { estimateNumber: 'EST/26-27/0001', date: new Date(), subtotal: 900, roundOff: 0, grandTotal: 900, cash: 500, credit: 400, openingBalance: 1000, closingBalance: 1400, notes: 'Sample remark' },
};

// Width of each template's page in screen pixels (96 per inch), to scale the preview.
const PAGE_PX = { A4: 794, A5: 559, EA4: 794, EA5: 559, IN4: 380, IN3: 290 };
const PAGE_HEIGHT_PX = { A4: 1123, A5: 794, EA4: 1123, EA5: 794, IN4: 900, IN3: 900 };
const PREVIEW_WIDTH = 480;

const PrintTemplates = () => {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(null);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [templateKey, setTemplateKey] = useState('A4');
  const [shop, setShop] = useState({});
  const [samples, setSamples] = useState({ gst: SAMPLE_GST_BILL, estimate: SAMPLE_ESTIMATE, real: { gst: false, estimate: false } });
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    fetchJson('/api/preferences/print')
      .then((s) => { const v = { ...EMPTY_PRINT_SETTINGS, ...s }; setSettings(v); setSaved(v); setTemplateKey(v.gstDefault); })
      .catch((error) => setStatus({ type: 'error', text: error.message || 'Unable to load print templates.' }));
    getActiveSetting().then(withLogo).then((s) => setShop(s || {})).catch(() => {});
    // Preview with the latest real bill / estimate when there is one.
    Promise.allSettled([fetchLatest('/api/gst-sales'), fetchLatest('/api/estimate-bills')]).then(([gst, est]) => {
      setSamples({
        gst: gst.status === 'fulfilled' ? gst.value : SAMPLE_GST_BILL,
        estimate: est.status === 'fulfilled' ? est.value : SAMPLE_ESTIMATE,
        real: { gst: gst.status === 'fulfilled', estimate: est.status === 'fulfilled' },
      });
    });
  }, []);

  const template = TEMPLATES[templateKey];
  const isGst = template.kind === 'gst';
  const show = useMemo(() => (settings ? showFor(settings, templateKey) : {}), [settings, templateKey]);
  const dirty = settings && saved && JSON.stringify(settings) !== JSON.stringify(saved);

  // Rebuild the preview whenever the template, its switches or the sample change.
  useEffect(() => {
    if (!settings) return undefined;
    let cancelled = false;
    const build = isGst
      ? buildGstBillDocumentHtml(samples.gst, shop, null, templateKey, { show, preview: true })
      : Promise.resolve(buildEstimateDocumentHtml(samples.estimate, shop, null, templateKey, { show, preview: true }));
    build.then((html) => { if (!cancelled) setPreviewHtml(html); }).catch(() => {});
    return () => { cancelled = true; };
  }, [settings, templateKey, show, isGst, samples, shop]);

  const setHidden = (keys, on) => {
    setSettings((s) => {
      const hidden = new Set(s.hidden?.[templateKey] || []);
      keys.forEach((k) => (on ? hidden.delete(k) : hidden.add(k)));
      return { ...s, hidden: { ...s.hidden, [templateKey]: [...hidden] } };
    });
    setStatus({ type: '', text: '' });
  };
  const setDefault = (key) => {
    setSettings((s) => ({ ...s, [TEMPLATES[key].kind === 'gst' ? 'gstDefault' : 'estimateDefault']: key }));
    setStatus({ type: '', text: '' });
  };

  const save = async () => {
    setSaving(true);
    try {
      const stored = await fetchJson('/api/preferences/print', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      });
      const v = { ...EMPTY_PRINT_SETTINGS, ...stored };
      setSettings(v);
      setSaved(v);
      clearPrintSettingsCache();
      setStatus({ type: 'success', text: 'Print templates saved.' });
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Unable to save print templates.' });
    } finally {
      setSaving(false);
    }
  };

  const isDefault = (key) => settings && (TEMPLATES[key].kind === 'gst' ? settings.gstDefault : settings.estimateDefault) === key;
  const switchable = template.fields.filter((f) => !f.locked);
  const scale = Math.min(1, PREVIEW_WIDTH / PAGE_PX[templateKey]);
  const pageHeight = PAGE_HEIGHT_PX[templateKey];

  const tab = (key) => (
    <button key={key} type="button" role="tab" aria-selected={key === templateKey}
      className={`prefs-subtab${key === templateKey ? ' is-active' : ''}`} onClick={() => setTemplateKey(key)}>
      {TEMPLATES[key].label}{isDefault(key) ? <small> · default</small> : null}
    </button>
  );

  return (
    <main className="prefs-page">
      <section className="prefs-card print-templates-card">
        <h2>Print templates</h2>
        <p className="prefs-intro">
          GST bills print on A4 or A5; estimates on A4, A5 or a 4 inch / 3 inch thermal roll. Choose the default for each
          (used by the Print button and Ctrl+P) and switch off details per template. <Link to="/entry-settings">← Entry Settings</Link>
        </p>

        {!settings ? <p className="prefs-loading">{status.text || 'Loading…'}</p> : (
          <>
            <div className="print-tabs">
              <div><span className="print-tabs-label">GST bills</span>{GST_TEMPLATES.map(tab)}</div>
              <div><span className="print-tabs-label">Estimates</span>{ESTIMATE_TEMPLATES.map(tab)}</div>
            </div>

            <div className="print-layout">
              <div className="print-controls">
                <fieldset className="prefs-group">
                  <legend>{template.label} — {template.paper}</legend>
                  <label className="prefs-option">
                    <input type="checkbox" checked={isDefault(templateKey)} disabled={isDefault(templateKey)} onChange={() => setDefault(templateKey)} />
                    <span>
                      <strong>Default for {isGst ? 'GST bills' : 'estimates'}</strong>
                      <small>{isDefault(templateKey) ? 'Print and Ctrl+P use this template.' : `Tick to make ${template.label} the default instead.`}</small>
                    </span>
                  </label>
                </fieldset>

                <fieldset className="prefs-group">
                  <legend>Details to print</legend>
                  <div className="prefs-section-head">
                    <small>Untick to leave a detail off this template only.</small>
                    <span className="prefs-bulk">
                      <button type="button" onClick={() => setHidden(switchable.map((f) => f.key), true)}>All on</button>
                      <button type="button" onClick={() => setHidden(switchable.map((f) => f.key), false)}>All off</button>
                    </span>
                  </div>
                  {template.fields.map((f) => (
                    <label key={f.key} className={`prefs-option${f.locked ? ' is-locked' : ''}`}>
                      <input type="checkbox" checked={Boolean(show[f.key])} disabled={f.locked} onChange={(e) => setHidden([f.key], e.target.checked)} />
                      <span>
                        <strong>{f.locked ? '🔒 Always printed (required by GST)' : f.label}</strong>
                        {f.locked ? <small>{f.label}</small> : null}
                      </span>
                    </label>
                  ))}
                </fieldset>

                {status.text && <p className={`prefs-status ${status.type}`} role="alert">{status.text}</p>}
                <div className="prefs-actions">
                  {dirty && <span className="prefs-dirty">Unsaved changes</span>}
                  <button type="button" className="prefs-save" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>

              <div className="print-preview">
                <div className="print-preview-head">
                  Preview · {(isGst ? samples.real.gst : samples.real.estimate) ? `your latest ${isGst ? 'bill' : 'estimate'}` : 'sample data'}
                </div>
                <div className="print-preview-frame" style={{ width: PAGE_PX[templateKey] * scale, height: pageHeight * scale }}>
                  <iframe
                    title={`${template.label} preview`}
                    srcDoc={previewHtml}
                    style={{ width: PAGE_PX[templateKey], height: pageHeight, transform: `scale(${scale})` }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default PrintTemplates;
