/* ============================================================
   InspiredTax — ENTITLEMENT: freemium trial + subscription state
   (monetization programme Stage M1 — docs/programmes/monetization/01-SPEC.md)

   Single source of truth for "is this feature unlocked?". Nothing else
   in the codebase may compute trial/subscription state; every gate call
   site uses entUnlocked(key) (docs/programmes/monetization/00-DESIGN.md §3.1).

   Deliberately imports nothing from the other app modules and touches
   localStorage only inside functions: keeps this module free of import
   cycles (02-core imports FROM here) and directly importable in Node
   for the pure-function tests (tests/entitlement.js).
   ============================================================ */

/* ── Device-level storage ──
   iss_device is DEVICE scope, plaintext, readable pre-unlock. It must
   never be written into persistData()'s payload, hydrateFromData(),
   clearAllUserFields() or _buildExportPayload() — entitlement never
   rides a JSON backup (00-DESIGN §3.3); reinstall restores premium via
   Play queryPurchases (Stage M3), and the trial simply restarts. */
export const SK_DEVICE = 'iss_device';

export const ENT_TRIAL_DAYS = 7;
const DAY_MS = 86400000;
/* Offline validity windows past expiry while Play is unreachable
   (00-DESIGN §3.6): auto-renew plans may be in billing retry/grace, so
   +30 days; prepaid plans have no renewal to be generous about, +3. */
const OFFLINE_GRACE_AUTORENEW_MS = 30 * DAY_MS;
const OFFLINE_GRACE_PREPAID_MS = 3 * DAY_MS;

/* Play subscription states that still grant premium access (00-DESIGN
   §3.2): IN_GRACE keeps access while Play retries payment;
   CANCELLED_PAID_THROUGH keeps access until the paid period ends. */
const PREMIUM_STATES = ['ACTIVE', 'IN_GRACE', 'CANCELLED_PAID_THROUGH'];

/* ── Feature-key registry (00-DESIGN §4) ──
   Keys are the ONLY names gate call sites may use. Free features are
   deliberately absent: entUnlocked() returns true for unknown keys, so
   free flows never consult billing state. label/icon/blurb feed the
   locked-state UI (Stage M2 — the approved _mockups/ are the copy
   source); nothing consumes them in M1. */
export const ENT_FEATURES = {
  'income.investment': { label: 'Investment income', icon: 'finance_mode',
    blurb: 'Local interest, dividends and IT3(b) capture with the correct exemptions applied automatically.' },
  'income.rental':     { label: 'Rental income', icon: 'home',
    blurb: 'Track rental properties, expenses and levies — the correct taxable rental profit flows straight into your tax calculation.' },
  'income.business':   { label: 'Business & freelance income', icon: 'work',
    blurb: 'Sole-proprietor and freelance profit/loss with s20 loss treatment handled correctly.' },
  'income.cgt':        { label: 'Capital gains', icon: 'arrow_split',
    blurb: 'Asset disposals with base cost, the annual exclusion and primary-residence relief applied per the Eighth Schedule.' },
  'income.foreign':    { label: 'Foreign income', icon: 'public',
    blurb: 'Foreign earnings, dividends and interest with s6quat foreign tax credits computed for you.' },
  'income.other':      { label: 'Other receipts', icon: 'receipt_long',
    blurb: 'Royalties, prizes and other taxable receipts, each routed to the right ITR12 code.' },
  'income.crypto':     { label: 'Crypto disposals', icon: 'paid',
    blurb: 'Capital vs revenue treatment for crypto disposals, with base-cost tracking and the annual CGT exclusion applied correctly.' },
  'ded.medical':       { label: 'Medical credits', icon: 'stethoscope',
    blurb: 's6A/s6B medical scheme fees and out-of-pocket credits, including the disability rules.' },
  'ded.travel':        { label: 'Travel allowance', icon: 'directions_car',
    blurb: 'Logbook vs deemed-cost travel claims with the SARS rate tables built in.' },
  'ded.homeoffice':    { label: 'Home office', icon: 'home_work',
    blurb: 'Home-office deduction with the s11 requirements checked before you claim.' },
  'ded.donations':     { label: 'Donations (s18A)', icon: 'volunteer_activism',
    blurb: 's18A donation deductions with the 10% cap and carry-forward handled.' },
  'ded.tools':         { label: 'Tools & equipment', icon: 'handyman',
    blurb: 'Wear-and-tear claims on devices and equipment at the correct write-off rates.' },
  'ded.subscriptions': { label: 'Professional memberships', icon: 'crown',
    blurb: 'Deductible professional body memberships and subscriptions.' },
  'ded.subsistence':   { label: 'Subsistence allowance', icon: 'restaurant',
    blurb: 's8(1)(c) deemed-rate subsistence claims for work travel.' },
  'projection':        { label: 'Projections & optimisation', icon: 'show_chart',
    blurb: 'Scenario, multi-year and optimisation projections of your tax position.' },
  'provtax':           { label: 'Provisional tax & planner', icon: 'calendar_month',
    blurb: 'IRP6 estimates, para 20 penalty checks and a month-by-month planner to avoid year-end surprises.' },
  'historical':        { label: 'Historical calculators', icon: 'history',
    blurb: 'Recalculate and compare prior tax years back to 2015/16.' },
  'risk':              { label: 'Risk assessment', icon: 'no_encryption',
    blurb: 'An audit-risk review of your return before you file.' },
  'export.itr12':      { label: 'ITR12 report', icon: 'description',
    blurb: 'A field-by-field ITR12 filing guide generated from your data.' },
  'export.csv':        { label: 'CSV export', icon: 'table_view',
    blurb: 'Spreadsheet export of your full tax-year data.' }
};

/* ── Device record ── */
/* Fresh device has NO trial yet (`trialStart: null`) — the hard-gate
   (00-DESIGN §3.3, D-M6): the 7-day trial is only *established* by a
   successful Google Sign-In in `_syncTrialAnchor()`. `_computeState`
   already maps a null/absent `trialStart` to Basic, so an un-verified
   device (no Play services, Sign-In declined, offline first launch, or the
   browser/headless test path) stays Basic until verification anchors the
   trial. `now` still seeds the clock high-water mark. */
export function entDefaultDevice(now) {
  const t = (typeof now === 'number') ? now : Date.now();
  return { v: 1, trialStart: null, clockHighWater: t, entitlement: null, anchorSynced: false };
}

function _storage() {
  return (typeof localStorage !== 'undefined') ? localStorage : null;
}

/* Read the device record; on missing/corrupt/invalid data recreate a
   fresh one (never throw). A fresh record has `trialStart: null` (no trial
   until verified — hard-gate, 00-DESIGN §3.3), so deleting iss_device is
   equivalent to a reinstall: no trial is granted until the Drive anchor
   re-verifies. `trialStart` is VALID when null (not-yet-started) OR a
   parseable ISO string; anything else is corruption → recreate. */
export function _readDevice() {
  const ls = _storage();
  if (!ls) return entDefaultDevice();
  let d = null;
  try { d = JSON.parse(ls.getItem(SK_DEVICE)); } catch (e) { /* corrupt JSON → recreate */ }
  const tsOk = d && (d.trialStart === null
    || (typeof d.trialStart === 'string' && !isNaN(Date.parse(d.trialStart))));
  if (!d || d.v !== 1 || !tsOk) {
    d = entDefaultDevice();
    _writeDevice(d);
  }
  return d;
}

export function _writeDevice(d) {
  _entMemo = null;
  const ls = _storage();
  if (!ls) return;
  try { ls.setItem(SK_DEVICE, JSON.stringify(d)); } catch (e) { /* quota — entitlement degrades to recompute-fresh */ }
}

/* ── Clock-tamper guard (00-DESIGN §3.4) ──
   All time comparisons use max(wall clock, high-water mark): rolling the
   clock back never adds trial days or resurrects an expired sub; rolling
   it forward burns days and the high-water keeps them burnt. */
export function _effectiveNow(device, now) {
  const t = (typeof now === 'number') ? now : Date.now();
  return Math.max(t, device && typeof device.clockHighWater === 'number' ? device.clockHighWater : 0);
}

/* Bump the high-water mark. Called from entInit() and from the
   persistData() flush in 02-core.js (one line at source — no wrapper). */
export function entBumpClock() {
  const d = _readDevice();
  const now = Date.now();
  if (now > (d.clockHighWater || 0)) {
    d.clockHighWater = now;
    _writeDevice(d);
  }
}

/* ── State machine (00-DESIGN §3.2) — pure, Node-testable ──
   `now` must already be the effective (tamper-guarded) time. */
export function _computeState(device, now) {
  const ent = device && device.entitlement;

  if (ent && PREMIUM_STATES.indexOf(ent.state) !== -1 && typeof ent.expiryTimeMs === 'number') {
    const graceMs = ent.autoRenewing ? OFFLINE_GRACE_AUTORENEW_MS : OFFLINE_GRACE_PREPAID_MS;
    /* BACKLOG 70: Play listing the purchase at the last successful sync is
       the verdict. `verifiedAtEffective` is that moment on THIS function's
       tamper-guarded clock, so neither a derived expiry that is too short
       (the plan is unknown — the bridge never sends it) nor a clock
       high-water mark ahead of the wall clock can expire a purchase Play
       still lists. Offline, the grace runs from the later of the two. */
    const validThrough = Math.max(ent.expiryTimeMs,
      typeof ent.verifiedAtEffective === 'number' ? ent.verifiedAtEffective : 0);
    if (now <= validThrough + graceMs) {
      return {
        tier: 'premium', state: ent.state,
        trialDaysLeft: 0,
        plan: ent.basePlanId || null,
        expiryTimeMs: ent.expiryTimeMs,
        /* The date is the plan's own only when the plan is known; otherwise
           it is a one-month guess and the UI shows no date. */
        dateKnown: !!_plan(ent.basePlanId),
        autoRenewing: ent.autoRenewing !== false,
        offline: now > validThrough   // access from cache grace only — resync pending
      };
    }
  }

  // Not premium: trial if the 7-day window is still open. Never more than
  // ENT_TRIAL_DAYS: a start later than `now` (an anchor written from a clock
  // that was ahead) must not read as a longer trial.
  const trialStartMs = device ? Date.parse(device.trialStart) : NaN;
  const elapsed = isNaN(trialStartMs) ? Infinity : (now - trialStartMs);
  const trialDaysLeft = Math.min(ENT_TRIAL_DAYS, Math.max(0, ENT_TRIAL_DAYS - Math.floor(elapsed / DAY_MS)));
  if (trialDaysLeft > 0) {
    return { tier: 'trial', state: 'TRIAL', trialDaysLeft,
             plan: null, expiryTimeMs: null, dateKnown: false, autoRenewing: false, offline: false };
  }

  // Basic. Surface the underlying subscription state (REVOKED, ON_HOLD,
  // EXPIRED…) so the subscribe panel (M2) can explain WHY access ended;
  // an over-grace premium state collapses to EXPIRED.
  let state = 'BASIC';
  if (ent && ent.state) state = PREMIUM_STATES.indexOf(ent.state) !== -1 ? 'EXPIRED' : ent.state;
  return { tier: 'basic', state, trialDaysLeft: 0,
           plan: (ent && ent.basePlanId) || null,
           expiryTimeMs: (ent && ent.expiryTimeMs) || null,
           dateKnown: false, autoRenewing: false, offline: false };
}

/* ── Cross-reinstall trial anchor reconcile (00-DESIGN §3.3, D-M6) — pure ──
   Earliest valid ISO of the two trial-start timestamps. Earliest wins so a
   reinstall's fresh local start (= now) can never beat an older Drive
   anchor — wiping app data therefore cannot reset the trial. Null/invalid
   inputs are ignored; both invalid → null. Exported for tests. */
export function _reconcileTrialStart(localStart, anchorStart) {
  const lv = (typeof localStart === 'string') ? Date.parse(localStart) : NaN;
  const av = (typeof anchorStart === 'string') ? Date.parse(anchorStart) : NaN;
  const lOk = !isNaN(lv), aOk = !isNaN(av);
  if (lOk && aOk) return (lv <= av) ? localStart : anchorStart;
  if (lOk) return localStart;
  if (aOk) return anchorStart;
  return null;
}

/* ── Public surface ── */

let _entMemo = null;  // { at, snap } — 1s memo; M2 render passes call this per item

export function getEntitlement() {
  const wall = Date.now();
  if (_entMemo && (wall - _entMemo.at) < 1000) return _entMemo.snap;
  const device = _readDevice();
  const snap = _computeState(device, _effectiveNow(device, wall));
  _entMemo = { at: wall, snap };
  return snap;
}

/* THE gate. Unknown/absent key ⇒ free feature ⇒ always true. */
export function entUnlocked(key) {
  return getEntitlement().tier !== 'basic' || !(key in ENT_FEATURES);
}

/* Boot hook — called from startApp() (02-core.js) after every unlock,
   before renderAll(). Creates/repairs the device record (no trial yet —
   hard-gate), advances the clock high-water mark, kicks off the billing
   resync, and kicks off a SILENT trial-anchor sync: it establishes the trial
   only if Google already holds a grant for this app (reinstall, or a
   sign-in whose result landed after the last session). QR1/QD-01: boot and
   unlock never show the Google sign-in UI — the welcome CTA and Go Premium's
   "Start free trial" are the explicit actions that may. */
export function entInit() {
  _readDevice();                     // creates + persists the record on first run / repairs corruption
  entBumpClock();
  _syncBilling();
  _syncTrialAnchor({ interactive: false }); // async, fail-closed, unawaited — boot stays synchronous
}

/* True once a verified Google sign-in has established the trial start on
   this device (it may since have expired). UI uses it to decide whether the
   "Start free trial" action is offered at all. */
export function entTrialVerified() {
  return !!_readDevice().trialStart;
}
/* The trial can be started from this build: the native anchor plugin exists
   and no trial has been verified yet. Premium users are never offered it. */
export function entTrialOfferable() {
  return !!_anchor() && !entTrialVerified() && getEntitlement().tier !== 'premium';
}

/* ══ Google Play billing (Stage M3 — docs/programmes/monetization/
   02-BILLING-PLUGIN.md). The native plugin is a dumb pipe; every
   entitlement decision lives here. Browser / no-Play devices: _billing()
   is null and every path below is inert. ══ */

function _billing() {
  return (typeof window !== 'undefined'
    && window.Capacitor && window.Capacitor.Plugins
    && window.Capacitor.Plugins.PlayBilling) || null;
}

/* Base plans (00-DESIGN §5) — the one plan table (WR-8): billing period in
   months, whether the plan is prepaid (no renewal), its Play Console list
   price in rand, and for a launch offer the full-price plan it discounts.
   The verifier uses months/prepaid to derive expiry (Billing 8's client API
   exposes none — 02-BILLING-PLUGIN §4; the v2 backend verifier will supply
   exact expiryTime). The Go Premium screen (15-entitlement-ui.js) uses the
   prices only where Google Play has not sent its live ones: in the browser
   build, and for the "from …/month" line before the first sync. Kept here,
   not in 01-data.js, because tests/entitlement.js loads this module without
   a DOM and 01-data.js imports 02-core.js (BACKLOG 73). */
export const ENT_PLANS = Object.freeze({
  'monthly-r75':            Object.freeze({ months: 1,  prepaid: false, priceZar: 75 }),
  'annual-r495':            Object.freeze({ months: 12, prepaid: false, priceZar: 495 }),
  'annual-launch-r300':     Object.freeze({ months: 12, prepaid: false, priceZar: 300, launch: true, regular: 'annual-r495' }),
  'prepaid-1m-r95':         Object.freeze({ months: 1,  prepaid: true,  priceZar: 95 }),
  'prepaid-3m-r245':        Object.freeze({ months: 3,  prepaid: true,  priceZar: 245 }),
  'prepaid-3m-launch-r150': Object.freeze({ months: 3,  prepaid: true,  priceZar: 150, launch: true, regular: 'prepaid-3m-r245' })
});
/* Plan hints kept on the device record (newest last). */
const ENT_PLAN_HINTS_MAX = 5;
const _own = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
function _plan(basePlanId) { return _own(ENT_PLANS, basePlanId) ? ENT_PLANS[basePlanId] : null; }
function _addMonths(ms, n) {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

/* Verifier v1 (00-DESIGN §3.5, client-only): purchase came from the
   on-device Billing Library, state is PURCHASED (never PENDING), product
   is ours → acknowledge (Play refunds unacknowledged purchases after
   3 days) and derive the entitlement cache entry.

   BACKLOG 70. Billing 8's client Purchase does not carry the base plan, so
   the bridge always sends basePlanIds: [] (PlayBillingPlugin.purchasesToJs).
   The plan is known only when this install launched the purchase (`hints`,
   recorded by _ingestPurchases) or if a future bridge supplies it. With the
   plan known: a subscription's paid period ends at the first boundary past
   now whether or not it renews (auto-renew off runs to the end of the
   period paid for), a prepaid plan one period after purchase. Unknown: a
   one-month guess, rolled only while renewing — never shown as a date, and
   never the reason for losing access, because `verifiedAtEffective` records
   that Play listed it (see _computeState). A purchase that will not renew
   is CANCELLED_PAID_THROUGH ("Access until"), prepaid or cancelled alike. */
async function _verifyPurchase(p, plugin, hints, nowEffective) {
  if (!p || p.purchaseState !== 'PURCHASED' || p.productId !== 'premium') return null;
  const basePlanId = (Array.isArray(p.basePlanIds) && p.basePlanIds[0])
    || (_own(hints, p.purchaseToken) ? hints[p.purchaseToken] : null) || null;
  const plan = _plan(basePlanId);
  const months = plan ? plan.months : 1;
  const wall = Date.now();
  let expiry = _addMonths(p.purchaseTime || wall, months);
  const recurring = plan ? !plan.prepaid : !!p.isAutoRenewing;
  if (recurring) {
    // Roll forward to the first period boundary past now — refreshed on
    // every resync, so a subscription Play stops listing stops rolling.
    while (expiry <= wall) expiry = _addMonths(expiry, months);
  }
  if (!p.isAcknowledged && plugin) {
    try { await plugin.acknowledge({ purchaseToken: p.purchaseToken }); }
    catch (e) { console.warn('billing acknowledge failed:', (e && e.code) || e); }
  }
  return {
    productId: 'premium', basePlanId, purchaseToken: p.purchaseToken,
    expiryTimeMs: expiry, autoRenewing: !!p.isAutoRenewing,
    state: p.isAutoRenewing ? 'ACTIVE' : 'CANCELLED_PAID_THROUGH',
    lastVerified: wall,
    verifiedAtEffective: (typeof nowEffective === 'number') ? nowEffective : wall
  };
}

/* Apply a purchase list to the cache. Present+verified → premium (ACTIVE,
   or CANCELLED_PAID_THROUGH when it will not renew). A FULL list
   (getPurchases — `opts.delta` unset) that no longer holds a cached premium
   purchase → EXPIRED (v1's proxy for expiry/refund/revoke — 02-BILLING §4;
   the offline windows in _computeState still apply). A purchasesUpdated
   list is a DELTA — only what that flow produced — so it never expires
   anything (BACKLOG 70: an OK event carrying only a PENDING top-up used to
   flip an active Premium to EXPIRED until the next resync). */
async function _ingestPurchases(purchases, plugin, opts) {
  const delta = !!(opts && opts.delta);
  const list = purchases || [];
  let device = _readDevice();
  const nowEffective = _effectiveNow(device, Date.now());
  const priorTier = _computeState(device, nowEffective).tier;
  /* QR1.4/QD-04: a purchase the user just made (marker set by entPurchase)
     that Play now reports — a first purchase, or a plan change that produced
     a new purchase token — lands on the Dashboard with a confirmation. A
     boot/resume resync has no marker and stays in place. */
  const pending = _pendingPurchase;
  /* BACKLOG 70: the one moment a client can learn the base plan — the
     purchase this install just launched. Only from the flow's own result
     (a purchasesUpdated delta): the purchase sheet backgrounds the app, so a
     resume resync can run mid-flow and list an older purchase, which must
     not inherit the plan just tapped. Kept per purchase token, newest last,
     so a later resync of the same token keeps its plan. */
  if (delta && pending && pending.basePlanId) {
    const fresh = list.find(p => p && p.purchaseState === 'PURCHASED'
      && p.purchaseToken && p.purchaseToken !== pending.priorToken);
    if (fresh) {
      const hints = Object.assign({}, device.planHints);
      delete hints[fresh.purchaseToken];
      hints[fresh.purchaseToken] = pending.basePlanId;
      const keys = Object.keys(hints);
      while (keys.length > ENT_PLAN_HINTS_MAX) delete hints[keys.shift()];
      device = Object.assign({}, device, { planHints: hints });
      _writeDevice(device);
    }
  }
  let ent = null;
  for (const p of list) {
    const v = await _verifyPurchase(p, plugin, device.planHints, nowEffective);
    if (v && (!ent || v.expiryTimeMs > ent.expiryTimeMs)) ent = v;
  }
  device = _readDevice();   // acknowledge() awaited above — never write back a stale record
  if (ent) {
    _writeDevice(Object.assign({}, device, { entitlement: ent }));
  } else if (!delta && device.entitlement && PREMIUM_STATES.indexOf(device.entitlement.state) !== -1) {
    _writeDevice(Object.assign({}, device, {
      entitlement: Object.assign({}, device.entitlement, { state: 'EXPIRED', lastVerified: Date.now() })
    }));
  }
  if (!ent && delta && list.some(p => p && p.purchaseState === 'PENDING')) {
    _entNotify("Purchase pending — you'll be unlocked when payment completes", 'schedule');   // 00-DESIGN §8
  }
  _entMemo = null;
  entRefreshUi();
  if (ent && pending && (priorTier !== 'premium' || ent.purchaseToken !== pending.priorToken)) {
    _pendingPurchase = null;
    if (typeof _uiHooks.purchaseSucceeded === 'function') {
      _uiHooks.purchaseSucceeded(priorTier === 'premium' ? 'planChange' : 'new');
    }
  }
}

/* Pending-purchase marker (QR1.4): set just before the Play purchase sheet
   opens, cleared when that purchase is confirmed, cancelled or fails. In
   memory only — a purchase that settles after a process restart arrives via
   the boot resync and simply stays in place. */
let _pendingPurchase = null;   // { priorToken }

let _billingListener = false;
/* Billing-states commit (06-billing-states.md): "Restoring" is a real,
   transient UI state — true only while a resync is actually in flight with
   Play, never inferred or persisted. entIsRestoring() lets the UI show
   "Checking your Play purchases" instead of guessing at the state
   underneath while the answer isn't known yet. */
let _restoring = false;
export function entIsRestoring() { return _restoring; }
/* In-flight guard (BACKLOG 70): boot, resume, Restore and the
   ITEM_ALREADY_OWNED path can overlap. A second connect() while the first
   is still connecting is refused by Billing, and the loser used to clear
   `_restoring` while the winner was still running. Overlapping callers now
   share the one sync — the same pattern as _syncTrialAnchor. */
let _billingInFlight = null;
function _syncBilling() {
  if (_billingInFlight) return _billingInFlight;
  _billingInFlight = _syncBillingOnce().finally(() => { _billingInFlight = null; });
  return _billingInFlight;
}
async function _syncBillingOnce() {
  const plugin = _billing();
  if (!plugin) return;   // browser / sideload / no Play services — inert
  let productsSent = false;
  _restoring = true;
  entRefreshUi();
  try {
    if (!_billingListener) {
      _billingListener = true;
      plugin.addListener('purchasesUpdated', ev => {
        const code = ev && ev.resultCode;
        if (code !== 'OK') _pendingPurchase = null;                         // cancelled / failed / already owned
        if (code === 'OK') {
          _ingestPurchases((ev && ev.purchases) || [], plugin, { delta: true })
            .catch(e => console.warn('billing ingest:', (e && e.code) || e));
        }
        else if (code === 'ITEM_ALREADY_OWNED') { _syncBilling(); }        // silent restore (§8)
        else if (code === 'USER_CANCELED') { /* silent */ }
        else if (code === 'SERVICE_UNAVAILABLE' || code === 'NETWORK_ERROR') {
          _entNotify("You're offline — connect to subscribe", 'wifi');
        } else if (code) {
          console.warn('billing purchasesUpdated:', code);
          _entNotify('Purchase failed — nothing was charged', 'warning');
        }
      });
    }
    await plugin.connect();
    const res = await plugin.getPurchases();
    await _ingestPurchases((res && res.purchases) || [], plugin);
    try {
      const prod = await plugin.getProducts();
      if (prod && Array.isArray(prod.products) && prod.products.length && _uiHooks.setProducts) {
        _uiHooks.setProducts(prod.products);
        productsSent = true;
      }
    } catch (e) { console.warn('billing getProducts:', (e && e.code) || e); }
  } catch (e) {
    // connect/getPurchases failure → cached entitlement + offline windows
    console.warn('billing sync skipped:', (e && e.code) || e);
  } finally {
    _restoring = false;
    /* BACKLOG 73: a sync that ends without Play's plans says so, so Go
       Premium can stop waiting and offer a retry instead of selling from
       a fallback list. */
    if (!productsSent && typeof _uiHooks.productsUnavailable === 'function') {
      try { _uiHooks.productsUnavailable(); } catch (e) { /* pre-boot */ }
    }
    entRefreshUi();
  }
}

/* Launch the purchase flow for a base plan. Resolution arrives via the
   purchasesUpdated listener, not this promise. Plan changes (§5): between
   auto-renew plans pass the old token + replacement mode — upgrades charge
   prorated immediately, downgrades defer to period end; prepaid top-ups
   are plain purchases (Play stacks the time). No identifier goes with the
   purchase (BACKLOG 33, DECISIONS DS-1): the Data safety form declares no
   data collected, and an install-scoped obfuscatedAccountId would be
   *Device or other IDs*. */
export async function entPurchase(opts) {
  const plugin = _billing();
  if (!plugin || !opts || !opts.offerToken) return;
  try {
    const params = {
      productId: 'premium',
      offerToken: opts.offerToken
    };
    const cur = _readDevice().entitlement;
    const curPlan = cur ? _plan(cur.basePlanId) : null;
    const newPlan = _plan(opts.basePlanId);
    const toRecurring = newPlan ? !newPlan.prepaid : opts.autoRenewing !== false;
    if (cur && cur.state === 'ACTIVE' && cur.autoRenewing && cur.purchaseToken
        && toRecurring && opts.basePlanId !== cur.basePlanId) {
      if (!curPlan || !newPlan) {
        /* BACKLOG 70: the current plan was bought on another install (or
           before plans were recorded), so an upgrade cannot be told from a
           downgrade, and a plain purchase of the same product is refused
           as already owned. Google Play's own subscription page can change
           it. */
        _entNotify('Change your plan in Google Play — opening Subscriptions', 'open_in_new');
        if (typeof _uiHooks.manageSubscription === 'function') _uiHooks.manageSubscription();
        return;
      }
      params.oldPurchaseToken = cur.purchaseToken;
      params.replacementMode = newPlan.months > curPlan.months ? 'CHARGE_PRORATED_PRICE' : 'DEFERRED';
    }
    _pendingPurchase = { priorToken: (cur && cur.purchaseToken) || null, basePlanId: opts.basePlanId || null };
    await plugin.purchase(params);
  } catch (e) {
    _pendingPurchase = null;
    const code = e && e.code;
    if (code === 'USER_CANCELED') return;
    if (code === 'ITEM_ALREADY_OWNED') { _syncBilling(); return; }
    if (code === 'SERVICE_UNAVAILABLE' || code === 'NETWORK_ERROR') {
      _entNotify("You're offline — connect to subscribe", 'wifi'); return;
    }
    console.warn('billing purchase:', code || e);
    _entNotify('Purchase failed — nothing was charged', 'warning');
  }
}

/* Restore purchases (subscribe panel button; also runs at every boot sync,
   so reinstall self-heals without it — 00-DESIGN §8). A deliberate user
   action, so while the trial is still unverified it also verifies the trial
   anchor interactively — one of the QD-01 sites allowed to show the Google
   sign-in UI (entWelcomeCta and Go Premium's entStartTrial are the others).
   A verified device has nothing to re-verify and makes no anchor call. */
export async function entRestoreBilling() {
  await _syncBilling();
  if (!entTrialVerified()) await _syncTrialAnchor({ interactive: true });
  const e = getEntitlement();
  _entNotify(e.tier === 'premium' ? 'Premium restored' : 'No active subscription found',
    e.tier === 'premium' ? 'check_circle' : 'info');
}

/* BACKLOG 73: Go Premium's "Try again" when Google Play sent no plans. */
export function entRefreshProducts() { return _syncBilling(); }

/* Lifecycle resync — boot is entInit(); 02-core's visibilitychange handler
   calls this on every return to foreground (§3.6). The trial-anchor part is
   silent (QD-01), runs only while the trial is unverified, and is skipped
   while our own interactive sign-in is in flight — the Google activity
   backgrounds the WebView, so its return is itself a visibilitychange. */
export function entResumeSync() {
  entBumpClock();
  _syncBilling();
  if (!_interactiveSignInActive && !entTrialVerified()) _syncTrialAnchor({ interactive: false });
}

/* Native-only accessor for the trial-anchor plugin (docs/programmes/monetization/
   04-TRIAL-ANCHOR.md). Same guarded idiom as the billing accessor —
   undefined in the browser / headless / sideload, where the trial stays
   device-local (the M1 behaviour). */
function _anchor() {
  return (typeof window !== 'undefined'
    && window.Capacitor && window.Capacitor.Plugins
    && window.Capacitor.Plugins.TrialAnchor) || null;
}

/* Cross-reinstall trial anchor sync — the hard-gate that both ESTABLISHES
   and reconciles the trial (00-DESIGN §3.3, D-M6 / 04-TRIAL-ANCHOR.md).
   **Fail-closed**: never throws, never blocks boot, but any failure to
   verify (plugin absent → browser/headless/sideload; no Play services;
   Sign-In declined; offline) leaves `trialStart` untouched — so a fresh
   device with `trialStart: null` simply stays Basic, no trial. Only a
   SUCCESSFUL Sign-In + anchor read grants the trial:
     established = earliest(localStart, anchorStart) ?? now
   — an existing anchor (reinstall) is inherited (earliest-wins, so a
   reinstall can never farm a fresh trial); a genuine first-ever verified
   launch (both null) starts at `now`. The result is written back to
   whichever side is behind. Verify-once (B3.4/GEN-8): once `trialStart` is
   persisted, `_syncTrialAnchorOnce()` skips the READ (`getAnchor()`)
   outright unless called with `{ interactive: true }` — nothing it can
   return changes an already-established value, so the round-trip is pure
   cost. It does NOT also skip the WRITE: F4 (qa-remediation-2026-09, QR1
   post-merge review, Option A) retries an unconfirmed `putAnchor()` alone,
   silently, on every later boot/unlock, until Drive actually holds the
   value — see `anchorSynced` in `_syncTrialAnchorOnce()`.
   Silent/interactive (QR1): `opts.interactive` is passed to the plugin,
   whose silent path never shows UI and rejects SIGN_IN_REQUIRED instead
   (GoogleDrivePlugin.authorize). Only explicit user actions pass `true`
   (QD-01) — tests/entitlement.js asserts the lifecycle hooks never do.
   Java does I/O only; this JS owns the decision (single source of truth).
   Never throws; resolves `{ ok, code }` so an explicit action can name the
   reason (QD-03). Exported for tests.

   In-flight guard: entInit() fires this unawaited on boot, and a user tap
   on the welcome CTA (entWelcomeCta) can fire it again before the boot
   call's plugin.getAnchor() has resolved — e.g. while an interactive
   Google Sign-In activity is still on screen. Two concurrent getAnchor()
   calls each launch their own sign-in intent, and Capacitor's Activity-
   result bridge cannot reliably keep two overlapping legacy Sign-In
   activity chains straight (this was reproduced live: a second "Launching
   sign-in intent" log line firing ~60s after the first, one flow's result
   silently lost). Concurrent callers now share the one in-flight promise
   instead of triggering a second native call — except that an interactive
   request arriving while a SILENT call is in flight (boot's entInit, then
   the welcome-CTA tap) must not be answered by the silent result: it waits
   for the silent call to settle, then runs itself. */
let _trialAnchorInFlight = null;   // { promise, interactive }
/* Set while an interactive sign-in is in flight; entResumeSync skips the
   anchor sync while it is set. */
let _interactiveSignInActive = false;
export function _syncTrialAnchor(opts) {
  const interactive = !!(opts && opts.interactive);
  if (_trialAnchorInFlight) {
    if (!interactive || _trialAnchorInFlight.interactive) return _trialAnchorInFlight.promise;
    return _trialAnchorInFlight.promise.then(() => _syncTrialAnchor({ interactive: true }));
  }
  if (interactive) _interactiveSignInActive = true;
  const promise = _syncTrialAnchorOnce(interactive).finally(() => {
    _trialAnchorInFlight = null;
    if (interactive) _interactiveSignInActive = false;
  });
  _trialAnchorInFlight = { promise, interactive };
  return promise;
}
async function _syncTrialAnchorOnce(interactive) {
  const plugin = _anchor();
  if (!plugin) return { ok: false, code: 'UNAVAILABLE' };   // unverifiable environment → no trial granted (Basic)
  try {
    const device = _readDevice();
    /* B3.4/GEN-8: once trialStart is persisted, getAnchor() cannot change
       the outcome — _reconcileTrialStart is earliest-wins, so a resync
       against an already-verified device only ever reproduces the same
       value. Skip the READ outright unless a caller explicitly asked for a
       live check.
       F4 (qa-remediation-2026-09, QR1 post-merge review, Option A — owner
       2026-09-28): the old code skipped the WRITE too, so a putAnchor()
       that failed right after establishing trialStart (offline, Drive
       error) was never retried — the device stays a verified trial
       locally, but Drive never learns the date, so a future reinstall
       finds no anchor to inherit and starts a fresh trial, the one thing
       the anchor exists to prevent. anchorSynced tracks that separately:
       true only once putAnchor() has actually resolved. While it's false,
       every silent call below (every entInit — every boot/unlock) retries
       the write alone, no read, bounded to one Drive call per unlock — no
       timer, no retry loop. */
    if (!interactive && device.trialStart) {
      if (device.anchorSynced) return { ok: true, skipped: true };
      await plugin.putAnchor({ trialStart: device.trialStart, interactive: false });
      _writeDevice(Object.assign({}, device, { anchorSynced: true }));
      return { ok: true, resynced: true };
    }
    const localStart = device.trialStart;                       // null until verified
    const got = await plugin.getAnchor({ interactive });        // rejects → fail-closed
    const anchorStart = (got && got.trialStart) || null;
    // Establish or inherit: earliest existing start, else start now.
    const inherited = _reconcileTrialStart(localStart, anchorStart);
    const established = inherited || new Date().toISOString();
    /* F4: anchorSynced is true the moment `established` is what Drive just
       returned; otherwise it stays false until putAnchor() below resolves.
       Written now regardless of that outcome — the local grant never waits
       on Drive — so a putAnchor() throw, caught below, still leaves the
       true state on the device for the branch above to retry next unlock. */
    const anchorSynced = established === anchorStart;
    if (established !== localStart || anchorSynced !== !!device.anchorSynced) {
      const next = Object.assign({}, device, { trialStart: established, anchorSynced });
      /* BACKLOG 70: a first-ever trial starts now on the wall clock. A clock
         high-water mark left ahead of it (the phone's date was once set
         forward) would judge the new trial days old, or used up, and the
         Drive anchor would keep that start for the account. With no trial
         yet and no Premium cached, the mark guards nothing, so it comes back
         to now. An inherited start (reinstall) keeps the mark. */
      const premiumCached = device.entitlement && PREMIUM_STATES.indexOf(device.entitlement.state) !== -1;
      if (!inherited && !premiumCached && next.clockHighWater > Date.now()) next.clockHighWater = Date.now();
      _writeDevice(next);
    }
    if (!anchorSynced) {
      await plugin.putAnchor({ trialStart: established, interactive });
      _writeDevice(Object.assign({}, _readDevice(), { anchorSynced: true }));
    }
    _entMemo = null;      // trialStart may have moved → recompute
    entRefreshUi();
    return { ok: true };
  } catch (e) {
    /* SIGN_IN_REQUIRED (silent path, no grant yet) / offline / sign-in
       declined / no Play services / Drive error → grant nothing; a fresh
       device stays Basic, an already-verified device keeps its persisted
       trial. No toast here — lifecycle paths stay quiet; explicit actions
       word the returned code themselves (QD-03). warn (not error — the smoke
       gate fails on console.error). */
    const code = (e && e.code) || 'ERROR';
    if (typeof console !== 'undefined') {
      console.warn('trial-anchor sync skipped:', code);
    }
    return { ok: false, code };
  }
}

/* ── Screen/tab → feature-key map (00-DESIGN §4) ──
   Keys use the same composite screen-key format as navigateTo()'s effects
   map and the drawer's data-screen attributes ('income-b3rental',
   'ded-medical', 'proj-multiyear', 'provtax', …). Screens absent here are
   FREE — mirroring how ENT_FEATURES treats unknown feature keys.
   income-b7retirement and ded-interest are deliberately absent
   (free): they have no key in ENT_FEATURES, the normative registry. */
export const ENT_SCREEN_KEYS = {
  'income-b2investment': 'income.investment',
  'income-b3rental':     'income.rental',
  'income-b4business':   'income.business',
  'income-b5cgt':        'income.cgt',
  'income-b6foreign':    'income.foreign',
  'income-b9other':      'income.other',
  'income-b10crypto':    'income.crypto',
  'ded-medical':      'ded.medical',
  'ded-travel':       'ded.travel',
  'ded-homeoffice':   'ded.homeoffice',
  'ded-donations':    'ded.donations',
  'ded-tools':        'ded.tools',
  'ded-subscrip':     'ded.subscriptions',
  'ded-subsistence':  'ded.subsistence',
  'projection': 'projection', 'proj-scenario': 'projection',
  'proj-multiyear': 'projection', 'proj-optimise': 'projection',
  /* NAV-4 (§L.9): Historical folded into Taxation (mode 'summary') — the
     composite key now carries that prefix, matching entScreenKey(). OD-18
     (2026-09) folded Provisional Tax into Taxation the same way — it was a
     standalone mode (bare key 'provtax'), now the tab 'summary-provtax'. */
  'summary-calculator': 'historical',
  'summary-comparison': 'historical',
  'summary-risk': 'risk',
  'summary-provtax': 'provtax'
};
export function entFeatureForScreen(screenKey) {
  return ENT_SCREEN_KEYS[screenKey] || null;
}

/* ── One-time welcome dialog flag (01-SPEC M2.7) ──
   Stored on the device record (survives profile switches, dies with a
   reinstall — matching the trial's own scope). */
export function entNeedsWelcome() {
  return _readDevice().welcomed !== true;
}
export function entMarkWelcomed() {
  const d = _readDevice();
  if (d.welcomed !== true) _writeDevice(Object.assign({}, d, { welcomed: true }));
}

/* ── M2 UI hooks ──
   The gating UI lives in 15-entitlement-ui.js (it needs openModal /
   navigateTo / drawer renderers, which this module must not import — it
   stays import-free for Node tests and to avoid cycles, 02-core imports
   FROM here). 15 registers its implementations at module evaluation; the
   two public names below stay THE attachment points every gate call site
   uses, and internal callers (_syncTrialAnchor) bind to them lexically. */
let _uiHooks = {};
export function entRegisterUiHooks(hooks) { _uiHooks = hooks || {}; }
export function entOnLockedTap(key) {
  if (typeof _uiHooks.onLockedTap === 'function') _uiHooks.onLockedTap(key);
}
export function entRefreshUi() {
  if (typeof _uiHooks.refreshUi === 'function') _uiHooks.refreshUi();
}
/* Toast relay (billing paths need user feedback; showToast lives UI-side). */
function _entNotify(msg, icon) {
  if (typeof _uiHooks.notify === 'function') _uiHooks.notify(msg, icon);
}
