/**
 * Provider-level aggregation for the datacenters pages (F-C.1). A provider is the company
 * a node is rented from (geolocation.provider, analyzer v3.11.1), which may run several
 * ASNs. Entries carry everything the list and the detail page show: counts, stake,
 * locations, infrastructure participation, performance and metadata from
 * metrics.providers (v3.12: tags, website, logo).
 */
import { isValidatorRecord, isInGossip, providerOf, providerMeta, providerLogoUrl, providerTagsText, fetchValidators } from './data.js';
import { applyListFilter } from './ui.js';

export const CLUSTER_ORDER = ['mainnet-beta', 'testnet', 'devnet', 'alpenglow-community'];
export const CLUSTER_SHORT = { 'mainnet-beta': 'mainnet', 'testnet': 'testnet', 'devnet': 'devnet', 'alpenglow-community': 'alpenglow' };

/**
 * Where else this provider (by slug) has validators: [{cluster, count, stake_pct, slug}] in the
 * canonical cluster order. Fetches the other clusters' validators.json (cached in data.js).
 */
export async function providerPresence(slug, exceptCluster = null) {
  const out = [];
  await Promise.all(CLUSTER_ORDER.filter(c => c !== exceptCluster).map(async (c) => {
    try {
      const d = await fetchValidators(c);
      const list = aggregateProviders((d?.records || []).filter(isValidatorRecord), null);
      const hit = findProvider(list, slug);
      if (hit) out.push({ cluster: c, count: hit.count, stake_pct: hit.stake_pct, slug: hit.slug });
    } catch (e) { /* cluster unavailable */ }
  }));
  return out.sort((a, b) => CLUSTER_ORDER.indexOf(a.cluster) - CLUSTER_ORDER.indexOf(b.cluster));
}

/** URL slug for a provider name: "Cherry Servers" -> "cherry-servers". */
export function providerSlug(name) {
  return String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}
/** Find a provider entry by slug, exact name or one of its ASNs (legacy links). */
export function findProvider(list, key) {
  if (!key) return null;
  const k = String(key);
  return list.find(e => e.provider === k) || list.find(e => e.slug === providerSlug(k)) || list.find(e => e.asns.some(a => a.asn === k)) || null;
}

/**
 * Network infrastructure hosted by each provider, from the summary: Jito endpoints
 * (block engines, shred receivers, BAM relays), Harmonic endpoints, official Solana RPC /
 * entrypoints (all keyed by provider name), plus Jito BAM nodes and DoubleZero devices
 * (keyed by ASN, mapped to a provider through the validators' ASN -> provider map).
 */
export function emptyNet() {
  return { jito: 0, block_engines: 0, shred_receivers: 0, ntp: 0, harmonic: 0, solana: 0, bam_nodes: 0, dz_devices: 0 };
}
export function netTotal(n) {
  return (n.bam_nodes || 0) + (n.block_engines || 0) + (n.shred_receivers || 0) + (n.ntp || 0) + (n.harmonic || 0) + (n.solana || 0) + (n.dz_devices || 0) + ((n.jito || 0) - (n.block_engines || 0) - (n.shred_receivers || 0) - (n.ntp || 0) - (n.bam_nodes || 0) > 0 ? (n.jito - n.block_engines - n.shred_receivers - n.ntp - n.bam_nodes) : 0);
}
/** Role of an infrastructure.json record -> counter field. */
export function netFieldOfRole(role) {
  const r = String(role || '');
  if (r === 'jito-bam') return 'bam_nodes';
  if (r === 'jito-block-engine') return 'block_engines';
  if (r === 'jito-shred-receiver') return 'shred_receivers';
  if (r === 'jito-ntp') return 'ntp';
  if (r.startsWith('harmonic-')) return 'harmonic';
  if (r === 'dz-device') return 'dz_devices';
  if (r.startsWith('solana-')) return 'solana';
  return null;
}
/**
 * Exact per-provider (and per-city) network infrastructure from infrastructure.json records:
 * each record carries role + geolocation.provider/city (backend 2026-09-24). Returns
 * { byProvider: Map(name -> net), byProviderCity: Map(name -> Map("City|CC" -> net)) }.
 * asnToProvider fills in records whose provider is missing.
 */
/** Display name of an infrastructure node: endpoint label, record name, or its address. */
export function infraNodeName(r) {
  return r?.endpoint?.label || r?.name || r?.dz_device_name || r?.hostname || r?.ip_address || r?.identity_pubkey || '';
}
function bumpNames(e, field, r) {
  const n = infraNodeName(r);
  if (!n) return;
  if (!e.names) e.names = {};
  (e.names[field] = e.names[field] || []).push(n);
}
export function networkInfraFromRecords(records, asnToProvider = new Map()) {
  const byProvider = new Map();
  const byProviderCity = new Map();
  for (const r of records || []) {
    const field = netFieldOfRole(r.role);
    if (!field) continue;
    const g = r.geolocation || {};
    const name = g.provider || (g.asn ? asnToProvider.get(g.asn) : null) || g.asn_name || null;
    if (!name) continue;
    const e = byProvider.get(name) || emptyNet();
    e[field]++; if (field !== 'bam_nodes' && field !== 'harmonic' && field !== 'dz_devices' && field !== 'solana') e.jito++;
    bumpNames(e, field, r);
    byProvider.set(name, e);
    const cities = byProviderCity.get(name) || new Map();
    const ck = `${g.city || 'Unknown'}|${g.country_code || '??'}`;
    const c = cities.get(ck) || emptyNet();
    c[field]++; if (field !== 'bam_nodes' && field !== 'harmonic' && field !== 'dz_devices' && field !== 'solana') c.jito++;
    bumpNames(c, field, r);
    cities.set(ck, c); byProviderCity.set(name, cities);
  }
  return { byProvider, byProviderCity };
}

/** Tooltip text for a network badge: the generic line plus the node names, one per line. */
export function netBadgeTip(net, field, generic, max = 12) {
  const names = net?.names?.[field] || [];
  if (!names.length) return generic;
  const shown = names.slice(0, max);
  return `${generic}\n${shown.join('\n')}${names.length > max ? `\n+${names.length - max} more` : ''}`;
}

export function networkInfraByProvider(summary, asnToProvider) {
  const m = summary?.metrics || {};
  const out = new Map();
  const bump = (name, field, n) => {
    if (!name || !n) return;
    const e = out.get(name) || emptyNet();
    e[field] += n; out.set(name, e);
  };
  const ep = m.endpoints || {};
  for (const [cat, field] of [['jito', 'jito'], ['harmonic', 'harmonic'], ['solana', 'solana']]) {
    const dist = ep[cat]?.provider_distribution || {};
    for (const [name, n] of Object.entries(dist)) bump(name, field, n);
  }
  // v3.13 ships provider_distribution next to asn_distribution; use it when present
  const byProv = (block, field) => {
    if (block?.provider_distribution) { for (const [name, n] of Object.entries(block.provider_distribution)) bump(name, field, n); return true; }
    return false;
  };
  const byAsn = (dist, field) => { for (const [asn, n] of Object.entries(dist || {})) { const name = asnToProvider.get(asn); if (name) bump(name, field, n); } };
  if (!byProv(m.bam?.node_geo, 'bam_nodes')) byAsn(m.bam?.node_geo?.asn_distribution, 'bam_nodes');
  if (!byProv(m.doublezero?.device_geo, 'dz_devices')) byAsn(m.doublezero?.device_geo?.asn_distribution, 'dz_devices');
  return out;
}

function median(nums) {
  const a = nums.filter(n => n != null && !Number.isNaN(n)).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function mean(nums) {
  const a = nums.filter(n => n != null && !Number.isNaN(n));
  return a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
}

export function concentrationLevelOf(pct) {
  if (pct == null) return 'ok';
  if (pct > 25) return 'critical';
  if (pct > 15) return 'warning';
  return 'ok';
}

/**
 * Returns [{ provider, count, delinquent, stake_lamports, stake_pct, asns: [{asn, name, count, stake_lamports}],
 *   countries: Map(cc -> {cc, country, count}), cities: [{city, cc, country, count, stake_lamports, asns:Set}],
 *   dz, multicast, bam, sfdp, superminority, skip_avg, rank_median, rank_best, tags, website, logo, level }]
 * sorted by stake desc. Records outside gossip (no geolocation) are skipped.
 */
/**
 * Providers that host network infrastructure (DoubleZero devices, BAM nodes, Jito or
 * Harmonic endpoints, official RPC) but no validators: transit carriers like Cogent, Zayo,
 * Tata. They get their own rows (count 0, net_only: true) so the infrastructure is
 * visible even where nobody rents a validator (Viktor, 2026-09-27).
 */
export function networkOnlyProviders(existing, infraRecords, summary, asnToProvider = new Map()) {
  const known = new Set(existing.map(e => e.provider));
  const { byProvider, byProviderCity } = networkInfraFromRecords(infraRecords, asnToProvider);
  const out = [];
  for (const [name, net] of byProvider) {
    if (known.has(name)) continue;
    const asnMap = new Map(); const countries = new Map(); const cities = new Map();
    for (const r of infraRecords || []) {
      const g = r.geolocation || {};
      const rn = g.provider || (g.asn ? asnToProvider.get(g.asn) : null) || g.asn_name || null;
      if (rn !== name || !netFieldOfRole(r.role)) continue;
      if (g.asn) { const a = asnMap.get(g.asn) || { asn: g.asn, name: g.asn_name || g.asn, count: 0, stake_lamports: 0, nodes: 0 }; a.nodes++; asnMap.set(g.asn, a); }
      const cc = g.country_code && g.country_code !== '??' ? g.country_code : null;
      if (cc) { const c = countries.get(cc) || { cc, country: g.country || cc, count: 0, stake_lamports: 0, nodes: 0 }; c.nodes++; countries.set(cc, c); }
      const ck = `${g.city || 'Unknown'}|${cc || '??'}`;
      const ci = cities.get(ck) || { city: g.city || 'Unknown', cc, country: g.country || cc || '', count: 0, delinquent: 0, stake_lamports: 0, stake_pct: 0, dz: 0, bam: 0, asns: new Set(), nodes: 0 };
      ci.nodes++; if (g.asn) ci.asns.add(g.asn); cities.set(ck, ci);
    }
    const meta = providerMeta(summary, name, [...asnMap.keys()][0] || null) || {};
    const asns = [...asnMap.values()].sort((a, b) => b.nodes - a.nodes);
    out.push({
      provider: name, slug: providerSlug(name), net_only: true,
      count: 0, delinquent: 0, stake_lamports: 0, stake_pct: 0, level: 'ok', stake_tier: 0, perf_quarter: null,
      asns, primary_asn: asns[0]?.asn || null,
      countries: [...countries.values()].sort((a, b) => b.nodes - a.nodes),
      cities: [...cities.values()].map(c => Object.assign(c, { asns: [...c.asns] })).sort((a, b) => b.nodes - a.nodes),
      dz: 0, multicast: 0, bam: 0, sfdp: 0, superminority: 0,
      skip_avg: null, rank_median: null, rank_best: null, ibrl_median: null, slot_median: null, vlat_median: null, vlat_mean: null, votes_mean: null,
      tags: Array.isArray(meta.tags) ? meta.tags : [], tagsText: providerTagsText(summary, name), website: meta.website || null,
      logo: providerLogoUrl(summary, name, asns[0]?.asn || null),
      top: [], net, net_total: netTotal(net), net_cities: byProviderCity.get(name) || new Map(),
    });
  }
  return out;
}

/** Replace the summary-based network numbers with exact ones from infrastructure.json. */
export function applyNetworkInfra(providers, byProvider) {
  // the file is the complete inventory: providers absent from it host nothing
  for (const e of providers) {
    const exact = byProvider.get(e.provider) || emptyNet();
    e.net = exact; e.net_total = netTotal(exact);
  }
  return providers;
}

export function aggregateProviders(records, summary) {
  const vals = (records || []).filter(r => isValidatorRecord(r) && isInGossip(r) && r.geolocation);
  const totalStake = (records || []).filter(isValidatorRecord).reduce((s, r) => s + (r.activated_stake_lamports || 0), 0);
  const map = new Map();
  for (const r of vals) {
    const key = providerOf(r) || 'Unknown';
    const g = r.geolocation;
    if (!map.has(key)) map.set(key, {
      provider: key, count: 0, delinquent: 0, stake_lamports: 0, stake_pct: 0,
      _asns: new Map(), _countries: new Map(), _cities: new Map(),
      dz: 0, multicast: 0, bam: 0, sfdp: 0, superminority: 0, _skips: [], _ranks: [], _ibrl: [], _slot: [], _vlat: [], _votes: [], _top: [],
    });
    const e = map.get(key);
    e.count++;
    if (r.delinquent) e.delinquent++;
    e.stake_lamports += r.activated_stake_lamports || 0;
    if (g.asn) {
      const a = e._asns.get(g.asn) || { asn: g.asn, name: g.asn_name || g.asn, count: 0, stake_lamports: 0 };
      a.count++; a.stake_lamports += r.activated_stake_lamports || 0; e._asns.set(g.asn, a);
    }
    const cc = g.country_code && g.country_code !== '??' ? g.country_code : null;
    if (cc) {
      const c = e._countries.get(cc) || { cc, country: g.country || cc, count: 0, stake_lamports: 0 };
      c.count++; c.stake_lamports += r.activated_stake_lamports || 0; e._countries.set(cc, c);
    }
    const cityKey = `${g.city || 'Unknown'}|${cc || '??'}`;
    const ci = e._cities.get(cityKey) || { city: g.city || 'Unknown', cc, country: g.country || cc || '', count: 0, delinquent: 0, stake_lamports: 0, dz: 0, bam: 0, asns: new Set() };
    ci.count++; if (r.delinquent) ci.delinquent++; ci.stake_lamports += r.activated_stake_lamports || 0;
    if (r.dz_connected) ci.dz++; if (r.bam_node) ci.bam++; if (g.asn) ci.asns.add(g.asn);
    e._cities.set(cityKey, ci);
    if (r.dz_connected) e.dz++;
    if (r.dz_multicast_publisher) e.multicast++;
    if (r.bam_node) e.bam++;
    if (r.sfdp_state === 'Approved') e.sfdp++;
    if (r.is_superminority) e.superminority++;
    if (r.skip_rate != null) e._skips.push(r.skip_rate);
    if (r._tvc_rank != null) e._ranks.push(r._tvc_rank);
    e._top.push({ name: r.name || null, identity: r.identity_pubkey, vote: r.vote_account, icon_url: r.icon_url || null, stake: r.activated_stake_lamports || 0 });
    if (r.ibrl?.ibrl_score != null) e._ibrl.push(r.ibrl.ibrl_score);
    if (r.slot_duration_median != null) e._slot.push(r.slot_duration_median);
    if (r.mean_vote_latency != null) e._vlat.push(r.mean_vote_latency); else if (r.median_vote_latency != null) e._vlat.push(r.median_vote_latency);
    if (r.vote_credits_ratio_prev != null) e._votes.push(r.vote_credits_ratio_prev);
  }
  const asnToProvider = new Map();
  for (const e of map.values()) for (const asn of e._asns.keys()) asnToProvider.set(asn, e.provider);
  const netInfra = networkInfraByProvider(summary, asnToProvider);
  const out = [...map.values()].map(e => {
    e.asns = [...e._asns.values()].sort((a, b) => b.count - a.count);
    e.primary_asn = e.asns[0]?.asn || null;
    e.countries = [...e._countries.values()].sort((a, b) => b.count - a.count);
    e.cities = [...e._cities.values()].map(c => Object.assign(c, { asns: [...c.asns], stake_pct: totalStake ? (c.stake_lamports / totalStake) * 100 : 0 })).sort((a, b) => b.stake_lamports - a.stake_lamports);
    e.stake_pct = totalStake ? (e.stake_lamports / totalStake) * 100 : 0;
    e.skip_avg = mean(e._skips);
    e.rank_median = median(e._ranks);
    e.rank_best = e._ranks.length ? Math.min(...e._ranks) : null;
    e.ibrl_median = median(e._ibrl);
    e.slot_median = median(e._slot);
    e.vlat_median = median(e._vlat);
    e.vlat_mean = mean(e._vlat);   // mean of the validators' mean latencies (v3.13), medians as fallback
    e.votes_mean = mean(e._votes);  // average vote performance (credits vs the best validator, last full epoch)
    e.slug = providerSlug(e.provider);
    e.top = e._top.sort((a, b) => b.stake - a.stake).slice(0, 5);   // biggest validators, for the faces in the list
    e.net = netInfra.get(e.provider) || emptyNet();
    e.net_total = netTotal(e.net);
    e.level = concentrationLevelOf(e.stake_pct);
    const meta = providerMeta(summary, e.provider) || {};
    e.tags = Array.isArray(meta.tags) ? meta.tags : [];
    e.tagsText = providerTagsText(summary, e.provider);
    e.website = meta.website || null;
    e.logo = providerLogoUrl(summary, e.provider, e.primary_asn);
    delete e._asns; delete e._countries; delete e._cities; delete e._skips; delete e._ranks; delete e._ibrl; delete e._slot; delete e._vlat; delete e._votes; delete e._top;
    return e;
  });
  out.sort((a, b) => b.stake_lamports - a.stake_lamports || b.count - a.count);
  // stake tier among providers (same four steps as validators: p25 / p75 / p90)
  const st = out.map(e => e.stake_lamports).sort((a, b) => a - b);
  const q = p => st[Math.min(st.length - 1, Math.floor(p * st.length))] || 0;
  const [p25, p75, p90] = [q(0.25), q(0.75), q(0.9)];
  for (const e of out) e.stake_tier = e.stake_lamports >= p90 ? 4 : e.stake_lamports >= p75 ? 3 : e.stake_lamports >= p25 ? 2 : 1;
  // performance quarter by median TVC rank among providers that have a rank (1 = best quarter)
  const ranked = out.filter(e => e.rank_median != null).sort((a, b) => a.rank_median - b.rank_median);
  ranked.forEach((e, i) => { e.perf_quarter = Math.min(4, Math.floor((i / Math.max(1, ranked.length)) * 4) + 1); });
  return out;
}

/** Sort accessor for provider entries. */
export function sortProviders(list, key, dir) {
  const m = dir === 'asc' ? 1 : -1;
  const acc = {
    stake: e => e.stake_lamports,
    validators: e => e.count,
    delinquent: e => e.delinquent,
    name: e => e.provider.toLowerCase(),
    countries: e => e.countries.length,
    cities: e => e.cities.length,
    asns: e => e.asns.length,
    dz: e => e.dz,
    bam: e => e.bam,
    sfdp: e => e.sfdp,
    skip: e => (e.skip_avg == null ? Infinity * (dir === 'asc' ? 1 : -1) : e.skip_avg),
    rank: e => (e.rank_median == null ? Infinity * (dir === 'asc' ? 1 : -1) : e.rank_median),
    ibrl: e => (e.ibrl_median == null ? -Infinity * (dir === 'asc' ? -1 : 1) : e.ibrl_median),
    slot: e => (e.slot_median == null ? Infinity * (dir === 'asc' ? 1 : -1) : e.slot_median),
    vlat: e => (e.vlat_mean == null ? Infinity * (dir === 'asc' ? 1 : -1) : e.vlat_mean),
    votes: e => (e.votes_mean == null ? -Infinity * (dir === 'asc' ? -1 : 1) : e.votes_mean),
    net: e => e.net_total,
  }[key] || (e => e.stake_lamports);
  // Tie-break: performance keys fall back to validator count (a 2-node provider with a
  // great median should not outrank a 100-node one at equal values), the rest to stake.
  const tie = ['rank', 'skip', 'ibrl', 'slot', 'vlat', 'votes'].includes(key) ? (a, b) => b.count - a.count || b.stake_lamports - a.stake_lamports : (a, b) => b.stake_lamports - a.stake_lamports;
  return [...list].sort((a, b) => {
    const va = acc(a), vb = acc(b);
    if (va < vb) return -1 * m;
    if (va > vb) return 1 * m;
    return tie(a, b);
  });
}

/** Filters for the providers list: params country (list), tag (list), level, q (search). */
/**
 * Filters for the providers list: params country, tag, city (lists, "!value" excludes),
 * level, size, infra, net, perf (single values, "!value" = everything but), q (search).
 */
export function filterProviders(list, params) {
  let out = list;
  const lst = (k) => (params.get(k) || '').split(',').map(v => v.trim()).filter(Boolean);
  out = applyListFilter(out, lst('country'), e => e.countries.map(c => c.cc));
  out = applyListFilter(out, lst('tag'), e => e.tags);
  out = applyListFilter(out, lst('city'), e => e.cities.map(c => `${c.city}|${c.cc || '??'}`));
  // single-value keys: a "!" prefix negates the predicate
  const single = (key, preds) => {
    const raw = params.get(key);
    if (!raw) return;
    const neg = raw.startsWith('!');
    const val = neg ? raw.slice(1) : raw;
    const pred = preds[val];
    if (!pred) return;
    out = out.filter(e => (neg ? !pred(e) : pred(e)));
  };
  single('level', { critical: e => e.level === 'critical', warning: e => e.level === 'warning', ok: e => e.level === 'ok' });
  single('size', { '0': e => e.count === 0, '1': e => e.count === 1, '2-5': e => e.count >= 2 && e.count <= 5, '6-20': e => e.count >= 6 && e.count <= 20, '21+': e => e.count >= 21 });
  single('infra', { net: e => e.net_total > 0, mc: e => e.multicast > 0, dz: e => e.dz > 0, bam: e => e.bam > 0, sfdp: e => e.sfdp > 0, none: e => e.dz === 0 && e.bam === 0 });
  single('perf', { '1': e => e.perf_quarter === 1, '2': e => e.perf_quarter === 2, '3': e => e.perf_quarter === 3, '4': e => e.perf_quarter === 4 });
  { const raw = params.get('net'); if (raw) { const neg = raw.startsWith('!'); const k = neg ? raw.slice(1) : raw; out = out.filter(e => { const has = (e.net?.[k] || 0) > 0; return neg ? !has : has; }); } }
  const q = (params.get('q') || '').trim().toLowerCase();
  if (q) out = out.filter(e => e.provider.toLowerCase().includes(q) || e.asns.some(a => a.asn.toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q)) || e.cities.some(c => c.city.toLowerCase().includes(q)));
  return out;
}
