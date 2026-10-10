/**
 * Sort menu for validator tables: one trigger button ("Sort: IBRL, high to low") and a
 * grouped dropdown. Each sort key appears once; the item's default direction is used on
 * first pick and a click on the active item flips it. Keys that no validator in the
 * cluster has (slot time on alpenglow, SFDP on devnet) are not shown at all.
 *
 * State lives in a native <select id="sort-select"> (hidden) so the rest of the page and
 * the URL param keep working; the menu writes "<key>-<dir>" there and fires "change".
 */

const ICONS = {
  performance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
  stake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 19V13"/><path d="M10 19V9"/><path d="M15 19V5"/><path d="M20 19v-3"/></svg>',
  validator: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  status: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></svg>',
  pools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
};

// dirs: [defaultDir, label(default), label(flipped)]
export const SORT_GROUPS = [
  { id: 'performance', label: 'Performance', items: [
    { key: 'ibrl', label: 'IBRL', dir: 'desc', labels: { desc: 'high to low', asc: 'low to high' }, needs: 'ibrl' },
    { key: 'skip', label: 'Skip rate', dir: 'asc', labels: { asc: 'low to high', desc: 'high to low' }, needs: 'skip' },
    { key: 'slot', label: 'Slot time', dir: 'asc', labels: { asc: 'fast to slow', desc: 'slow to fast' }, needs: 'slot' },
    { key: 'votes', label: 'Vote performance', dir: 'desc', labels: { desc: 'best first', asc: 'worst first' }, needs: 'votes' },
    { key: 'vlat', label: 'Vote latency', dir: 'asc', labels: { asc: 'low to high', desc: 'high to low' }, needs: 'vlat' },
    { key: 'credits', label: 'Credits', dir: 'desc', labels: { desc: 'high to low', asc: 'low to high' } },
  ] },
  { id: 'stake', label: 'Stake', items: [
    { key: 'stake', label: 'Stake', dir: 'desc', labels: { desc: 'high to low', asc: 'low to high' } },
    { key: 'commission', label: 'Commission', dir: 'asc', labels: { asc: 'low to high', desc: 'high to low' } },
  ] },
  // rank in a stake pool, 1 = best (keys are the pool ids of src/lib/pools.js); mainnet only
  { id: 'pools', label: 'Stake pools', items: [
    { key: 'jito', label: 'Jito rank', dir: 'asc', labels: { asc: 'best first', desc: 'worst first' }, needs: 'pool_jito' },
    { key: 'xshin', label: 'xSHIN rank', dir: 'asc', labels: { asc: 'best first', desc: 'worst first' }, needs: 'pool_xshin' },
    { key: 'solstrategies', label: 'SOL Strategies rank', dir: 'asc', labels: { asc: 'best first', desc: 'worst first' }, needs: 'pool_solstrategies' },
    { key: 'jpool', label: 'JPool rank', dir: 'asc', labels: { asc: 'best first', desc: 'worst first' }, needs: 'pool_jpool' },
  ] },
  { id: 'validator', label: 'Validator', items: [
    { key: 'name', label: 'Name', dir: 'asc', labels: { asc: 'A to Z', desc: 'Z to A' } },
    { key: 'client', label: 'Client', dir: 'asc', labels: { asc: 'A to Z', desc: 'Z to A' } },
    { key: 'version', label: 'Version', dir: 'desc', labels: { desc: 'newest first', asc: 'oldest first' } },
    { key: 'age', label: 'Age', dir: 'desc', labels: { desc: 'oldest first', asc: 'newest first' }, needs: 'age' },
  ] },
  { id: 'location', label: 'Location', items: [
    { key: 'country', label: 'Country', dir: 'asc', labels: { asc: 'A to Z', desc: 'Z to A' } },
    { key: 'city', label: 'City', dir: 'asc', labels: { asc: 'A to Z', desc: 'Z to A' } },
  ] },
  { id: 'status', label: 'Status', items: [
    { key: 'delinquent', label: 'Delinquent', dir: 'desc', labels: { desc: 'delinquent first', asc: 'healthy first' } },
    { key: 'sfdp', label: 'SFDP', dir: 'asc', labels: { asc: 'approved first', desc: 'others first' }, needs: 'sfdp' },
  ] },
];

function findItem(key, groups = SORT_GROUPS) {
  for (const g of groups) for (const it of g.items) if (it.key === key) return { group: g, item: it };
  return null;
}

/** Sort groups for the providers (datacenters) list. */
export const PROVIDER_SORT_GROUPS = [
  { id: 'stake', label: 'Stake', items: [
    { key: 'stake', label: 'Stake', dir: 'desc', labels: { desc: 'high to low', asc: 'low to high' } },
  ] },
  { id: 'validator', label: 'Validators', items: [
    { key: 'validators', label: 'Validators', dir: 'desc', labels: { desc: 'most first', asc: 'fewest first' } },
    { key: 'delinquent', label: 'Delinquent', dir: 'desc', labels: { desc: 'most first', asc: 'fewest first' } },
  ] },
  { id: 'location', label: 'Provider', items: [
    { key: 'name', label: 'Name', dir: 'asc', labels: { asc: 'A to Z', desc: 'Z to A' } },
    { key: 'asns', label: 'Networks (ASNs)', dir: 'desc', labels: { desc: 'most first', asc: 'fewest first' } },
    { key: 'countries', label: 'Countries', dir: 'desc', labels: { desc: 'most first', asc: 'fewest first' } },
    { key: 'cities', label: 'Cities', dir: 'desc', labels: { desc: 'most first', asc: 'fewest first' } },
    // StakeWiz location penalty, median of the provider's validators (mainnet); 0 is the best
    { key: 'penalty', label: 'Location penalty', dir: 'desc', labels: { desc: 'smallest first', asc: 'largest first' }, needs: 'penalty' },
  ] },
  { id: 'status', label: 'Infrastructure', items: [
    { key: 'dz', label: 'DoubleZero', dir: 'desc', labels: { desc: 'most connected first', asc: 'fewest first' }, needs: 'connections' },
    { key: 'bam', label: 'Jito BAM', dir: 'desc', labels: { desc: 'most connected first', asc: 'fewest first' }, needs: 'connections' },
    { key: 'sfdp', label: 'SFDP approved', dir: 'desc', labels: { desc: 'most first', asc: 'fewest first' }, needs: 'sfdp' },
    { key: 'net', label: 'Network infrastructure', dir: 'desc', labels: { desc: 'most hosted first', asc: 'fewest first' }, needs: 'net' },
  ] },
  { id: 'performance', label: 'Performance', items: [
    { key: 'ibrl', label: 'Median IBRL', dir: 'desc', labels: { desc: 'high to low', asc: 'low to high' }, needs: 'ibrl' },
    { key: 'skip', label: 'Average skip', dir: 'asc', labels: { asc: 'low to high', desc: 'high to low' }, needs: 'skip' },
    { key: 'slot', label: 'Median slot time', dir: 'asc', labels: { asc: 'fast to slow', desc: 'slow to fast' }, needs: 'slot' },
    { key: 'votes', label: 'Vote performance', dir: 'desc', labels: { desc: 'best first', asc: 'worst first' }, needs: 'votes' },
    { key: 'vlat', label: 'Vote latency', dir: 'asc', labels: { asc: 'low to high', desc: 'high to low' }, needs: 'vlat' },
  ] },
];

/** True for a "<key>-<asc|desc>" value whose key exists in the groups (URL values are untrusted and may be legacy). */
export function isKnownSort(value, groups = SORT_GROUPS) {
  const m = /^([a-z]+)-(asc|desc)$/.exec(String(value || ''));
  return !!m && !!findItem(m[1], groups);
}

export function sortLabel(key, dir, groups = SORT_GROUPS) {
  const f = findItem(key, groups);
  if (!f) return `${key} (${dir})`;
  return `${f.item.label}, ${f.item.labels[dir] || dir}`;
}

/**
 * Mount the menu into `host`. `select` is the hidden native select that holds the state.
 */
export function initSortMenu(host, select, { avail = {}, groups = SORT_GROUPS, defaultValue = 'stake-desc' } = {}) {
  let availability = avail;
  let fallback = defaultValue;
  host.classList.add('sort-menu');
  host.innerHTML = `
    <button type="button" class="sort-trigger" aria-haspopup="listbox" aria-expanded="false">
      <span class="sort-trigger-k">Sort</span><span class="sort-trigger-v"></span><span class="sort-caret" aria-hidden="true">&#9662;</span>
    </button>
    <button type="button" class="sort-dir" data-tip="Flip sort direction" aria-label="Flip sort direction"></button>
    <div class="sort-panel" role="listbox" hidden></div>`;
  const trigger = host.querySelector('.sort-trigger');
  const dirBtn = host.querySelector('.sort-dir');
  const valueEl = host.querySelector('.sort-trigger-v');
  const panel = host.querySelector('.sort-panel');

  const current = () => {
    const [key, dir] = (select.value || fallback).split('-');
    return { key, dir };
  };
  const ensureOption = (value) => {
    if (![...select.options].some(o => o.value === value)) {
      const opt = document.createElement('option');
      opt.value = value; opt.textContent = value;
      select.appendChild(opt);
    }
  };
  const setSort = (key, dir) => {
    const value = `${key}-${dir}`;
    ensureOption(value);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    render();
  };

  function render() {
    const cur = current();
    valueEl.textContent = sortLabel(cur.key, cur.dir, groups);
    dirBtn.innerHTML = cur.dir === 'asc' ? '&#8593;' : '&#8595;';
    panel.innerHTML = groups.map(g => {
      const items = g.items.filter(it => !it.needs || availability[it.needs]);
      if (items.length === 0) return '';
      return `<div class="sort-group"><div class="sort-group-h"><span class="sort-ico">${ICONS[g.id] || ''}</span>${g.label}</div>${items.map(it => {
        const active = it.key === cur.key;
        const dir = active ? cur.dir : it.dir;
        return `<button type="button" class="sort-item${active ? ' is-active' : ''}" role="option" aria-selected="${active}" data-key="${it.key}" data-dir="${dir}">
          <span class="sort-item-l">${it.label}</span>
          <span class="sort-item-d">${it.labels[dir] || dir}</span>
          <span class="sort-item-arrow" aria-hidden="true">${active ? (dir === 'asc' ? '&#8593;' : '&#8595;') : ''}</span>
        </button>`;
      }).join('')}</div>`;
    }).join('');
  }

  // Keep the panel inside the viewport: anchored to the trigger's right edge by default,
  // flipped to its left edge when that would overflow. On phones vtable.css turns the panel
  // into a bottom sheet (position: fixed), where no clamping is needed.
  const clamp = () => {
    panel.style.left = ''; panel.style.right = '';
    if (window.getComputedStyle(panel).position === 'fixed') return;
    const r = panel.getBoundingClientRect();
    if (r.left < 8) { panel.style.right = 'auto'; panel.style.left = '0'; }
    const r2 = panel.getBoundingClientRect();
    if (r2.right > window.innerWidth - 8) { panel.style.left = 'auto'; panel.style.right = '0'; }
  };
  const open = () => { panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); host.classList.add('is-open'); clamp(); };
  const close = () => { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); host.classList.remove('is-open'); };
  trigger.addEventListener('click', () => (panel.hidden ? open() : close()));
  dirBtn.addEventListener('click', () => { const cur = current(); setSort(cur.key, cur.dir === 'asc' ? 'desc' : 'asc'); });
  panel.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.sort-item') : null;
    if (!btn) return;
    const cur = current();
    const key = btn.dataset.key;
    // click on the active key flips its direction; another key starts with its default
    const dir = key === cur.key ? (cur.dir === 'asc' ? 'desc' : 'asc') : btn.dataset.dir;
    setSort(key, dir);
    close();
  });
  // Any click/tap outside the trigger and the panel closes it (the backdrop pseudo-element
  // belongs to the host, so "outside" is measured against the two real elements).
  document.addEventListener('click', (e) => {
    const t = e.target instanceof Node ? e.target : null;
    if (panel.hidden || !t) return;
    if (trigger.contains(t) || panel.contains(t)) return;
    close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  select.addEventListener('change', render);

  render();
  return {
    /**
     * New availability (data arrived, cluster switched). `next.defaultValue` replaces the
     * fallback sort and `next.value` sets the current one; both are applied silently, without
     * a "change" event, so a cluster default is never written to the URL as a user choice.
     * A current key that is unknown or has no data in this cluster falls back to the default;
     * the return value tells the page (`fellBack`) so it can drop its own stored choice.
     */
    update(nextAvail, next = {}) {
      availability = nextAvail || {};
      if (next.defaultValue) fallback = next.defaultValue;
      const setSilent = (value) => { ensureOption(value); select.value = value; };
      if (next.value) setSilent(next.value);
      const cur = current();
      const f = findItem(cur.key, groups);
      const fellBack = !f || !!(f.item.needs && !availability[f.item.needs]);
      if (fellBack) setSilent(fallback);
      render();
      return { fellBack, value: select.value };
    },
    set: setSort,
    current,
  };
}
