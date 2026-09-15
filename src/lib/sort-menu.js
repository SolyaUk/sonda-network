/**
 * Sort menu for validator tables: one trigger button ("Sort: TVC rank, best first") and a
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
};

// dirs: [defaultDir, label(default), label(flipped)]
export const SORT_GROUPS = [
  { id: 'performance', label: 'Performance', items: [
    { key: 'rank', label: 'TVC rank', dir: 'asc', labels: { asc: 'best first', desc: 'worst first' } },
    { key: 'credits', label: 'Credits', dir: 'desc', labels: { desc: 'high to low', asc: 'low to high' } },
    { key: 'skip', label: 'Skip rate', dir: 'asc', labels: { asc: 'low to high', desc: 'high to low' }, needs: 'skip' },
    { key: 'slot', label: 'Slot time', dir: 'asc', labels: { asc: 'fast to slow', desc: 'slow to fast' }, needs: 'slot' },
    { key: 'vlat', label: 'Vote latency', dir: 'asc', labels: { asc: 'low to high', desc: 'high to low' }, needs: 'vlat' },
    { key: 'ibrl', label: 'IBRL', dir: 'desc', labels: { desc: 'high to low', asc: 'low to high' }, needs: 'ibrl' },
  ] },
  { id: 'stake', label: 'Stake', items: [
    { key: 'stake', label: 'Stake', dir: 'desc', labels: { desc: 'high to low', asc: 'low to high' } },
    { key: 'commission', label: 'Commission', dir: 'asc', labels: { asc: 'low to high', desc: 'high to low' } },
  ] },
  { id: 'validator', label: 'Validator', items: [
    { key: 'name', label: 'Name', dir: 'asc', labels: { asc: 'A to Z', desc: 'Z to A' } },
    { key: 'client', label: 'Client', dir: 'asc', labels: { asc: 'A to Z', desc: 'Z to A' } },
    { key: 'version', label: 'Version', dir: 'desc', labels: { desc: 'newest first', asc: 'oldest first' } },
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

function findItem(key) {
  for (const g of SORT_GROUPS) for (const it of g.items) if (it.key === key) return { group: g, item: it };
  return null;
}

/** Which optional metrics exist anywhere in the cluster. */
export function sortAvailability(records) {
  const rs = records || [];
  return {
    skip: rs.some(r => r.skip_rate != null),
    slot: rs.some(r => r.slot_duration_median != null),
    vlat: rs.some(r => r.median_vote_latency != null),
    ibrl: rs.some(r => r.ibrl?.ibrl_score != null),
    sfdp: rs.some(r => r.sfdp_state),
    connections: rs.some(r => r.dz_connected || r.bam_node || r.dz_multicast_publisher || r.rakurai),
  };
}

export function sortLabel(key, dir) {
  const f = findItem(key);
  if (!f) return `${key} (${dir})`;
  return `${f.item.label}, ${f.item.labels[dir] || dir}`;
}

/**
 * Mount the menu into `host`. `select` is the hidden native select that holds the state.
 */
export function initSortMenu(host, select, { avail = {} } = {}) {
  let availability = avail;
  host.classList.add('sort-menu');
  host.innerHTML = `
    <button type="button" class="sort-trigger" aria-haspopup="listbox" aria-expanded="false">
      <span class="sort-trigger-k">Sort</span><span class="sort-trigger-v"></span><span class="sort-caret" aria-hidden="true">&#9662;</span>
    </button>
    <div class="sort-panel" role="listbox" hidden></div>`;
  const trigger = host.querySelector('.sort-trigger');
  const valueEl = host.querySelector('.sort-trigger-v');
  const panel = host.querySelector('.sort-panel');

  const current = () => {
    const [key, dir] = (select.value || 'rank-asc').split('-');
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
    valueEl.textContent = sortLabel(cur.key, cur.dir);
    panel.innerHTML = SORT_GROUPS.map(g => {
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
  document.addEventListener('click', (e) => { if (!host.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  select.addEventListener('change', render);

  render();
  return {
    update(nextAvail) {
      availability = nextAvail || {};
      // fall back if the current key is no longer available on this cluster
      const cur = current();
      const f = findItem(cur.key);
      if (f && f.item.needs && !availability[f.item.needs]) setSort('rank', 'asc'); else render();
    },
    set: setSort,
    current,
  };
}
