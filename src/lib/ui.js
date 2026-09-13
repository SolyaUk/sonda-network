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
export function copyButtonHtml(value, tip = 'Copy') {
  const v = String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<button type="button" class="copy-btn" data-copy="${v}" data-tip="${tip.replace(/"/g, '&quot;')}" aria-label="${tip.replace(/"/g, '&quot;')}">${COPY_ICON}</button>`;
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
    const ok = await copyText(value);
    showToast(ok ? `Copied ${value.length > 24 ? value.slice(0, 10) + '...' + value.slice(-6) : value}` : 'Copy failed');
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
