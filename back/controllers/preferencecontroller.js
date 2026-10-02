const Business = require('../model/businessmodel');

// Screen preferences for the active business (Master → Entry Settings).
// Missing keys fall back to these defaults, so older businesses see every section.
const DEFAULTS = {
  gstBillEntry: { showBillList: true, showReferences: true, showTransport: true, showPayment: true, showRemark: true, showSeries: true, showTaxType: true },
  dcEntry: { showList: true, showTransport: true, showRemark: true },
  buyerPoEntry: { showList: true, showPaymentTerms: true, showRemark: true },
};

const withDefaults = (prefs = {}) => Object.fromEntries(
  Object.entries(DEFAULTS).map(([page, fields]) => [page, Object.fromEntries(
    Object.entries(fields).map(([key, fallback]) => [key, typeof prefs[page]?.[key] === 'boolean' ? prefs[page][key] : fallback]),
  )]),
);

// Print templates (Master → Print templates): A4 / A5 for GST bills; A4 / A5
// (EA4 / EA5) and 3 / 4 inch roll (IN3 / IN4) for estimates — each with the
// details someone switched off. Field labels live in the frontend
// (src/printSettings.js); stored here as
//   { gstDefault, estimateDefault, hidden: { A4: [fieldKey…], A5: […], EA4: […], … } }
const GST_PRINT = ['A4', 'A5'];
const ESTIMATE_PRINT = ['EA4', 'EA5', 'IN4', 'IN3'];
const PRINT_TEMPLATES = [...GST_PRINT, ...ESTIMATE_PRINT];
const FIELD_KEY = /^[A-Za-z][A-Za-z0-9]{0,40}$/;
const cleanPrint = (s = {}) => ({
  gstDefault: GST_PRINT.includes(s.gstDefault) ? s.gstDefault : 'A4',
  estimateDefault: ESTIMATE_PRINT.includes(s.estimateDefault) ? s.estimateDefault : 'IN3',
  hidden: Object.fromEntries(PRINT_TEMPLATES.map((t) => [
    t,
    [...new Set((Array.isArray(s.hidden?.[t]) ? s.hidden[t] : []).filter((k) => typeof k === 'string' && FIELD_KEY.test(k)))].slice(0, 100),
  ])),
});

// GET /api/preferences/print
exports.getPrintSettings = async (req, res) => {
  try {
    const business = await Business.findById(req.auth.businessId, 'printSettings').lean();
    if (!business) return res.status(404).json({ error: 'Business not found.' });
    res.json(cleanPrint(business.printSettings));
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// PUT /api/preferences/print (business owner only)
exports.updatePrintSettings = async (req, res) => {
  try {
    if (req.auth.role !== 'owner') return res.status(403).json({ error: 'Only the business owner can change print templates.' });
    const printSettings = cleanPrint(req.body);
    const business = await Business.findByIdAndUpdate(req.auth.businessId, { $set: { printSettings } }, { new: true, projection: 'printSettings' }).lean();
    if (!business) return res.status(404).json({ error: 'Business not found.' });
    res.json(cleanPrint(business.printSettings));
  } catch (error) { res.status(400).json({ error: error.message }); }
};

exports.getPreferences = async (req, res) => {
  try {
    const business = await Business.findById(req.auth.businessId).lean();
    if (!business) return res.status(404).json({ error: 'Business not found.' });
    res.json(withDefaults(business.preferences));
  } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.updatePreferences = async (req, res) => {
  try {
    if (req.auth.role !== 'owner') return res.status(403).json({ error: 'Only the business owner can change entry settings.' });
    // Only known pages/keys are saved, and only as true/false.
    const preferences = withDefaults(req.body);
    const business = await Business.findByIdAndUpdate(req.auth.businessId, { preferences }, { new: true, runValidators: true }).lean();
    if (!business) return res.status(404).json({ error: 'Business not found.' });
    res.json(withDefaults(business.preferences));
  } catch (error) { res.status(400).json({ error: error.message }); }
};
