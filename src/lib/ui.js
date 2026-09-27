/**
 * Small shared UI behaviours, initialised once per page from BaseLayout:
 *  - sticky offset: writes --sticky-offset (bottom of the sticky Header / StatusStrip /
 *    ClusterBanner stack) so table headers can stick right under it (F-11);
 *  - copy buttons: any element with data-copy copies that value to the clipboard and
 *    shows a toast; the click never reaches row/card click handlers (F-9);
 *  - collapsible sections: [data-collapsible] sections with a .section-header toggle
 *    their body on a click at the title, remembered per section id (F-36).
 */

const COPY_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

/** HTML for a copy button. value = what gets copied, tip = tooltip text. */
export function copyButtonHtml(value, tip = 'Copy', label = '') {
  const v = String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const t = tip.replace(/"/g, '&quot;');
  const l = label ? ` data-copy-label="${label.replace(/"/g, '&quot;')}"` : '';
  return `<button type="button" class="copy-btn" data-copy="${v}"${l} data-tip="${t}" aria-label="${t}">${COPY_ICON}</button>`;
}

let toastEl = null;
let toastTimer = null;
export function showToast(text) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'sonda-toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1400);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function initCopyButtons() {
  // Capture phase: the copy click must not bubble into row links or card toggles.
  document.addEventListener('click', async (e) => {
    const t = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    const value = t.getAttribute('data-copy') || '';
    const label = t.getAttribute('data-copy-label');
    const ok = await copyText(value);
    // The toast says what was copied: a label when the value is not self-explanatory
    // (a link to a datacenter page), otherwise the value itself, shortened.
    showToast(ok ? `Copied ${label || (value.length > 24 ? value.slice(0, 10) + '...' + value.slice(-6) : value)}` : 'Copy failed');
    t.classList.add('is-done');
    setTimeout(() => t.classList.remove('is-done'), 900);
  }, true);
}

/** Bottom edge of the sticky stack (header, status strip, cluster banner), in px. */
function stickyBottom() {
  let bottom = 0;
  document.querySelectorAll('header, .status-strip, #status-strip, .cluster-banner, #cluster-banner').forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    const cs = getComputedStyle(el);
    if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    // Only elements currently pinned at the top count (their top is at or above their sticky top)
    bottom = Math.max(bottom, r.bottom);
  });
  return Math.round(bottom);
}

export function initStickyOffset() {
  let ticking = false;
  const update = () => {
    ticking = false;
    document.documentElement.style.setProperty('--sticky-offset', `${stickyBottom()}px`);
  };
  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  // The cluster banner appears/disappears and the strip shrinks; observe attribute changes.
  const obs = new MutationObserver(schedule);
  document.querySelectorAll('header, .status-strip, #status-strip, .cluster-banner, #cluster-banner').forEach(el => obs.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'data-state', 'hidden'] }));
  window.addEventListener('sonda:cluster-change', () => setTimeout(update, 50));
}

export function initCollapsibleSections() {
  document.querySelectorAll('[data-collapsible]').forEach(section => {
    if (!(section instanceof HTMLElement)) return;
    const title = section.querySelector('.section-header .section-title');
    if (!title) return;
    const key = `sonda-collapse-${section.dataset.collapsible}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'section-collapse';
    btn.setAttribute('aria-label', 'Collapse section');
    btn.innerHTML = CHEVRON;
    title.appendChild(btn);
    title.classList.add('is-collapsible');
    const apply = (open) => {
      section.classList.toggle('is-collapsed', !open);
      btn.setAttribute('aria-expanded', String(open));
    };
    apply(localStorage.getItem(key) !== '0');
    title.addEventListener('click', () => {
      const open = section.classList.contains('is-collapsed');
      apply(open);
      localStorage.setItem(key, open ? '1' : '0');
    });
  });
}

/**
 * Include / exclude filters (F-NOT, 2026-09-25). A list param holds both kinds of values:
 * "client=Jito,!Agave" means include Jito, exclude Agave. Includes combine with OR,
 * excludes always remove. Single-value params accept "!value" as "everything but".
 */
export function splitFilterValues(values) {
  const inc = [], exc = [];
  for (const v of values || []) {
    if (!v) continue;
    if (v.startsWith('!')) exc.push(v.slice(1)); else inc.push(v);
  }
  return { inc, exc };
}

/** Apply an include/exclude list to an array with an accessor (record -> value). */
export function applyListFilter(list, values, accessor, opts = {}) {
  const { inc, exc } = splitFilterValues(values);
  let out = list;
  if (inc.length) out = out.filter(r => { const v = accessor(r); return Array.isArray(v) ? v.some(x => inc.includes(x)) : inc.includes(v); });
  if (exc.length) out = out.filter(r => { const v = accessor(r); return Array.isArray(v) ? !v.some(x => exc.includes(x)) : !exc.includes(v); });
  return out;
}

/** State of one value inside a list param: 'include' | 'exclude' | null. */
export function listValueState(values, value) {
  if ((values || []).includes(value)) return 'include';
  if ((values || []).includes(`!${value}`)) return 'exclude';
  return null;
}

/**
 * Next list after a click on `value` in `mode` ('include' by default, 'exclude' from the
 * "not" button or a long press): clicking the active state clears it, otherwise the
 * value takes the clicked state (and leaves the opposite one).
 */
export function nextListValues(values, value, mode = 'include') {
  const cur = listValueState(values, value);
  const rest = (values || []).filter(v => v !== value && v !== `!${value}`);
  if (cur === mode) return rest;
  return rest.concat(mode === 'exclude' ? `!${value}` : value);
}

/** Long press on touch devices = exclude. Calls cb(target) after 550ms without movement. */
export function initLongPress(root, selector, cb) {
  let timer = null, startX = 0, startY = 0, fired = false;
  root.addEventListener('touchstart', (e) => {
    const t = e.target instanceof Element ? e.target.closest(selector) : null;
    if (!t) return;
    fired = false;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    timer = setTimeout(() => { fired = true; cb(t); }, 550);
  }, { passive: true });
  const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  root.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].clientX - startX) > 8 || Math.abs(e.touches[0].clientY - startY) > 8) cancel(); }, { passive: true });
  root.addEventListener('touchend', cancel);
  root.addEventListener('touchcancel', cancel);
  // a click right after a fired long press must not toggle include as well
  root.addEventListener('click', (e) => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
}

export const NOT_BUTTON = '<button type="button" class="vagg-not" data-tip="Exclude" aria-label="Exclude"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M5.5 5.5l9 9"/></svg></button>';

/** Clear buttons for search inputs: shown when the field has text, clearing fires "input". */
export function initSearchClear() {
  document.querySelectorAll('.search-clear[data-for]').forEach(btn => {
    const input = document.getElementById(btn.dataset.for);
    if (!input) return;
    const sync = () => { btn.hidden = !input.value; };
    input.addEventListener('input', sync);
    btn.addEventListener('click', () => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); });
    sync();
  });
}
