import { $, gs } from './02-core.js';

/* ============================================================
   Date-of-birth Year/Month selector
   Owner brief 2026-09-14 — replaces the two <input type=date> fields
   (Create Profile's cr-dob, the Profile modal's modal-dob) with a pair of
   native <select> elements. Native <select> gives Android's own wheel
   picker for free, so this stays a plain select pair rather than a custom
   scroll-wheel widget re-implementing something the platform already ships.

   The hidden input keeps the original id and the YYYY-MM-DD format, so
   PII_MIRROR, doCreateAccount(), calcAgeAtYearEnd() and 11-historical.js
   are all untouched — only this input's DOM type changed, from a native
   date picker to a value two selects happen to write.

   D1 (owner decision, 2026-09-14): the day is always stored as "01". A
   genuine 29-February birth date will be treated by calcAgeAtYearEnd() as
   having already had its birthday by the 1st of that month at tax
   year-end — an accepted approximation, not a bug to chase.
   ============================================================ */

const DOB_MIN_AGE = 18;
const DOB_MAX_AGE_SPAN = 100;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function _populateMonthSelect(sel) {
  sel.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = ''; blank.textContent = 'Month';
  sel.appendChild(blank);
  MONTH_NAMES.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = String(i + 1).padStart(2, '0');
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function _populateYearSelect(sel) {
  sel.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = ''; blank.textContent = 'Year';
  sel.appendChild(blank);
  // Computed at render from the current date, never hardcoded (plan §6).
  const maxYear = new Date().getFullYear() - DOB_MIN_AGE;
  const minYear = maxYear - DOB_MAX_AGE_SPAN;
  for (let y = maxYear; y >= minYear; y--) {
    const opt = document.createElement('option');
    opt.value = String(y); opt.textContent = String(y);
    sel.appendChild(opt);
  }
}

/* Boot-time mount: populate every dob-select-row's Month/Year options once,
   then sync each pair from whatever the hidden input already holds (a saved
   profile's dob, restored before this runs). Idempotent, like the other
   bootstrap mounts it sits beside. */
export function mountDobSelectors() {
  document.querySelectorAll('.dob-select-row').forEach(row => {
    const monthSel = row.querySelector('select[id$="-dob-month"]');
    const yearSel = row.querySelector('select[id$="-dob-year"]');
    if (!monthSel || !yearSel || monthSel.dataset.dobMounted) return;
    monthSel.dataset.dobMounted = '1';
    _populateMonthSelect(monthSel);
    _populateYearSelect(yearSel);
    const prefix = monthSel.id.replace(/-dob-month$/, '');
    syncDobSelectFromHidden(prefix);
  });
}

/* Re-reads the hidden input (id = prefix + '-dob') and reflects it onto the
   visible Month/Year selects. Needed whenever the hidden value is set
   programmatically — sv('modal-dob', pii.dob) on profile load — since sv()
   only assigns .value and fires no event the selects could react to. */
export function syncDobSelectFromHidden(prefix) {
  const hidden = $(prefix + '-dob');
  const monthSel = $(prefix + '-dob-month');
  const yearSel = $(prefix + '-dob-year');
  if (!hidden || !monthSel || !yearSel) return;
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(hidden.value || '');
  monthSel.value = m ? m[2] : '';
  yearSel.value = m ? m[1] : '';
}

/* Wired to both selects' onchange. Recomputes the hidden field from the
   pair and dispatches a real 'change' event on it, so any existing
   onchange handler on the hidden input (modal-dob's onProfileDobChange())
   still fires exactly as it did when the field itself was a date input. */
export function onDobSelectChange(prefix) {
  const hidden = $(prefix + '-dob');
  const month = gs(prefix + '-dob-month');
  const year = gs(prefix + '-dob-year');
  if (!hidden) return;
  hidden.value = (month && year) ? (year + '-' + month + '-01') : '';
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
}
