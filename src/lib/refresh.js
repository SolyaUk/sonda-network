/**
 * Auto-refresh for data pages (F-6). SONDA is meant to stay open in a tab; the homepage
 * already reloads itself, the list and detail pages did not. This runs `fn` every
 * `intervalMs` while the tab is visible, and once right after the tab becomes visible
 * again if the last run is older than the interval. `fn` decides itself whether anything
 * changed (compare snapshot timestamps) and re-renders in place.
 */
export function startAutoRefresh(fn, { intervalMs = 60000 } = {}) {
  let last = Date.now();
  let running = false;
  const tick = async () => {
    if (document.hidden || running) return;
    running = true;
    try { await fn(); } catch (e) { console.warn('[SONDA] refresh:', e); }
    last = Date.now();
    running = false;
  };
  const timer = setInterval(tick, intervalMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - last > intervalMs) tick();
  });
  return () => clearInterval(timer);
}

/**
 * Fields that mark a validator row as "changed" between two snapshots. Credits, skip and
 * latency move every cycle for everyone and are excluded; the glow should mean something.
 */
export function rowSignature(r) {
  if (!r) return '';
  const g = r.geolocation || {};
  return [
    r.role, r.delinquent ? 1 : 0, r.version, r.client_type,
    Math.round((r.activated_stake_lamports || 0) / 1e12),   // 1000 SOL steps
    g.country_code, g.city, g.asn,
    r.dz_connected ? 1 : 0, r.dz_multicast_publisher ? 1 : 0, r.bam_node || '',
    r.sfdp_state || '', r.is_superminority ? 1 : 0, r.commission, r.name || '',
  ].join('|');
}

/** Map identity -> signature for a record list. */
export function signatureMap(records) {
  const m = new Map();
  for (const r of records || []) if (r?.identity_pubkey) m.set(r.identity_pubkey, rowSignature(r));
  return m;
}

/** Identities whose signature differs between two maps (present in both). */
export function changedIdentities(prevMap, nextMap) {
  const out = new Set();
  for (const [id, sig] of nextMap) {
    const before = prevMap.get(id);
    if (before != null && before !== sig) out.add(id);
  }
  return out;
}

/** Keep the page where it was while a list re-renders under the reader. */
export function preserveScroll(fn) {
  const y = window.scrollY;
  const result = fn();
  window.scrollTo({ top: y });
  return result;
}
