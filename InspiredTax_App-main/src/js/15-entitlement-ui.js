/* ============================================================
   InspiredTax — ENTITLEMENT UI: gating surfaces (Stage M2)
   (docs/programmes/monetization/01-SPEC.md M2; the merged _mockups/
   locked-states.html, paywall-modal.html, subscribe-panel.html are the
   approved UI contract — markup/copy below reproduce them.)

   14-entitlement.js owns STATE and stays import-free; this module owns
   every gating SURFACE (locked overlay, #modal-locked, subscribe panel,
   dashboard chip copy, welcome dialog) and registers itself into 14's
   entOnLockedTap/entRefreshUi hook slots at evaluation. All cross-module
   calls here happen at runtime (post-boot), never at module-eval — safe
   under the ESM cycle rules (CLAUDE.md rule #10).
   ============================================================ */

import { $, APP, esc, fmt, iconClassFor, navigateTo, openModal, closeModal, showToast, MODE_PREFIX_MAP } from './02-core.js';
import { katHtml } from './01-data.js';
import { updateDrawerDeductions, updateDrawerIncomeCalcs, updateIncomeTabs, updateDeductionTabs } from './04-deductions.js';
import { updateFAB } from './08-dashboard-theme.js';
import { ENT_FEATURES, entFeatureForScreen, entUnlocked, getEntitlement,
         entRegisterUiHooks, entNeedsWelcome, entMarkWelcomed, _syncTrialAnchor,
         entPurchase, entRestoreBilling, entIsRestoring, entTrialOfferable,
         entTrialVerified, ENT_PLANS, entRefreshProducts, ENT_TRIAL_DAYS } from './14-entitlement.js';

/* ── Per-feature stored-entry counts (data-retention note, 00-DESIGN §4.1:
   locked data is retained and still computed — the overlay/modal must say
   so whenever the locked module holds records). */
/* ── Billing states (design handoff 06-billing-states.md) ──
   Two rules that govern all eight: (1) capture/edit/view never lock, in any
   state — only export, the provisional schedule and projections gate; (2)
   red is reserved for data loss, never for money. Grace and on-hold are
   recoverable and say how, in amber.

   Per-state copy for Grace, On hold and Cancelled-but-active is lifted from
   the spec verbatim. The reference `templates/billing-states/` STATES array
   the spec says to "lift verbatim" for the other five states' body/footnote
   text is a design-system asset not present in this repository — those five
   (Trial, Active, Expired, Restoring, Refunded) are authored here to match
   the spec's table (pill/colour/banner-title/primary-action) and the same
   voice, not copied from a source this repo doesn't have. The Trial/Expired
   primary CTA also deliberately does not repeat the spec's literal
   price — a figure typed into the banner would misquote the price a card
   is actually charged (prices: the Plans section below, BACKLOG 73). */
function _fmtDate(ms) {
  return ms ? new Date(ms).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}
function _entStateKey(e, restoring) {
  if (restoring) return 'RESTORING';
  if (e.tier === 'trial') return 'TRIAL';
  /* BACKLOG 70: a purchase that will not renew (prepaid, or auto-renew
     switched off) reads as paid-through, never "Renews" — including an
     entitlement cached by an older build as ACTIVE. */
  if (e.tier === 'premium') return (e.state === 'ACTIVE' && e.autoRenewing === false) ? 'CANCELLED_PAID_THROUGH' : e.state;  // ACTIVE | IN_GRACE | CANCELLED_PAID_THROUGH
  if (e.state === 'ON_HOLD') return 'ON_HOLD';
  if (e.state === 'REFUNDED') return 'REFUNDED';  // no live signal produces this today — see PR notes
  return 'EXPIRED';  // covers BASIC (never subscribed) and EXPIRED (lapsed past grace)
}
function _entStateMeta(e) {
  const restoring = entIsRestoring();
  const key = _entStateKey(e, restoring);
  /* BACKLOG 70: a date only when it is the plan's own — with the plan
     unknown (bought on another install) it would be a one-month guess. */
  const until = e.dateKnown ? _fmtDate(e.expiryTimeMs) : '';
  switch (key) {
    case 'TRIAL': {
      const n = e.trialDaysLeft;
      return { key, pill: `Trial · ${n} day${n === 1 ? '' : 's'}`, pillClass: 'ent-pill-mint',
        title: n <= 1 ? 'Your trial ends today' : `${n} days left in your trial`,
        body: 'Every calculator, planner and report is unlocked. Subscribe any time to keep them after your trial ends.',
        primaryLabel: 'Subscribe', primaryAction: "navigateTo('subscribe','')",
        footnote: '' };
    }
    case 'ACTIVE':
      return { key, pill: 'Pro', pillClass: 'ent-pill-mint',
        title: 'InspiredTax Pro is active',
        body: until ? `Renews ${until}. Manage billing any time in Google Play.` : 'Manage billing any time in Google Play.',
        primaryLabel: 'Manage in Play Store', primaryAction: 'entManageSubscription()',
        footnote: '' };
    case 'IN_GRACE':
      return { key, pill: 'Payment issue', pillClass: 'ent-pill-amber ent-pill-pulse-fast',
        title: 'Your renewal payment did not go through',
        /* BACKLOG 74: no day count — the grace period is set in Play Console
           (and was 7, not the 12 this said). */
        body: 'Google Play is retrying the payment, and every Pro feature stays unlocked while it does. Nothing has been lost — you only need to fix the payment method.',
        primaryLabel: 'Fix payment in Play', primaryAction: 'entManageSubscription()',
        footnote: '' };
    case 'ON_HOLD':
      return { key, pill: 'Paused', pillClass: 'ent-pill-amber ent-pill-pulse-fast',
        title: 'Subscription paused after failed payments',
        body: 'Pro features are on hold until payment succeeds. Capturing and viewing your return still works normally, and every figure is intact.',
        primaryLabel: 'Update payment method', primaryAction: 'entManageSubscription()',
        footnote: 'The moment Play collects payment, everything unlocks exactly where you left it. No re-entry, no re-import.' };
    case 'CANCELLED_PAID_THROUGH':
      return { key, pill: until ? `Pro until ${until}` : 'Pro', pillClass: 'ent-pill-cyan',
        title: until ? `Thanks — you have Pro until ${until}` : 'InspiredTax Pro is active',
        body: until ? 'Your subscription won’t renew, but every Pro feature stays unlocked until then.'
          : 'Your plan won’t renew. Every Pro feature stays unlocked until it ends — Google Play shows the date.',
        primaryLabel: '', primaryAction: '',
        quietLabel: 'Resubscribe', quietAction: "navigateTo('subscribe','')",
        footnote: '' };
    case 'RESTORING':
      return { key, pill: 'Checking', pillClass: 'ent-pill-violet',
        title: 'Checking your Play purchases', body: 'This only takes a moment.',
        primaryLabel: '', primaryAction: '',
        footnote: '' };
    case 'REFUNDED':
      return { key, pill: 'Refunded', pillClass: 'ent-pill-faint',
        title: 'Your subscription was refunded',
        body: 'Pro features are locked, the same as any free-plan account. Nothing else changed.',
        primaryLabel: 'Subscribe again', primaryAction: "navigateTo('subscribe','')",
        footnote: '' };
    default: // EXPIRED
      return { key: 'EXPIRED', pill: 'Subscribe', pillClass: 'ent-pill-faint',
        title: 'Pro features are locked',
        body: 'Everything you entered is safe and still counted in your tax calculation. Subscribe to unlock export, the provisional schedule and projections again.',
        primaryLabel: 'Subscribe', primaryAction: "navigateTo('subscribe','')",
        footnote: '' };
  }
}

/* B8.1 (D-16): the four-row capability block (ENT_CAPABILITIES) and its
   "Your figures are never held hostage" reassurance line are deleted —
   duplicated by the single collapsible Free-vs-Pro table lower on the
   subscribe screen (#cmp-acc, body.html), which already lists every
   capability by state (Free vs Pro) more completely than four rows keyed
   only to the current entitlement could. */
/* Banner (§ "eight states" table + per-state copy). One shared renderer for
   the subscribe screen's status area. */
function _entBannerHtml(meta) {
  const actionHtml = meta.primaryLabel
    ? `<button class="btn btn-primary btn-sm ent-banner-cta" onclick="${meta.primaryAction}">${esc(meta.primaryLabel)}</button>`
    : (meta.quietLabel ? `<button class="btn btn-ghost btn-sm ent-banner-cta" onclick="${meta.quietAction}">${esc(meta.quietLabel)}</button>` : '');
  return `<div class="ent-banner ent-banner-${meta.key.toLowerCase().replace(/_/g,'-')}">
      <div class="ent-banner-title">${esc(meta.title)}</div>
      <div class="ent-banner-body">${esc(meta.body)}</div>
      ${actionHtml}
      ${meta.primaryLabel && meta.disclosure !== false ? '<div class="ent-banner-disclosure">Billed by Google Play. Cancel any time in Play &gt; Subscriptions.</div>' : ''}
      ${meta.footnote ? `<div class="ent-banner-footnote">${esc(meta.footnote)}</div>` : ''}
    </div>`;
}
/* Header pill (main.css "header pill") — always shows one of the eight
   states. Pinned to the header's right edge (B3.2/D-4/D-23); the profile
   avatar it used to sit beside is gone (B3.1/D-6). */
export function entRefreshHeaderPill() {
  const el = $('header-billing-pill'); if (!el) return;
  const meta = _entStateMeta(getEntitlement());
  el.className = 'header-billing-pill ' + meta.pillClass;
  el.textContent = meta.pill;
  el.onclick = () => navigateTo('subscribe', '');
}

const FEATURE_DATA = {
  'income.investment': () => (APP.it3bItems || []).length,
  'income.rental':     () => (APP.rentalProperties || []).length,
  'income.business':   () => (APP.businessItems || []).length,
  'income.cgt':        () => (APP.cgtAssets || []).length,
  'income.other':      () => (APP.otherReceipts || []).length,
  'income.crypto':     () => (APP.cryptoDisposals || []).length + (APP.cryptoRevenue || []).length,
  'ded.donations':     () => (APP.donationItems || []).length,
  'ded.tools':         () => (APP.toolsWtItems || []).length
};
function _entryCount(key) {
  const f = FEATURE_DATA[key];
  try { return f ? f() : 0; } catch (e) { return 0; }
}

/* ── Locked-feature modal (#modal-locked — paywall-modal.html) ── */
export function entShowLockedModal(key) {
  const feat = ENT_FEATURES[key];
  if (!feat) return;
  const ic = $('ml-icon');
  if (ic) ic.innerHTML = `<i class="${iconClassFor(feat.icon)}"></i>`;
  const t = $('ml-title'); if (t) t.textContent = feat.label;
  const b = $('ml-blurb'); if (b) b.textContent = feat.blurb;
  const keep = $('ml-keep');
  if (keep) {
    const n = _entryCount(key);
    if (n > 0) {
      keep.style.display = '';
      $('ml-keep-text').innerHTML = `Your <b>${n} ${esc(feat.label.toLowerCase())} ${n === 1 ? 'entry is' : 'entries are'}</b> safe and still included in your tax calculation. Subscribing re-enables viewing and editing.`;
    } else {
      keep.style.display = 'none';
    }
  }
  /* §"Implementation notes": route to the state that's actually true rather
     than always showing the generic paywall — a paused/on-hold user tapping
     a locked feature needs "fix your payment", not "subscribe". */
  const e = getEntitlement();
  const cta = $('ml-cta');
  const note = $('ml-trial');
  if (e.state === 'ON_HOLD' || e.state === 'REFUNDED') {
    if (cta) cta.textContent = e.state === 'ON_HOLD' ? 'Update payment in Play' : 'Subscribe again';
    if (note) note.textContent = e.state === 'ON_HOLD'
      ? 'Your subscription is paused after a failed payment — fixing it in Play unlocks this immediately.'
      : 'Your subscription was refunded — this is a billing event, not a data event.';
  } else {
    if (cta) cta.textContent = _seePlansText();
    /* "Has ended" only where a trial actually ran. A device whose sign-in
       was declined or never tried still has its trial, reachable from Go
       Premium's Start free trial (QD-03); a build without the trial plugin
       cannot start one, so says nothing about it. */
    if (note) note.textContent = e.state !== 'BASIC' ? ''
      : entTrialVerified() ? 'Your 7-day free trial has ended'
      : entTrialOfferable() ? 'Your free trial is still available — start it from Go Premium'
      : '';
  }
  openModal('modal-locked');
}
export function entLockedSubscribe() {
  closeModal('modal-locked');
  if (getEntitlement().state === 'ON_HOLD') { entManageSubscription(); return; }
  navigateTo('subscribe', '');
}

/* ── Locked-screen overlay (locked-states.html) ──
   One shared overlay node is MOVED into the gated container (tab-section
   for tabbed modes, the mode panel for whole locked modes). The container
   gets .ent-gated, whose CSS hides its other children — original markup is
   never destroyed, so unlocking is just removing the class. */
function _overlayNode() {
  let el = $('ent-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ent-overlay';
    el.className = 'ent-overlay';
    el.setAttribute('aria-live', 'polite');
  }
  return el;
}
export function entClearGates() {
  document.querySelectorAll('.ent-gated').forEach(el => el.classList.remove('ent-gated'));
  const ov = $('ent-overlay');
  if (ov && ov.parentElement) ov.parentElement.removeChild(ov);
}

/* Derive the same composite screen key navigateTo() uses. */
export function entScreenKey(mode, tab) {
  if (!tab) return mode;
  return (MODE_PREFIX_MAP[mode] || mode) + '-' + tab;
}

/* Gate hook for navigateTo(): returns true when the target screen is
   locked (caller then skips the screen's normal render effect). The
   navigation itself is allowed — the locked state is a first-class screen
   (00-DESIGN §4.2). */
export function entGateScreen(mode, tab) {
  entClearGates();
  const key = entFeatureForScreen(entScreenKey(mode, tab));
  if (!key || entUnlocked(key)) return false;

  const prefix = MODE_PREFIX_MAP[mode] || mode;
  const section = tab ? $(`tab-${prefix}-${tab}`) : null;
  const host = section || $(`mode-${mode}`);
  if (!host) return false;

  const feat = ENT_FEATURES[key];
  const n = _entryCount(key);
  const ov = _overlayNode();
  ov.innerHTML =
    `<div class="ent-ov-icon"><i class="${iconClassFor(feat.icon)}"></i></div>` +
    `<h3><i class="material-symbols-outlined msi-lock"></i> ${esc(feat.label)} is a Premium feature</h3>` +
    `<p>${esc(feat.blurb)}</p>` +
    (n > 0 ? `<p class="ent-ov-keep">● Your ${n} ${n === 1 ? 'entry' : 'entries'} here ${n === 1 ? 'is' : 'are'} safe and still included in your tax calculation.</p>` : '') +
    `<button class="ent-ov-cta" onclick="navigateTo('subscribe','')">${esc(_seePlansText())}</button>` +
    `<button class="ent-ov-later" onclick="backAction()">Maybe later</button>`;
  host.classList.add('ent-gated');
  host.appendChild(ov);
  /* Whole-mode hosts keep their section-active bookkeeping intact; the
     overlay only affects visibility via the .ent-gated CSS rule. */
  return true;
}

/* ── Drawer lock state (locked-states.html: greyed + lock, still tappable;
   the tap navigates and lands on the overlay screen). Applies ONLY to
   items onboarding has left visible — composition rule, 01-SPEC M2.3. */
function _refreshDrawerLocks() {
  document.querySelectorAll('.drawer-item[data-screen], .drawer-subitem[data-screen]').forEach(el => {
    const key = entFeatureForScreen(el.dataset.screen || '');
    const locked = !!key && !entUnlocked(key);
    el.classList.toggle('ent-locked', locked);
    if (locked) el.setAttribute('aria-disabled', 'true');
    else el.removeAttribute('aria-disabled');
    let glyph = el.querySelector('.ent-lock-glyph');
    if (locked && !glyph) {
      glyph = document.createElement('i');
      glyph.className = 'material-symbols-outlined msi-lock ent-lock-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      el.appendChild(glyph);
    } else if (!locked && glyph) {
      glyph.remove();
    }
  });
  /* "Go Premium" drawer card copy tracks the entitlement state. */
  const sub = $('gopremium-sub');
  if (sub) {
    const e = getEntitlement();
    sub.textContent =
      e.tier === 'premium' ? 'Premium active · manage your plan'
      : e.tier === 'trial' ? `Trial — ${e.trialDaysLeft} day${e.trialDaysLeft === 1 ? '' : 's'} left · see plans`
      : 'Unlock all calculators & reports';
  }
}

/* Static tab bars (summary/projection live in body.html, unlike the rebuilt
   income/deduction bars — Provisional Tax is now one of summary's tabs,
   OD-18): decorate locked destinations in place. onclick stays switchTab —
   the switchTab gate renders the overlay, so the tap lands on the locked
   screen state. */
function _refreshStaticTabLocks() {
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    const key = entFeatureForScreen(btn.dataset.tab || '');
    if (key === null) return;               // free destination — never touched
    const locked = !entUnlocked(key);
    btn.classList.toggle('ent-locked', locked);
    if (locked) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
    let glyph = btn.querySelector('.ent-lock-glyph');
    if (locked && !glyph) {
      glyph = document.createElement('i');
      glyph.className = 'material-symbols-outlined msi-lock ent-lock-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      btn.appendChild(glyph);
    } else if (!locked && glyph) {
      glyph.remove();
    }
  });
}

/* ── entRefreshUi implementation: reapply every lock surface. Called from
   entInit(), after trial-anchor/billing syncs move the tier, and after
   purchases (M3). */
export function entRefreshUiImpl() {
  try { _refreshDrawerLocks(); } catch (e) { console.warn('ent drawer locks:', e); }
  try { _refreshStaticTabLocks(); } catch (e) { console.warn('ent tab locks:', e); }
  try { updateDrawerDeductions(); updateDrawerIncomeCalcs(); } catch (e) { /* pre-boot */ }
  try { updateDeductionTabs(); updateIncomeTabs(); } catch (e) { /* pre-boot */ }
  /* The Subscribe screen's own status card (renderSubscribePanel) previously
     only rendered on navigateTo('subscribe') mount, so a purchase completed
     while already on that screen left it showing the stale "Free (Basic)"
     note until the user left and came back. renderSubscribePanel() no-ops
     safely if #sub-status isn't in the DOM. */
  try { renderSubscribePanel(); } catch (e) { /* pre-boot */ }
  try { entRefreshHeaderPill(); } catch (e) { /* pre-boot */ }
  /* Re-gate (or un-gate) the screen the user is on right now. */
  const m = APP.currentMode, t = APP.currentTab;
  if (m) {
    try { entGateScreen(m, t); } catch (e) { console.warn('ent regate:', e); }
    try { updateFAB(m, t); } catch (e) { /* pre-boot */ }
  }
}

entRegisterUiHooks({
  onLockedTap: entShowLockedModal,
  refreshUi: entRefreshUiImpl,
  setProducts: (products) => entSetProducts(products),
  productsUnavailable: () => entProductsUnavailable(),   // BACKLOG 73
  notify: (msg, icon) => { try { showToast(msg, icon); } catch (e) { /* pre-boot */ } },
  manageSubscription: () => entManageSubscription(),   // BACKLOG 70: plan change when the current plan is unknown
  /* QR1.4/QD-04: new purchase or plan change → Dashboard + confirmation.
     Restore purchases and trial start confirm in place (their own toasts). */
  purchaseSucceeded: (kind) => {
    try {
      navigateTo('dashboard', '');
      showToast(kind === 'planChange' ? 'Plan change confirmed by Google Play'
                                      : 'Premium is active — every calculator and report is unlocked', 'check_circle');
    } catch (e) { console.warn('ent purchase landing:', e); }
  }
});

/* ── Subscribe panel (mode-subscribe — subscribe-panel.html) ── */

/* ── Plans (BACKLOG 73) ──
   Every figure on this screen comes from Google Play's live prices
   (getProducts: priceAmountMicros + currencyCode per base plan), or — only
   where Play has not answered: the browser build, and the "from …/month"
   line before the first sync — from the plan table's list prices
   (ENT_PLANS, 14-entitlement.js). No rand figure is typed here (hard rule
   5): the crossed-out price is the full-price plan's own price, the saving
   is the difference, the monthly equivalent is a twelfth of the annual.
   On a phone nothing is sold from the table: until Play sends its plans the
   list waits ("Loading…"), and a sync that ends without them offers a retry.
   A launch plan Play no longer returns is simply not shown. */
/* Display copy per base plan (QD-16), in display order. B8.1 (D-16): the
   two launch offers plus Monthly are featured; the rest sit behind "More
   plans". */
const ENT_PLAN_COPY = [
  { basePlanId: 'annual-launch-r300',     recommended: true, featured: true, name: 'Annual — launch offer',   note: 'Renews yearly · cancel anytime in Google Play' },
  { basePlanId: 'prepaid-3m-launch-r150', featured: true, name: '3 Months — launch offer', note: 'One-time payment · no auto-renewal' },
  { basePlanId: 'monthly-r75',            featured: true, name: 'Monthly',  note: 'Renews monthly · cancel anytime' },
  { basePlanId: 'annual-r495',            name: 'Annual',   note: 'renews yearly', monthlyEquivalent: true },
  { basePlanId: 'prepaid-3m-r245',        name: '3 Months', note: 'One-time payment · no auto-renewal' },
  { basePlanId: 'prepaid-1m-r95',         name: '1 Month',  note: 'One-time payment · no auto-renewal' }
];
const ENT_MONTHLY_PLAN = 'monthly-r75';
let _live = null;                 // basePlanId → { offerToken, formattedPrice, amount, currency } once Play has answered
let _productsState = 'pending';   // native only: 'pending' | 'ready' | 'unavailable'
let _selectedPlan = ENT_PLAN_COPY[0].basePlanId;

function _billingNative() {
  return !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PlayBilling);
}
/* An amount in the plan's currency: the app's own rand format for ZAR, the
   locale's currency format otherwise (a tester whose Play country is not
   South Africa sees Play's currency, never a rand figure beside it). */
function _money(amount, currency) {
  if (!Number.isFinite(amount)) return '';
  if (!currency || currency === 'ZAR') return fmt(Math.round(amount));
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency,
      minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(amount);
  } catch (e) { return currency + ' ' + amount; }
}
/* One plan's price: Play's live one when it has answered, else the table's. */
function _price(basePlanId) {
  if (_live) {
    const l = _live[basePlanId];
    return l ? { amount: l.amount, currency: l.currency, text: l.formattedPrice || _money(l.amount, l.currency) } : null;
  }
  const t = ENT_PLANS[basePlanId];
  return t ? { amount: t.priceZar, currency: 'ZAR', text: _money(t.priceZar, 'ZAR') } : null;
}
/* "from R 75/month" — the Monthly plan's price, for every "See plans" line. */
export function entFromPriceText() {
  const p = _price(ENT_MONTHLY_PLAN) || (() => { const t = ENT_PLANS[ENT_MONTHLY_PLAN]; return t && { text: _money(t.priceZar, 'ZAR') }; })();
  return p && p.text ? 'from ' + p.text + '/month' : '';
}
function _seePlansText() { const f = entFromPriceText(); return f ? 'See plans — ' + f : 'See plans'; }

/* The plan cards this screen can show right now. */
function _currentPlans() {
  if (_billingNative() && !_live) return [];   // nothing is sold from the table on a phone
  return ENT_PLAN_COPY.map(c => {
    const t = ENT_PLANS[c.basePlanId] || {};
    const price = _price(c.basePlanId);
    if (!price) return null;                     // Play no longer offers it (a closed launch plan)
    const regular = t.regular ? _price(t.regular) : null;
    const sameCurrency = regular && regular.currency === price.currency;
    const saving = sameCurrency ? regular.amount - price.amount : 0;
    let note = c.note;
    if (c.monthlyEquivalent && Number.isFinite(price.amount)) {
      note = _money(price.amount / 12, price.currency) + '/month equivalent · ' + c.note;
    }
    return {
      basePlanId: c.basePlanId,
      offerToken: _live && _live[c.basePlanId] ? _live[c.basePlanId].offerToken : null,
      autoRenewing: !t.prepaid,
      launch: !!t.launch,
      recommended: !!c.recommended,
      featured: !!c.featured,
      name: c.name,
      note,
      save: saving > 0 ? 'Save ' + _money(saving, price.currency) : '',
      was: saving > 0 ? regular.text : '',
      amt: price.text,
      per: t.prepaid ? 'once' : (t.months === 12 ? '/year' : t.months === 1 ? '/month' : '')
    };
  }).filter(Boolean);
}

/* Live getProducts() → the price map. The plugin flattens Play's
   subscriptionOfferDetails to one entry per base plan (02-BILLING §2). */
export function entSetProducts(products) {
  if (!Array.isArray(products) || !products.length) { entProductsUnavailable(); return; }
  const live = {};
  products.forEach(p => {
    if (!p || !p.basePlanId || !ENT_PLANS[p.basePlanId]) return;   // ids are load-bearing (00-DESIGN §5)
    live[p.basePlanId] = {
      offerToken: p.offerToken || null,
      formattedPrice: p.formattedPrice || '',
      amount: Number(p.priceAmountMicros) / 1e6,
      currency: p.currencyCode || ''
    };
  });
  if (!Object.keys(live).length) { entProductsUnavailable(); return; }
  _live = live;
  _productsState = 'ready';
  const plans = _currentPlans();
  if (!plans.some(p => p.basePlanId === _selectedPlan) && plans.length) _selectedPlan = plans[0].basePlanId;
  renderSubscribePanel();
}
/* A sync ended without Play's plans. Plans already shown stay. */
export function entProductsUnavailable() {
  if (_live) return;
  _productsState = 'unavailable';
  try { renderSubscribePanel(); } catch (e) { /* pre-boot */ }
}
export function entRetryProducts() {
  _productsState = 'pending';
  renderSubscribePanel();
  entRefreshProducts();
}

/* QR1/QD-01, QD-03: while the trial is unverified (no Google sign-in has
   succeeded on this device) and the tier is not premium, the Subscribe
   screen's banner offers the one retry route — "Start free trial". Scoped to
   this screen's status card only; the header pill keeps its state. */
const ENT_TRIAL_OFFER_META = {
  key: 'TRIAL_OFFER', title: 'Start your 7-day free trial',
  body: 'Sign in with Google to unlock every calculator, planner and report for 7 days. No card needed.',
  primaryLabel: 'Start free trial', primaryAction: 'entStartTrial()', disclosure: false,
  footnote: ''
};
function _statusCardHtml() {
  const meta = _entStateMeta(getEntitlement());
  return _entBannerHtml(meta.key === 'EXPIRED' && entTrialOfferable() ? ENT_TRIAL_OFFER_META : meta);
}

/* B8.1 (D-16): one plan-card renderer, shared by the featured 3-plan list
   and the "More plans" disclosure below it — same markup either way. */
function _planCardHtml(p) {
  const sel = p.basePlanId === _selectedPlan;
  /* §C: the recommended plan carries Lip v2 in violet and a "Best value"
     badge on its top edge instead of the generic launch ribbon — the two
     are mutually exclusive per card so they never compete for the same
     edge. */
  return `<div class="plan-card${p.launch ? ' launch' : ''}${p.recommended ? ' recommended' : ''}${sel ? ' selected' : ''}" role="radio" aria-checked="${sel}" tabindex="0"
    onclick="entSelectPlan('${esc(p.basePlanId)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();entSelectPlan('${esc(p.basePlanId)}')}">
    ${p.recommended ? '<span class="ribbon ribbon-best">BEST VALUE</span>' : (p.launch ? '<span class="ribbon">LAUNCH PRICE</span>' : '')}
    <span class="plan-radio"></span>
    <span class="plan-info">
      <span class="plan-name">${esc(p.name)}${p.save ? `<span class="badge-save">${esc(p.save)}</span>` : ''}</span>
      <span class="plan-note">${esc(p.note)}</span>
    </span>
    <span class="plan-price">${p.was ? `<div class="was">${esc(p.was)}</div>` : ''}<div class="amt">${esc(p.amt)}</div><div class="per">${esc(p.per)}</div></span>
  </div>`;
}

export function renderSubscribePanel() {
  const status = $('sub-status');
  if (status) status.innerHTML = _statusCardHtml();
  /* B8.1 (D-16): three plans visible — the featured flag on ENT_PLAN_COPY
     above; the rest sit behind "More plans", collapsed by default (same .acc
     idiom as #cmp-acc). A plan selected from the "more" list still shows
     correctly once collapsed — selection state lives on the card, not on
     which list it renders in. */
  const plans = _currentPlans();
  const featured = plans.filter(p => p.featured);
  const more = plans.filter(p => !p.featured);
  const wrap = $('sub-plans');
  /* BACKLOG 73: on a phone the list waits for Google Play's own plans. */
  const waiting = _billingNative() && !plans.length;
  if (wrap) wrap.innerHTML = waiting
    ? (_productsState === 'unavailable'
        ? '<p class="note sub-plans-wait" role="status">Google Play didn’t send the plans. Check your connection, then try again.</p>'
          + '<button class="btn btn-secondary" onclick="entRetryProducts()">Try again</button>'
        : '<p class="note sub-plans-wait" role="status">Loading plans from Google Play…</p>')
    : featured.map(_planCardHtml).join('');
  const moreWrap = $('sub-plans-more');
  if (moreWrap) moreWrap.innerHTML = more.map(_planCardHtml).join('');
  const moreAcc = $('more-plans-acc');
  if (moreAcc) moreAcc.hidden = !more.length;
  /* Purchase CTA: functional only where Play billing exists (native, M3).
     Browser / no-Play devices see the requirement instead of an error
     (00-DESIGN §8 "No Play services" row). */
  const cta = $('sub-cta');
  if (cta) {
    const native = _billingNative();
    /* §C: "CTA restates the price" — the button names the selected plan's
       own price rather than a generic label. BACKLOG 73: it is enabled only
       for a plan Google Play has offered (one with an offer token). */
    const plan = entSelectedPlan();
    cta.disabled = !native || !plan || !plan.offerToken;
    const priceTxt = plan ? ` — ${plan.amt}${plan.per === 'once' ? ' once' : plan.per || ''}` : '';
    cta.textContent = native ? `Subscribe with Google Play${priceTxt}` : 'Google Play required to subscribe';
  }
}
export function entSelectPlan(basePlanId) {
  _selectedPlan = basePlanId;
  renderSubscribePanel();
}
export function entSelectedPlan() {
  return _currentPlans().find(p => p.basePlanId === _selectedPlan) || null;
}
export function entToggleCompare() {
  const acc = $('cmp-acc');
  if (!acc) return;
  const open = acc.classList.toggle('open');
  const head = acc.querySelector('.acc-head');
  if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
}
/* B8.1 (D-16): same disclosure idiom as entToggleCompare(), for the three
   non-featured plans. */
export function entToggleMorePlans() {
  const acc = $('more-plans-acc');
  if (!acc) return;
  const open = acc.classList.toggle('open');
  const head = acc.querySelector('.acc-head');
  if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* Purchase / restore / manage (Stage M3 — real billing paths; graceful
   browser fallbacks per 00-DESIGN §8 "No Play services"). */
export function entSubscribe() {
  const native = _billingNative();
  if (!native) { showToast('Google Play is required to subscribe — available in the Android app', 'info'); return; }
  const plan = entSelectedPlan();
  if (!plan) return;
  if (!plan.offerToken) { showToast('Plans are still loading from Google Play — try again in a moment', 'info'); return; }
  entPurchase(plan);   // resolution via purchasesUpdated → cache → entRefreshUi
}
export function entRestorePurchases() {
  const native = _billingNative();
  if (!native) { showToast('Nothing to restore — purchases live in the Android app', 'info'); return; }
  entRestoreBilling();
}
export function entManageSubscription() {
  window.open('https://play.google.com/store/account/subscriptions?sku=premium&package=za.co.inspiredtax.app', '_blank');
}

/* ── Trial chip (dashboard — locked-states.html, 4 states) ── */
export function entChipHtml() {
  const e = getEntitlement();
  if (e.tier === 'trial') {
    const warn = e.trialDaysLeft <= 2;
    const ttl = warn
      ? (e.trialDaysLeft <= 1 ? 'Trial ends today' : 'Trial ends in ' + e.trialDaysLeft + ' days')
      : `Premium trial — ${e.trialDaysLeft} day${e.trialDaysLeft === 1 ? '' : 's'} left`;
    const from = entFromPriceText();
    const sub = warn ? (from ? 'Keep every feature ' + from : 'Keep every feature with Premium') : 'Full access · no card needed';
    return `<div class="trial-chip ${warn ? 'chip-warn' : 'chip-trial'}" role="button" tabindex="0" onclick="navigateTo('subscribe','')" onkeydown="if(event.key==='Enter'){navigateTo('subscribe','')}">
      <span><i class="${iconClassFor(warn ? 'schedule' : 'star')}"></i></span><span><span class="ttl">${ttl}</span><br><span class="sub">${sub}</span></span><span class="arr">›</span></div>`;
  }
  if (e.tier === 'premium') {
    /* BACKLOG 70: "Renews" only for a plan that renews, and a date only when
       it is the plan's own (see _entStateMeta). */
    const until = (e.dateKnown && e.expiryTimeMs) ? new Date(e.expiryTimeMs).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const renews = e.state !== 'CANCELLED_PAID_THROUGH' && e.autoRenewing !== false;
    return `<div class="trial-chip chip-prem" role="button" tabindex="0" onclick="navigateTo('subscribe','')" onkeydown="if(event.key==='Enter'){navigateTo('subscribe','')}">
      <span><i class="material-symbols-outlined msi-check-circle"></i></span><span><span class="ttl">Premium active</span><br><span class="sub">${until ? (renews ? 'Renews ' : 'Access until ') + until + ' · ' : ''}manage in Google Play</span></span><span class="arr">›</span></div>`;
  }
  return `<div class="trial-chip chip-basic" role="button" tabindex="0" onclick="navigateTo('subscribe','')" onkeydown="if(event.key==='Enter'){navigateTo('subscribe','')}">
    <span><i class="material-symbols-outlined msi-lock"></i></span><span><span class="ttl">Free plan</span><br><span class="sub">Go Premium to unlock all calculators &amp; reports</span></span><span class="arr">›</span></div>`;
}

/* ── One-time welcome dialog (locked-states.html + D-M6 hard-gate) ──
   B5.5/TRIAL-1/D-8: both branches now carry the same body copy — the brief's
   sentence, verbatim, on native AND browser/no-Play alike, against the
   recommendation (D-8 records the trade-off: the browser build states a
   7-day trial that build cannot start; accepted because the Play artifact
   is the shipped product and the browser build is dev/local-only). Only the
   CTA stays branch-specific: native runs the Google Sign-In that STARTS the
   trial, browser/no-Play gets informational copy only — these devices get
   Basic (00-DESIGN §8). Called as the last startApp step. */
export function entShowWelcomeIfNeeded() {
  if (!entNeedsWelcome()) return;
  if (getEntitlement().tier === 'premium') { entMarkWelcomed(); return; }
  const native = !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TrialAnchor);
  const body = $('wl-body'), cta = $('wl-cta'), note = $('wl-note');
  if (!body || !cta) return;
  /* S3 Batch 13 (D1): bracketed tool list dropped from the main body — the
     sub-note right below the CTA already names them (see note.textContent
     below), so the body no longer needs to. */
  /* BACKLOG 74: an offer, not a grant — nothing has started until the
     sign-in below succeeds. The length is ENT_TRIAL_DAYS. */
  const title = $('wl-title');
  if (title) title.textContent = `Your ${ENT_TRIAL_DAYS}-day free trial`;
  body.textContent = `Start a ${ENT_TRIAL_DAYS}-day free trial of every calculator, planner and report — no credit card needed. Core tools stay free.`;
  if (native) {
    cta.textContent = `Sign in with Google — start my ${ENT_TRIAL_DAYS} days`;
    if (note) note.textContent = 'Core tools: Employment income, PAYE & retirement tools';
  } else {
    cta.textContent = 'Start exploring';
    if (note) note.textContent = 'Premium features show a lock here — subscribe on Android to unlock.';
  }
  /* The character greets, at the spec's 82px "hero moment" size (§9.3). */
  const mk = $('wl-mascot');
  if (mk) mk.innerHTML = katHtml('waving', 82);
  openModal('modal-welcome');
}
export async function entWelcomeCta() {
  entMarkWelcomed();
  closeModal('modal-welcome');
  const native = !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TrialAnchor);
  if (native) await _entStartTrialInteractive('welcome');
}
/* Go Premium → "Start free trial" (QD-01/QD-03): the one retry route while
   the trial is unverified. Rendered only when entTrialOfferable(). */
export async function entStartTrial() {
  if (!entTrialOfferable()) return;
  await _entStartTrialInteractive('subscribe');
}
/* Shared by both explicit trial actions: one interactive sign-in, then a
   toast that names the reason where the native reject code distinguishes it
   (QD-03). Nothing retries on its own. */
async function _entStartTrialInteractive(from) {
  const res = await _syncTrialAnchor({ interactive: true });   // fail-closed: declined/offline simply stays Basic
  const e = getEntitlement();
  if (e.tier === 'trial') { showToast(`Trial started — ${e.trialDaysLeft} days of full access`, 'star'); return; }
  if (e.tier === 'premium') return;
  /* Sign-in and the anchor read succeeded, yet no trial: earliest-wins
     (_reconcileTrialStart) inherited a start whose window has closed — this
     Google account's trial is used up (a reinstall, typically). "Sign-in not
     completed … try again" would be false, and Start free trial is no longer
     offered once the device is verified. */
  if (res && res.ok) { showToast(_entTrialUsedText(from), 'info'); return; }
  showToast(_entTrialFailureText(res && res.code, from), _entTrialFailureIcon(res && res.code));
}
function _entTrialUsedText(from) {
  return `This Google account has no free trial left — ${from === 'welcome' ? 'subscribe from Go Premium' : 'choose a plan to subscribe'}`;
}
function _entTrialFailureText(code, from) {
  const retry = from === 'welcome' ? 'you can start your trial any time from Go Premium' : 'tap Start free trial to try again';
  if (code === 'NETWORK_ERROR') return `You're offline — connect, then ${from === 'welcome' ? 'start your trial from Go Premium' : 'tap Start free trial'}`;
  if (code === 'NO_PLAY_SERVICES') return 'Google Play services are needed to start the trial on this device';
  return `Sign-in not completed — ${retry}`;
}
function _entTrialFailureIcon(code) {
  return code === 'NETWORK_ERROR' ? 'wifi' : 'info';
}
