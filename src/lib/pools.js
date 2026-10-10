/**
 * Stake pool ranks (analyzer v3.13 step 3, mainnet only). A validator record carries
 * pool_ranks: { jito, shinobi, solstrategies, jpool_perf } with only the pools where it is
 * ranked or holds pool stake; {} when nowhere; null outside mainnet and when the backend's
 * pool cache is unavailable. network_summary.json carries metrics.pools with the totals.
 *
 * Rank 1 is the best in every pool. "In the pool" means the pool's own selection gives the
 * validator a place right now: Jito steward `eligible`, xSHIN `in_pool`, SOL Strategies
 * `has_stake`, JPool `has_perf_stake`. The plain `has_stake` flag is not used for Jito and
 * JPool: there it is also true for dust and for zero stake (checked on 2026-10-08 data).
 *
 * Everything here is driven by the data: no pool_ranks on the records means no pool UI.
 */
import { fmt } from './formatters.js';
import { esc, EXT_ICON } from './ui.js';

/** One switch for every pool element on the site (chips, sort, filter, validator card, penalty). */
export const POOLS_ENABLED = true;

// key = field in pool_ranks; id = value in URLs (pool=..., sort=...), letters only;
// kind = the short note next to the name on a validator page tile: it shares one line with the
// name and the external-link mark, so it stays short (full carries the whole wording);
// member / out = status of one validator, many = the same for a count of validators
export const POOLS = [
  { key: 'jito', id: 'jito', name: 'Jito', kind: 'JitoSOL steward', full: 'Jito (JitoSOL steward)', url: 'https://www.jito.network/stakenet/steward/', wide: true, member: 'eligible', out: 'not eligible', many: 'eligible' },
  { key: 'shinobi', id: 'xshin', name: 'xSHIN', kind: 'Shinobi Systems', full: 'xSHIN (Shinobi Systems)', url: 'https://xshin.fi/', logo: 'xshin.png', member: 'in the pool', out: 'not in the pool', many: 'in the pool' },
  { key: 'solstrategies', id: 'solstrategies', name: 'SOL Strategies', kind: 'StakeWiz', full: 'SOL Strategies (StakeWiz score)', url: 'https://stakewiz.com/', logo: 'solstrategies.png', member: 'has pool stake', out: 'no pool stake', many: 'with pool stake' },
  { key: 'jpool_perf', id: 'jpool', name: 'JPool', kind: 'performance rank', full: 'JPool performance', url: 'https://jpool.one/', logo: 'jpool.svg', member: 'receives performance stake', out: 'no performance stake', many: 'with performance stake' },
];
const BY_ID = new Map(POOLS.map(p => [p.id, p]));
export function poolById(id) { return BY_ID.get(id) || null; }

export function poolEntry(r, key) {
  const p = r?.pool_ranks;
  return p && typeof p === 'object' ? (p[key] || null) : null;
}

export function inPool(r, key) {
  const e = poolEntry(r, key);
  if (!e) return false;
  if (key === 'jito') return e.eligible === true;
  if (key === 'shinobi') return e.in_pool === true;
  if (key === 'jpool_perf') return e.has_perf_stake === true;
  return e.has_stake === true;
}

/** Ids of the pools the validator holds a place in (accessor for the pool= filter). */
export function poolIdsOf(r) {
  if (!POOLS_ENABLED) return [];
  return POOLS.filter(p => inPool(r, p.key)).map(p => p.id);
}

/** Rank in a pool by pool id, or null: the sort accessor. */
export function poolRankById(r, id) {
  const p = BY_ID.get(id);
  const rank = p ? poolEntry(r, p.key)?.rank : null;
  return typeof rank === 'number' ? rank : null;
}

/**
 * Which pools the cluster's records have: { pools: bool, pool_<id>: bool }. Merged into
 * tableAvailability(), so sort items and chips appear only where the data exists.
 */
export function poolAvailability(records) {
  const out = { pools: false };
  for (const p of POOLS) out[`pool_${p.id}`] = false;
  if (!POOLS_ENABLED) return out;
  for (const r of records || []) {
    const pr = r?.pool_ranks;
    if (!pr || typeof pr !== 'object') continue;
    for (const p of POOLS) if (pr[p.key]) { out[`pool_${p.id}`] = true; out.pools = true; }
  }
  return out;
}

export function poolMeta(summary, key) {
  return summary?.metrics?.pools?.pools?.[key] || null;
}

/**
 * Stale pool data is dimmed, with the reason in the tooltip. Limits from the backend
 * (2026-10-04): Jito scores once per 10 epochs, so up to 12 epochs behind is normal; xSHIN
 * refreshes several times per epoch (6 hours); StakeWiz every 30 minutes (3 hours); JPool
 * once per epoch (2 epochs). The clock is the snapshot's own timestamp, not the browser's.
 */
const HOUR = 3600 * 1000;
export function poolStaleReason(key, summary, entry = null) {
  const block = summary?.metrics?.pools;
  const meta = block?.pools?.[key] || null;
  if (meta?.error) return 'The pool source failed on the last run: these are the numbers of the last good one';
  if (block?.stale) return 'Pool data in this snapshot is more than 4 hours old';
  const epoch = summary?.epoch;
  const srcEpoch = meta?.source_epoch ?? entry?.source_epoch;
  const updated = Date.parse(meta?.updated ?? entry?.updated ?? '');
  const now = Date.parse(summary?.timestamp ?? '');
  const behind = epoch != null && srcEpoch != null ? epoch - srcEpoch : null;
  const hours = Number.isFinite(updated) && Number.isFinite(now) ? (now - updated) / HOUR : null;
  if (key === 'jito' && behind != null && behind > 12) return `Scored ${behind} epochs ago`;
  if (key === 'jpool_perf' && behind != null && behind > 2) return `Ranked ${behind} epochs ago`;
  if (key === 'shinobi' && hours != null && hours > 6) return `Pool data is ${Math.round(hours)} hours old`;
  if (key === 'solstrategies' && hours != null && hours > 3) return `Pool data is ${Math.round(hours)} hours old`;
  return null;
}

// Jito steward binary criteria (jito.network/docs/stakenet/jito-steward): one failed
// criterion zeroes the score. Limits are set by governance, so the texts carry no numbers.
const JITO_FAILED = {
  delinquency: 'low vote credits in a recent epoch',
  commission: 'commission above the limit',
  historical_commission: 'commission was above the limit in the past',
  mev_commission: 'MEV commission above the limit',
  blacklisted: 'blacklisted by Jito governance',
  superminority: 'in the superminority',
  running_bam: 'not enough BAM connection',
  merkle_root_upload_authority: 'MEV upload authority is not TipRouter',
  priority_fee_commission: 'priority fee commission above the limit',
  priority_fee_merkle_root_upload_authority: 'priority fee upload authority is not TipRouter',
};
export function jitoFailedText(codes) {
  return (Array.isArray(codes) ? codes : []).map(c => JITO_FAILED[c] || String(c).replace(/_/g, ' '));
}

/**
 * xSHIN gives its reasons as free text. They are shown as the pool states them, except the
 * blacklist ones, which name other validators and groups: those read "blacklisted by the
 * pool". The text comes from a third party, so it is cut to a sane length; callers escape it.
 */
export function shinobiReasonText(list) {
  const out = (Array.isArray(list) ? list : []).map(t => {
    const s = String(t || '').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (/^blacklisted/i.test(s)) return 'blacklisted by the pool';
    const cut = s.length > 70 ? `${s.slice(0, 67)}...` : s;
    return cut.charAt(0).toLowerCase() + cut.slice(1);
  }).filter(Boolean);
  return [...new Set(out)];
}

const solText = (v) => `${fmt(Math.round(v || 0))} SOL`;

/** An xSHIN score (a share of 1) as a percent with every digit the pool gives: 0.999645 is 99.9645%. */
export function fmtScorePct(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '';
  return v >= 0 && v <= 1.0001 ? `${(v * 100).toFixed(4)}%` : v.toFixed(4);
}

/**
 * Everything the site says about one validator in one pool:
 * { pool, entry, rank, total, member, stakeSol, status, reasons[], noReason, facts[],
 *   poolFacts[], penalty, penaltyParts[], stale }, or null when the record has no entry.
 * facts are the validator's own numbers in the pool: { label, value, note?, tone? };
 * poolFacts are plain sentences about the pool itself.
 */
export function poolInfo(r, pool, summary) {
  const e = poolEntry(r, pool.key);
  if (!e) return null;
  const meta = poolMeta(summary, pool.key) || {};
  const member = inPool(r, pool.key);
  const rank = typeof e.rank === 'number' ? e.rank : null;
  // A pool's own list can hold validators that are no longer in the cluster (StakeWiz ranks
  // about 1,200 with under 700 of them here): "rank 5 of 1,215" then reads as a wrong count
  // of validators. The total is given only while it stays close to the number matched here.
  const total = meta.total_ranked != null && (meta.matched == null || meta.total_ranked <= meta.matched * 1.25) ? meta.total_ranked : null;
  const stakeSol = typeof e.stake_sol === 'number' ? e.stake_sol : 0;
  const reasons = [];
  const facts = [];
  const poolFacts = [];
  let noReason = false;
  if (pool.key === 'jito') {
    if (!member && e.eligible === false) reasons.push(...jitoFailedText(e.failed));
    if (meta.eligible != null) poolFacts.push(`${fmt(meta.eligible)} validators eligible${meta.places != null ? `, ${fmt(meta.places)} places` : ''}`);
    if (meta.source_epoch != null) poolFacts.push(`Scored in epoch ${meta.source_epoch}`);
  } else if (pool.key === 'shinobi') {
    if (!member) reasons.push(...shinobiReasonText(e.noneligibility));
    // The pool holds `places` validators: a rank inside that number is a score high enough
    // for a place, a rank outside it is not. The pool does not say more than that.
    const inTop = rank != null && meta.places > 0 ? rank <= meta.places : null;
    if (typeof e.score === 'number') {
      facts.push({ label: 'Score', value: fmtScorePct(e.score), note: inTop == null ? '' : `${inTop ? 'in' : 'below'} the top ${fmt(meta.places)} (pool size)`, tone: inTop == null ? '' : (inTop ? 'good' : 'bad') });
    }
    // a score high enough, no place and no reason given: said in words, the chip alone is mute
    noReason = !member && inTop === true && reasons.length === 0;
    if (meta.places != null) poolFacts.push(`The pool holds ${fmt(meta.places)} validators`);
  } else if (pool.key === 'solstrategies') {
    if (typeof e.score === 'number') facts.push({ label: 'StakeWiz score', value: e.score.toFixed(2) });
    if (meta.places != null) poolFacts.push(`${fmt(meta.places)} validators with pool stake`);
  } else if (pool.key === 'jpool_perf') {
    if (typeof e.perf_stake_sol === 'number' && e.perf_stake_sol > 0) facts.push({ label: 'For performance', value: solText(e.perf_stake_sol) });
    if (meta.places != null) poolFacts.push(`${fmt(meta.places)} validators receive performance stake`);
  }
  const status = member ? pool.member : (pool.key === 'jito' && e.eligible == null ? 'not ranked' : pool.out);
  // the StakeWiz location penalty travels on the SOL Strategies entry
  const penalty = pool.key === 'solstrategies' && typeof e.location_penalty === 'number' ? e.location_penalty : null;
  return { pool, entry: e, rank, total, member, stakeSol, status, reasons, noReason, facts, poolFacts, penalty, penaltyParts: penalty != null ? penaltyParts(e) : [], stale: poolStaleReason(pool.key, summary, e) };
}

const capFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** StakeWiz location penalty: 0 is no penalty, negative is points taken off the StakeWiz score. */
export function fmtPenalty(v) {
  if (v == null || Number.isNaN(v)) return '';
  const n = Math.abs(v) < 0.005 ? 0 : v;
  return n === 0 ? '0' : n.toFixed(Math.abs(n) >= 10 ? 1 : 2);
}
export const PENALTY_TIP = 'StakeWiz takes these points off a validator\'s score for stake concentration in its network (ASN), in its city and in the two together. SOL Strategies delegates by that score.';

/** The parts of a location penalty that are not zero: [['network (ASN)', -0.22], ['city', -0.22]]. */
export function penaltyParts(entry) {
  const c = entry?.components;
  if (!c || typeof c !== 'object') return [];
  return [
    ['network (ASN)', c.asn_concentration_score],
    ['city', c.city_concentration_score],
    ['network and city', c.asncity_concentration_score],
    ['TPU address', c.tpu_ip_concentration_score],
  ].filter(([, v]) => typeof v === 'number' && Math.abs(v) >= 0.005);
}

/**
 * One tile of the "Stake pools" card on the validator page: logo and name (a link to the
 * pool's own site, marked as external like every link that leaves SONDA), rank, status and pool stake, then a zone of rows: the pool's reasons, the
 * validator's numbers as "label ... value", and what the pool itself looks like.
 */
export function poolTileHtml(info) {
  const { pool } = info;
  const rank = info.rank != null ? `<b>#${fmt(info.rank)}</b>${info.total != null ? `<span>of ${fmt(info.total)}</span>` : ''}` : '<b>\u2013</b><span>no rank</span>';
  const stake = info.stakeSol >= 0.5 ? `${solText(info.stakeSol)} <small>pool stake</small>` : '<small>no pool stake</small>';
  const kv = (label, value, cls = '', attrs = '') => `<div class="v-pool-kv${cls}"${attrs}><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  const rows = [];
  for (const t of info.reasons) rows.push(`<div class="v-pool-note is-bad">${esc(capFirst(t))}</div>`);
  if (info.noReason) rows.push('<div class="v-pool-note">No reason listed by the pool</div>');
  for (const f of info.facts) {
    rows.push(kv(f.label, f.value));
    if (f.note) rows.push(`<div class="v-pool-note is-right${f.tone ? ` is-${f.tone}` : ''}">${esc(capFirst(f.note))}</div>`);
  }
  if (info.penalty != null) {
    rows.push(kv('Location penalty', fmtPenalty(info.penalty), '', ` data-tip="${esc(PENALTY_TIP)}"`));
    for (const [label, v] of info.penaltyParts) rows.push(kv(label, fmtPenalty(v), ' is-sub'));
  }
  for (const t of info.poolFacts) rows.push(`<div class="v-pool-note">${esc(t)}</div>`);
  if (info.stale) rows.push(`<div class="v-pool-note is-warn">${esc(info.stale)}</div>`);
  // the logo keeps its colour while the pool stakes here at all (JPool outside the performance
  // pot, a Jito position being unstaked); 1 SOL is the minimum a pool leaves on a stake account
  const state = info.member ? 'is-in' : (info.stakeSol > 1.5 ? 'is-staked' : 'is-out');
  return `<div class="v-pool ${state}${info.stale ? ' is-stale' : ''}">
    <div class="v-pool-head"><a class="v-pool-name" href="${pool.url}" target="_blank" rel="noopener" data-tip="Pool website, opens in a new tab">${poolLogoHtml(pool)}${pool.wide ? '' : esc(pool.name)}${EXT_ICON}</a><span class="v-pool-kind" data-tip-ellipsis>${esc(pool.kind)}</span></div>
    <div class="v-pool-rank">${rank}</div>
    <span class="v-pool-pill">${esc(info.status)}</span>
    <div class="v-pool-stake">${stake}</div>
    ${rows.length ? `<div class="v-pool-rows">${rows.join('')}</div>` : ''}
  </div>`;
}

/**
 * Tooltip of a pool chip: one fact per line, for an anchor with data-tip-rich. A line may
 * open with a tone of the tooltip engine: {head}, {good}, {bad}, {sub}, {dim}, {warn}.
 */
export function poolTip(info) {
  const lines = [`{head}${info.pool.full}`];
  const rankTxt = info.rank != null ? `Rank ${fmt(info.rank)}${info.total != null ? ` of ${fmt(info.total)}` : ''}` : 'No rank';
  lines.push(`${info.member ? '{good}' : ''}${rankTxt} \u00b7 ${info.status}`);
  for (const t of info.reasons) lines.push(`{bad}${capFirst(t)}`);
  if (info.noReason) lines.push('{dim}No reason listed by the pool');
  if (info.stakeSol >= 0.5) lines.push(`Pool stake here: ${solText(info.stakeSol)}`);
  for (const f of info.facts) lines.push(`${f.tone ? `{${f.tone}}` : ''}${f.label}: ${f.value}${f.note ? ` \u00b7 ${f.note}` : ''}`);
  if (info.penalty != null) {
    lines.push(`Location penalty: ${fmtPenalty(info.penalty)}`);
    for (const [label, v] of info.penaltyParts) lines.push(`{sub}${label}: ${fmtPenalty(v)}`);
  }
  for (const t of info.poolFacts) lines.push(`{dim}${t}`);
  if (info.stale) lines.push(`{warn}${info.stale}`);
  return lines.join('\n');
}

/** Pool logo: a round mark, or the Jito wordmark in its dark-theme and light-theme versions. */
export function poolLogoHtml(pool, cls = '') {
  if (pool.wide) {
    return `<span class="plogo plogo-wide ${cls}"><img class="plogo-dark" src="/pools/jito-dark.png" alt="${esc(pool.name)}" width="182" height="72" loading="lazy"><img class="plogo-light" src="/pools/jito-light.png" alt="${esc(pool.name)}" width="182" height="72" loading="lazy"></span>`;
  }
  return `<span class="plogo ${cls}"><img src="/pools/${pool.logo}" alt="${esc(pool.name)}" width="96" height="96" loading="lazy"></span>`;
}

function chipHtml(info, extra = '') {
  const cls = `vpool${info.member ? '' : ' is-out'}${info.stale ? ' is-stale' : ''}${extra}`;
  return `<span class="${cls}" data-tip="${esc(poolTip(info))}" data-tip-rich>${poolLogoHtml(info.pool)}<b>${info.rank != null ? `#${fmt(info.rank)}` : '\u2013'}</b></span>`;
}

/**
 * Pool chips of a table row or a mobile card: the pools where the validator holds a place,
 * in the fixed pool order. When the list is sorted by a pool rank (ctx.sortKey), that pool's
 * chip goes first and is shown for every ranked validator, dimmed when it has no place.
 */
export function poolChips(r, ctx = {}) {
  if (!POOLS_ENABLED || !ctx.avail?.pools) return '';
  const pr = r?.pool_ranks;
  if (!pr || typeof pr !== 'object') return '';
  const sorted = poolById(ctx.sortKey);
  const out = [];
  if (sorted) {
    const info = poolInfo(r, sorted, ctx.summary);
    if (info && (info.member || info.rank != null)) out.push(chipHtml(info, ' is-sorted'));
  }
  for (const p of POOLS) {
    if (sorted && p.id === sorted.id) continue;
    if (!inPool(r, p.key)) continue;
    const info = poolInfo(r, p, ctx.summary);
    if (info) out.push(chipHtml(info));
  }
  return out.length ? `<span class="vpools">${out.join('')}</span>` : '';
}

/** StakeWiz location penalty of a record (0 = none, negative = points off), or null. */
export function locationPenaltyOf(r) {
  if (!POOLS_ENABLED) return null;
  const v = r?.pool_ranks?.solstrategies?.location_penalty;
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

/** Median of a list of penalties (null when the list is empty). */
export function medianPenalty(values) {
  const xs = (values || []).filter(v => typeof v === 'number' && !Number.isNaN(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

/** Tooltip (rich, see poolTip) of a "median location penalty" figure over n validators. */
export function penaltyTip(value, n) {
  const who = n === 1 ? 'One validator here' : `Median of ${fmt(n)} validators here`;
  return `{head}SOL Strategies location penalty\n${who}: ${fmtPenalty(value)}\n{dim}${PENALTY_TIP}`;
}

/**
 * Badge of a median location penalty (provider row, city card): the SOL Strategies mark,
 * the word and the figure. cls is the performance band class of the figure, if any.
 */
export function penaltyBadgeHtml(value, n, cls = '') {
  if (value == null || Number.isNaN(value)) return '';
  return `<span class="vbadge vbadge-pen${cls}" data-tip="${esc(penaltyTip(value, n))}" data-tip-rich>${poolLogoHtml(BY_ID.get('solstrategies'))}penalty ${fmtPenalty(value)}</span>`;
}
