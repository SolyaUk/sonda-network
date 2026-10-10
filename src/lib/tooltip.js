/**
 * Shared tooltip engine (F-5). One floating element serves every [data-tip] on the site,
 * and the (i) info boxes (.tooltip-wrap > .tooltip-box) are positioned by the same code.
 *
 * Why JS instead of the old CSS ::after popups: the CSS popup lived in three copies with
 * different defaults, could not know where the viewport edge is, was clipped by any
 * overflow:hidden ancestor, and even while hidden it widened the page (horizontal
 * scrollbar). A position:fixed element measured against the anchor rect has none of
 * these problems: above by default, below when there is no room, clamped horizontally.
 *
 * Rich tooltips: an anchor with data-tip-rich may open a line of its data-tip with a tone,
 * {head}, {good}, {bad}, {warn}, {dim} or {sub}; the line is drawn in that tone. Plain
 * anchors show their text as it is, braces included.
 *
 * Touch: tap on a [data-tip] or a .tooltip-icon toggles the tooltip, tap elsewhere or a
 * scroll of more than a few pixels hides it; a tap on a control (TAP_CONTROLS) acts instead.
 * Keyboard: focus on .tooltip-icon shows the box.
 */

const MARGIN = 8;   // min distance from the viewport edge
const GAP = 6;      // distance between anchor and tooltip

let tipEl = null;
let anchor = null;          // element the plain tooltip is attached to
let boxWrap = null;         // .tooltip-wrap whose .tooltip-box is currently open
let lastScrollY = 0;

function ensureEl() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'sonda-tip';
  tipEl.setAttribute('role', 'tooltip');
  document.body.appendChild(tipEl);
  return tipEl;
}

// Place `el` (position: fixed) relative to `target` inside the viewport.
function place(el, target) {
  const r = target.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let top = r.top - h - GAP;
  let below = false;
  if (top < MARGIN) { top = r.bottom + GAP; below = true; }
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - w - MARGIN));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  el.classList.toggle('is-below', below);
}

// Fit the box to its wrapped text: a max-width box keeps its full width after the text
// wraps, leaving dead space right of the shorter lines. Measure the widest line fragment
// and shrink the box to it.
function fitWidth(el) {
  el.style.width = 'max-content';
  const maxW = parseFloat(getComputedStyle(el).maxWidth) || 280;
  if (el.offsetWidth <= maxW) return;
  el.style.width = `${maxW}px`;
  // One rect per line box of the text; the widest one is the natural width of the
  // wrapped text. Shrinking to it cannot change the wrapping (every line still fits).
  const range = document.createRange();
  range.selectNodeContents(el);
  let widest = 0;
  for (const r of range.getClientRects()) widest = Math.max(widest, r.width);
  const cs = getComputedStyle(el);
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
  if (widest > 0) el.style.width = `${Math.min(maxW, Math.ceil(widest + pad + 1))}px`;
}

// Text for an anchor: data-tip, or the element's own text when it is marked
// data-tip-ellipsis and is actually cut off (truncated labels).
function tipText(target) {
  const text = target.getAttribute('data-tip');
  if (text) return text;
  if (target.hasAttribute('data-tip-ellipsis') && target.scrollWidth > target.clientWidth + 1) return target.textContent.trim();
  return '';
}

// Lines of a rich tooltip. Every line becomes a text node (inside a span when it has a
// tone), never parsed as HTML: whatever a tooltip holds, it stays text.
const TONE_RE = /^\{(head|good|bad|warn|dim|sub)\}/;
function fillTip(el, text, rich) {
  if (!rich) { el.textContent = text; return; }
  el.textContent = '';
  text.split('\n').forEach((line, i) => {
    if (i) el.appendChild(document.createTextNode('\n'));
    const m = TONE_RE.exec(line);
    if (!m) { el.appendChild(document.createTextNode(line)); return; }
    const span = document.createElement('span');
    span.className = `tip-${m[1]}`;
    span.textContent = line.slice(m[0].length);
    el.appendChild(span);
  });
}

function showTip(target) {
  const text = tipText(target);
  if (!text) return;
  const el = ensureEl();
  fillTip(el, text, target.hasAttribute('data-tip-rich') && target.hasAttribute('data-tip'));
  anchor = target;
  el.classList.add('is-visible');
  fitWidth(el);
  place(el, target);
}

function hideTip() {
  if (!tipEl) return;
  tipEl.classList.remove('is-visible');
  anchor = null;
}

function showBox(wrap) {
  const box = wrap.querySelector('.tooltip-box');
  const icon = wrap.querySelector('.tooltip-icon') || wrap;
  if (!box) return;
  if (boxWrap && boxWrap !== wrap) hideBox();
  boxWrap = wrap;
  box.classList.add('is-open');
  place(box, icon);
}

function hideBox() {
  if (!boxWrap) return;
  const box = boxWrap.querySelector('.tooltip-box');
  if (box) box.classList.remove('is-open');
  boxWrap = null;
}

function isTouch() {
  return window.matchMedia && window.matchMedia('(hover: none)').matches;
}

// Elements whose tap does something: links, buttons, filter rows (data-fkey), copy buttons,
// sortable table headers, form fields. Whole table rows and validator cards are not listed
// on purpose: a tap on a badge inside them still opens the badge's tooltip.
const TAP_CONTROLS = 'a[href], button, [role="button"], [data-fkey], [data-more], [data-copy], th.th-sort, summary, label, input, select, textarea';

export function initTooltips() {
  if (typeof document === 'undefined' || document.body.dataset.sondaTooltips) return;
  document.body.dataset.sondaTooltips = '1';

  // Hover (mouse): delegated so tooltips inside innerHTML-rendered content work too.
  document.addEventListener('mouseover', (e) => {
    if (isTouch()) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const wrap = t.closest('.tooltip-wrap');
    if (wrap) { if (boxWrap !== wrap) showBox(wrap); return; }
    const el = t.closest('[data-tip], [data-tip-ellipsis]');
    if (el && el !== anchor) showTip(el);
  });
  document.addEventListener('mouseout', (e) => {
    if (isTouch()) return;
    const t = e.target instanceof Element ? e.target : null;
    const rel = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    if (!t) return;
    if (boxWrap && t.closest('.tooltip-wrap') === boxWrap && (!rel || !boxWrap.contains(rel))) hideBox();
    if (anchor && t.closest('[data-tip], [data-tip-ellipsis]') === anchor && (!rel || !anchor.contains(rel))) hideTip();
  });

  // Keyboard focus on the (i) icons. A tap focuses the icon as well, right before its click:
  // the time of the opening is kept so that click does not close what the focus just opened
  // (on phones the first tap on an icon used to open and close the box in one go).
  let boxOpenedByFocusAt = 0;
  document.addEventListener('focusin', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const wrap = t && t.closest('.tooltip-wrap');
    if (wrap) { showBox(wrap); boxOpenedByFocusAt = Date.now(); }
  });
  document.addEventListener('focusout', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (t && boxWrap && t.closest('.tooltip-wrap') === boxWrap) hideBox();
  });

  // Touch: tap toggles, tap elsewhere closes.
  document.addEventListener('click', (e) => {
    if (!isTouch()) return;
    const t = e.target instanceof Element ? e.target : null;
    const wrap = t && t.closest('.tooltip-wrap');
    if (wrap) {
      e.preventDefault();
      e.stopPropagation();
      const justOpened = boxWrap === wrap && Date.now() - boxOpenedByFocusAt < 700;
      if (boxWrap === wrap && !justOpened) hideBox(); else showBox(wrap);
      hideTip();
      return;
    }
    const el = t && t.closest('[data-tip], [data-tip-ellipsis]');
    // A tap on a control is an action and goes through: the tooltip used to swallow it, so
    // on phones the arrow of a validator card, filter rows with a tooltip, sortable headers
    // and linked rows did nothing but show their hint. The same for an anchor with nothing
    // to show (a name that is not cut off). Plain text and badges keep tap = tooltip.
    if (el && !t.closest(TAP_CONTROLS) && tipText(el)) {
      e.preventDefault();
      e.stopPropagation();
      hideBox();
      if (anchor === el) hideTip(); else showTip(el);
      return;
    }
    hideTip();
    hideBox();
  }, true);

  // Scroll: keep the plain tooltip glued to its anchor; dismiss the (i) box after a real scroll.
  lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (anchor && tipEl) place(tipEl, anchor);
    const dy = Math.abs(window.scrollY - lastScrollY);
    lastScrollY = window.scrollY;
    if (dy > 6 && boxWrap) hideBox();
    if (dy > 6 && isTouch()) hideTip();
  }, { passive: true });
  window.addEventListener('resize', () => { hideTip(); hideBox(); });

  // Elements removed from the DOM (re-render) must not leave a stale tooltip behind.
  const obs = new MutationObserver(() => {
    if (anchor && !document.contains(anchor)) hideTip();
    if (boxWrap && !document.contains(boxWrap)) hideBox();
  });
  obs.observe(document.body, { childList: true, subtree: true });
}
