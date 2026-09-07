// src/lib/data.js
export const R2_BASE = 'https://data.sonda.network';
export const CLUSTERS = ['mainnet-beta', 'testnet', 'devnet', 'alpenglow-community'];
export const DEFAULT_CLUSTER = 'mainnet-beta';

// Validator universe shown on /validators and /validator: every vote account with
// stake in the current epoch. 'validator' = visible in gossip; 'validator-hidden' =
// voting but not visible in gossip (no IP, version or client data); 'validator-inactive' =
// delinquent and not visible in gossip. co-hosted records have no vote account and are
// not validators. This matches metrics.validators.total_all and stake_by_version in
// network_summary.json, so totals stay stable when a node drops out of gossip.
export const VALIDATOR_ROLES = ['validator', 'validator-hidden', 'validator-inactive'];
export function isValidatorRecord(r) {
  return !!r && VALIDATOR_ROLES.includes(r.role);
}
export function isInGossip(r) {
  return !!r && r.role === 'validator';
}

// Apply cluster to <html data-cluster=...> for global tinting
export function applyClusterToHtml(cluster) {
  if (typeof document === 'undefined') return;
  const c = cluster === 'mainnet-beta' ? 'mainnet' : cluster;
  document.documentElement.setAttribute('data-cluster', c);
}

export function getClusterFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const c = params.get('cluster');
  return c && CLUSTERS.includes(c) ? c : null;
}

export function syncClusterToUrl(cluster) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('cluster', cluster);
  window.history.replaceState(null, '', url.toString());
}

export function bootstrapCluster() {
  if (typeof window === 'undefined') return DEFAULT_CLUSTER;
  const fromUrl = getClusterFromUrl();
  let cluster;
  if (fromUrl) {
    localStorage.setItem('sonda-cluster', fromUrl);
    cluster = fromUrl;
  } else {
    const stored = localStorage.getItem('sonda-cluster');
    cluster = CLUSTERS.includes(stored) ? stored : DEFAULT_CLUSTER;
    syncClusterToUrl(cluster);
  }
  applyClusterToHtml(cluster);
  return cluster;
}

export function getCluster() {
  if (typeof window === 'undefined') return DEFAULT_CLUSTER;
  const stored = localStorage.getItem('sonda-cluster');
  return CLUSTERS.includes(stored) ? stored : DEFAULT_CLUSTER;
}

export function setCluster(cluster) {
  if (!CLUSTERS.includes(cluster)) return;
  localStorage.setItem('sonda-cluster', cluster);
  syncClusterToUrl(cluster);
  applyClusterToHtml(cluster);
  window.dispatchEvent(new CustomEvent('sonda:cluster-change', { detail: { cluster } }));
}

// Module-level cache for cross-cluster lookups
const _cache = new Map();

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.json();
}

export async function fetchSummary(cluster = getCluster()) {
  return fetchJson(`${R2_BASE}/current/${cluster}/network_summary.json`);
}

// Cached mainnet summary fetch for About epoch lookup (always uses mainnet epoch
// regardless of currently selected cluster).
export async function fetchMainnetSummaryCached(ttlMs = 60000) {
  const key = 'summary:mainnet-beta';
  const now = Date.now();
  const cached = _cache.get(key);
  if (cached && (now - cached.t) < ttlMs) return cached.data;
  const data = await fetchSummary('mainnet-beta');
  _cache.set(key, { data, t: now });
  return data;
}

export async function fetchValidators(cluster = getCluster()) {
  return fetchJson(`${R2_BASE}/current/${cluster}/validators.json`);
}

// Cached fetch with TTL — used for cross-cluster mainnet lookup on testnet
export async function fetchValidatorsCached(cluster, ttlMs = 60000) {
  const key = `validators:${cluster}`;
  const now = Date.now();
  const cached = _cache.get(key);
  if (cached && (now - cached.t) < ttlMs) return cached.data;
  const data = await fetchValidators(cluster);
  _cache.set(key, { data, t: now });
  return data;
}

export async function fetchRpc(cluster = getCluster()) {
  return fetchJson(`${R2_BASE}/current/${cluster}/rpc.json`);
}

export async function fetchInfrastructure(cluster = getCluster()) {
  return fetchJson(`${R2_BASE}/current/${cluster}/infrastructure.json`);
}

export async function fetchValidatorHistory(identity, cluster = getCluster()) {
  return fetchJson(`${R2_BASE}/history/${cluster}/${identity}.json`);
}
// ============================================================================
// Phase 2 utilities — validators list/detail, datacenters list/detail
// All client-side, no backend dependency. Will be replaced by backend-derived
// views (validators/{cluster}/{vote_account}.json + datacenters.json) in v2.
// ============================================================================

/** Lamports → SOL with k/M/B suffix. 1 SOL = 1e9 lamports. */
export function fmtStakeShort(lamports) {
  if (lamports == null) return '—';
  const sol = lamports / 1e9;
  if (sol >= 1e9) return (sol / 1e9).toFixed(2) + 'B';
  if (sol >= 1e6) return (sol / 1e6).toFixed(1) + 'M';
  if (sol >= 1e3) return (sol / 1e3).toFixed(1) + 'k';
  if (sol >= 1)   return sol.toFixed(0);
  return sol.toFixed(2);
}

/** Hash identity → stable HSL color (used for icon fallback background). */
export function identityIconHash(identity) {
  if (!identity) return { hue: 200, sat: 30 };
  let h = 0;
  for (let i = 0; i < identity.length; i++) {
    h = ((h << 5) - h + identity.charCodeAt(i)) | 0;
  }
  return { hue: Math.abs(h) % 360, sat: 35 + (Math.abs(h >> 8) % 20) };
}

/** Build fallback icon initial (first letter of name or identity). */
export function iconInitial(name, identity) {
  if (name && name.length > 0) return name.trim()[0].toUpperCase();
  if (identity && identity.length > 0) return identity[0].toUpperCase();
  return '?';
}

/**
 * Client-side aggregation: validators.json records → list of datacenters.
 * Groups by ASN + city (treats each combination as a separate DC entry).
 * Returns { by_dc: [...], by_asn: [...] } with sums/counts/weighted averages.
 */
export function aggregateDatacenters(records) {
  if (!Array.isArray(records)) return { by_dc: [], by_asn: [] };

  const validators = records.filter(r => r && r.role === 'validator');
  if (validators.length === 0) return { by_dc: [], by_asn: [] };

  // Total stake across whole cluster for stake_pct calculation
  const totalStake = validators.reduce(
    (s, v) => s + (v.activated_stake_lamports || 0), 0
  );

  const byDcMap = new Map();
  const byAsnMap = new Map();

  for (const v of validators) {
    const geo = v.geolocation || {};
    const asn = geo.asn || 'unknown';
    const city = geo.city || 'Unknown';
    const country = geo.country_code || geo.country || '??';
    const asnName = geo.asn_name || asn;
    const dcId = `${asn}_${city}`;

    // ---- by_dc bucket ----
    if (!byDcMap.has(dcId)) {
      byDcMap.set(dcId, {
        id: dcId, asn, asn_name: asnName, city, country,
        validators_total: 0, validators_active: 0, validators_delinquent: 0,
        stake_lamports: 0,
        sum_skip_rate_weighted: 0, sum_credits_weighted: 0,
        sum_ibrl_weighted: 0, sum_ibrl_weight: 0,
        dz_connected: 0, dz_multicast_publishers: 0,
        bam_count: 0, rakurai_count: 0, sfdp_approved: 0,
        vote_accounts: [],
      });
    }
    const dc = byDcMap.get(dcId);
    dc.validators_total++;
    if (v.delinquent) dc.validators_delinquent++;
    else dc.validators_active++;
    const st = v.activated_stake_lamports || 0;
    dc.stake_lamports += st;
    if (v.skip_rate != null) dc.sum_skip_rate_weighted += (v.skip_rate * st);
    if (v.epoch_credits != null) dc.sum_credits_weighted += (v.epoch_credits * st);
    if (v.ibrl && v.ibrl.ibrl_score != null) {
      dc.sum_ibrl_weighted += v.ibrl.ibrl_score * st;
      dc.sum_ibrl_weight += st;
    }
    if (v.dz_connected) dc.dz_connected++;
    if (v.dz_multicast_publisher) dc.dz_multicast_publishers++;
    if (v.bam_node) dc.bam_count++;
    if (v.is_rakurai) dc.rakurai_count++;
    if (v.sfdp_state === 'Approved') dc.sfdp_approved++;
    if (v.vote_account) dc.vote_accounts.push(v.vote_account);

    // ---- by_asn bucket ----
    if (!byAsnMap.has(asn)) {
      byAsnMap.set(asn, {
        asn, asn_name: asnName,
        cities: new Set(),
        validators_total: 0, validators_active: 0, validators_delinquent: 0,
        stake_lamports: 0,
        sum_skip_rate_weighted: 0, sum_credits_weighted: 0,
        sum_ibrl_weighted: 0, sum_ibrl_weight: 0,
        dz_connected: 0, dz_multicast_publishers: 0,
        bam_count: 0, rakurai_count: 0, sfdp_approved: 0,
        vote_accounts: [],
      });
    }
    const asnEntry = byAsnMap.get(asn);
    asnEntry.cities.add(city);
    asnEntry.validators_total++;
    if (v.delinquent) asnEntry.validators_delinquent++;
    else asnEntry.validators_active++;
    asnEntry.stake_lamports += st;
    if (v.skip_rate != null) asnEntry.sum_skip_rate_weighted += (v.skip_rate * st);
    if (v.epoch_credits != null) asnEntry.sum_credits_weighted += (v.epoch_credits * st);
    if (v.ibrl && v.ibrl.ibrl_score != null) {
      asnEntry.sum_ibrl_weighted += v.ibrl.ibrl_score * st;
      asnEntry.sum_ibrl_weight += st;
    }
    if (v.dz_connected) asnEntry.dz_connected++;
    if (v.dz_multicast_publisher) asnEntry.dz_multicast_publishers++;
    if (v.bam_node) asnEntry.bam_count++;
    if (v.is_rakurai) asnEntry.rakurai_count++;
    if (v.sfdp_state === 'Approved') asnEntry.sfdp_approved++;
    if (v.vote_account) asnEntry.vote_accounts.push(v.vote_account);
  }

  // Finalize weighted averages + stake_pct
  const finalize = (e) => {
    e.stake_pct = totalStake > 0 ? (e.stake_lamports / totalStake) * 100 : 0;
    e.weighted_skip_rate = e.stake_lamports > 0
      ? e.sum_skip_rate_weighted / e.stake_lamports : null;
    e.weighted_credits = e.stake_lamports > 0
      ? e.sum_credits_weighted / e.stake_lamports : null;
    e.weighted_ibrl = e.sum_ibrl_weight > 0
      ? e.sum_ibrl_weighted / e.sum_ibrl_weight : null;
    delete e.sum_skip_rate_weighted;
    delete e.sum_credits_weighted;
    delete e.sum_ibrl_weighted;
    delete e.sum_ibrl_weight;
  };
  const byDc = [...byDcMap.values()];
  byDc.forEach(finalize);
  byDc.sort((a, b) => b.stake_lamports - a.stake_lamports);

  const byAsn = [...byAsnMap.values()].map(e => ({
    ...e, cities: [...e.cities].sort(),
  }));
  byAsn.forEach(finalize);
  byAsn.sort((a, b) => b.stake_lamports - a.stake_lamports);

  return { by_dc: byDc, by_asn: byAsn };
}

/**
 * Concentration risk level by stake percentage.
 * Multi-level: bad (≥25%), warn (15-25%), caution (5-15%), good (<5%).
 */
export function concentrationLevel(stakePct) {
  if (stakePct == null) return 'neutral';
  if (stakePct >= 25) return 'bad';
  if (stakePct >= 15) return 'warn';
  if (stakePct >= 5)  return 'caution';
  return 'good';
}

/** Apply URL query filters to validator records. Pure function. */
export function filterValidators(records, params) {
  if (!Array.isArray(records)) return [];
  let out = records.filter(isValidatorRecord);

  const countries = (params.get('country') || '').split(',').filter(Boolean);
  if (countries.length > 0) {
    out = out.filter(r => countries.includes(r.geolocation?.country_code));
  }

  const asn = params.get('asn');
  if (asn) out = out.filter(r => r.geolocation?.asn === asn);

  const city = params.get('city');
  if (city) out = out.filter(r => r.geolocation?.city === city);

  const dz = params.get('dz');
  if (dz === 'connected') out = out.filter(r => r.dz_connected);
  else if (dz === 'multicast') out = out.filter(r => r.dz_multicast_publisher);
  else if (dz === 'no') out = out.filter(r => !r.dz_connected);

  const bam = params.get('bam');
  if (bam === 'true') out = out.filter(r => !!r.bam_node);

  const rakurai = params.get('rakurai');
  if (rakurai === 'true') out = out.filter(r => r.is_rakurai);

  const sfdp = params.get('sfdp');
  if (sfdp) out = out.filter(r => r.sfdp_state === sfdp);

  const delinquent = params.get('delinquent');
  if (delinquent === 'true') out = out.filter(r => r.delinquent);
  else if (delinquent === 'false') out = out.filter(r => !r.delinquent);

  const sm = params.get('superminority');
  if (sm === 'true') out = out.filter(r => r.is_superminority);

  const q = (params.get('q') || '').trim().toLowerCase();
  if (q) {
    out = out.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.identity_pubkey || '').toLowerCase().includes(q) ||
      (r.vote_account || '').toLowerCase().includes(q)
    );
  }

  return out;
}

/**
 * Competition ranking by epoch_credits (TVC rank): equal credits share a rank,
 * the next distinct value gets 1 + number of validators ranked above it
 * (1, 1, 1, 4, 5 ...). Records without credits get no rank. Writes _tvc_rank and
 * _tvc_total on each record (client-side only fields) and returns the ranked count.
 */
export function computeTvcRanks(records) {
  const ranked = records.filter(r => r && r.epoch_credits != null);
  const sorted = [...ranked].sort((a, b) => b.epoch_credits - a.epoch_credits);
  let rank = 0;
  let prev = null;
  sorted.forEach((r, i) => {
    if (prev === null || r.epoch_credits !== prev) rank = i + 1;
    prev = r.epoch_credits;
    r._tvc_rank = rank;
    r._tvc_total = sorted.length;
  });
  records.forEach(r => { if (r && r.epoch_credits == null) { r._tvc_rank = null; r._tvc_total = sorted.length; } });
  return sorted.length;
}

/** Apply sort to validators. Default: TVC rank (best first). Ties fall back to stake desc. */
export function sortValidators(records, sort = 'rank', dir = 'asc') {
  const out = [...records];
  const m = dir === 'asc' ? 1 : -1;
  // Null metrics sink to the bottom in both directions.
  const NULL_LO = -Infinity;
  const NULL_HI = Infinity;
  const nullSink = () => (dir === 'asc' ? NULL_HI : NULL_LO);
  const accessor = {
    rank: r => r._tvc_rank ?? nullSink(),
    stake: r => r.activated_stake_lamports || 0,
    name: r => (r.name || '').toLowerCase(),
    city: r => (r.geolocation?.city || '').toLowerCase(),
    skip: r => r.skip_rate ?? nullSink(),
    credits: r => r.epoch_credits ?? nullSink(),
    slot: r => r.slot_duration_median ?? nullSink(),
    vlat: r => r.median_vote_latency ?? nullSink(),
    ibrl: r => r.ibrl?.ibrl_score ?? nullSink(),
    commission: r => r.commission ?? -1,
    country: r => r.geolocation?.country_code || '',
    asn: r => r.geolocation?.asn || '',
  }[sort] || (r => r._tvc_rank ?? nullSink());
  const stakeOf = r => r.activated_stake_lamports || 0;
  out.sort((a, b) => {
    const va = accessor(a), vb = accessor(b);
    if (va < vb) return -1 * m;
    if (va > vb) return 1 * m;
    // Tie-break: larger stake first, then identity for a stable order.
    const sa = stakeOf(a), sb = stakeOf(b);
    if (sa !== sb) return sb - sa;
    return (a.identity_pubkey || '') < (b.identity_pubkey || '') ? -1 : 1;
  });
  return out;
}

/**
 * Group validator records by ASN number. Raw asn_name differs between geo providers
 * for the same ASN (DB-IP "TERASWITCH" vs ipinfo "TeraSwitch Networks Inc."), so the
 * label is the most frequent raw name for that ASN; ties prefer the DB-IP variant.
 * Records without geolocation are grouped under asn 'unknown'.
 * Returns entries sorted by stake desc: { asn, name, count, delinquent, stake_lamports, stake_pct }.
 */
export function aggregateByAsn(records) {
  const vals = (records || []).filter(isValidatorRecord);
  const totalStake = vals.reduce((s, r) => s + (r.activated_stake_lamports || 0), 0);
  const map = new Map();
  for (const r of vals) {
    const geo = r.geolocation || null;
    const asn = geo?.asn || 'unknown';
    if (!map.has(asn)) {
      map.set(asn, { asn, name: null, count: 0, delinquent: 0, stake_lamports: 0, stake_pct: 0, _names: new Map() });
    }
    const e = map.get(asn);
    e.count++;
    if (r.delinquent) e.delinquent++;
    e.stake_lamports += r.activated_stake_lamports || 0;
    const rawName = geo?.asn_name;
    if (rawName) {
      const n = e._names.get(rawName) || { count: 0, dbip: 0 };
      n.count++;
      if (geo.primary_source === 'dbip') n.dbip++;
      e._names.set(rawName, n);
    }
  }
  const out = [...map.values()].map(e => {
    let best = null;
    for (const [name, n] of e._names) {
      if (!best || n.count > best.n.count || (n.count === best.n.count && n.dbip > best.n.dbip)) best = { name, n };
    }
    e.name = best ? best.name : (e.asn === 'unknown' ? 'Unknown ASN' : e.asn);
    e.stake_pct = totalStake > 0 ? (e.stake_lamports / totalStake) * 100 : 0;
    delete e._names;
    return e;
  });
  out.sort((a, b) => b.stake_lamports - a.stake_lamports || b.count - a.count);
  return out;
}
