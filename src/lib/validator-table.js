/**
 * Shared validator table (F-16, mock v5 2026-09-15): row renderer, mobile card renderer,
 * header with click-to-sort, stake tiers. Used by /validators and /datacenter so both
 * tables look and behave the same (sticky header, copy buttons, badges, identicon).
 *
 * Columns (table-layout: fixed, widths in vtable.css): logo+pos | Identity | Version |
 * Stake | Location | Connections | Performance | Flags. Below 1200px Connections and the
 * secondary performance badges hide; below 1000px the page shows mobile cards instead.
 */
import { fmt, fmtCompact, shortenIdentity, clientColor, displayClient } from './formatters.js';
import { isInGossip, providerOf, providerLogoUrl, providerTagsText } from './data.js';
import { copyButtonHtml } from './ui.js';
import { identiconSvg } from './charts.js';

export const SITE_ORIGIN = 'https://sonda.network';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- stake tiers: relative to the cluster (p25 / p75 / p90 of validator stake) ----------
export function computeStakeTiers(records) {
  const st = (records || []).map(r => r.activated_stake_lamports || 0).sort((a, b) => a - b);
  const n = st.length;
  if (n === 0) return { p25: 0, p75: 0, p90: 0 };
  const q = p => st[Math.min(n - 1, Math.floor(p * n))];
  return { p25: q(0.25), p75: q(0.75), p90: q(0.9) };
}

export function stakeTier(r, tiers) {
  const l = r?.activated_stake_lamports || 0;
  if (!tiers) return { level: 2, cls: 't2', label: 'Mid stake', hint: '' };
  if (l >= tiers.p90) return { level: 4, cls: 't4', label: 'Top stake', hint: 'top 10% of this cluster' };
  if (l >= tiers.p75) return { level: 3, cls: 't3', label: 'High stake', hint: 'upper quarter of this cluster' };
  if (l >= tiers.p25) return { level: 2, cls: 't2', label: 'Mid stake', hint: 'middle half of this cluster' };
  return { level: 1, cls: 't1', label: 'Low stake', hint: 'lower quarter of this cluster' };
}

export function stakeMeterHtml(r, tiers, extraClass = '') {
  const t = stakeTier(r, tiers);
  const bars = [1, 2, 3, 4].map(k => `<i class="${k <= t.level ? 'on' : ''}"></i>`).join('');
  return `<span class="stake-meter ${t.cls} ${extraClass}" data-tip="${t.label}">${bars}</span>`;
}

// ---------- formatting helpers ----------
export function fmtStakeSol(lamports) {
  const sol = (lamports || 0) / 1e9;
  if (sol >= 1e6) return `${(sol / 1e6).toFixed(1)}M`;
  if (sol >= 1e3) return `${(sol / 1e3).toFixed(1)}k`;
  return `${Math.round(sol)}`;
}

function pctPlain(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`;
}

function versionStatusCls(r) {
  if (r.version_status === 'outdated') return ' ver-outdated';
  if (r.version_status === 'ancient') return ' ver-ancient';
  return '';
}
function versionStatusTip(r) {
  if (r.version_status === 'outdated') return 'Outdated: a newer release of this client family is current';
  if (r.version_status === 'ancient') return 'Ancient: two or more releases behind the current one for this client';
  return '';
}

export function validatorHref(r, cluster) {
  return `/validator?id=${r.vote_account || r.identity_pubkey}&cluster=${cluster}`;
}
export function datacenterHref(asn, cluster, absolute = false) {
  return `${absolute ? SITE_ORIGIN : ''}/datacenter?asn=${asn}&cluster=${cluster}`;
}

// ---------- pieces ----------
export function logoHtml(r, size = 48, extraClass = '') {
  const seed = r.identity_pubkey || r.vote_account || r.name || 'sonda';
  if (r.icon_url) {
    return `<span class="vlogo-wrap ${extraClass}" style="width:${size}px;height:${size}px"><img class="vlogo" src="${esc(r.icon_url)}" alt="" width="${size}" height="${size}" loading="lazy" referrerpolicy="no-referrer" data-seed="${esc(seed)}" onerror="this.replaceWith(window.sondaIdenticon ? window.sondaIdenticon(this.dataset.seed, ${size}) : document.createTextNode(''))"></span>`;
  }
  return `<span class="vlogo-wrap ${extraClass}" style="width:${size}px;height:${size}px">${identiconSvg(seed, size)}</span>`;
}
if (typeof window !== 'undefined') {
  window.sondaIdenticon = (seed, size) => {
    const el = document.createElement('span');
    el.innerHTML = identiconSvg(seed, size);
    return el.firstChild;
  };
}

function keysHtml(r, layout = 'stack') {
  const keys = [];
  if (r.name && r.identity_pubkey) keys.push(['id', r.identity_pubkey, 'identity']);
  if (r.vote_account) keys.push(['vt', r.vote_account, 'vote account']);
  if (r.bls_pubkey) keys.push(['bls', r.bls_pubkey, 'BLS pubkey']);
  const n = layout === 'stack' ? 6 : 4;   // wider column on desktop: show more of each key
  const items = keys.map(([k, v, what]) => `<span class="vkey"><span class="vkey-l">${k}</span><span class="vkey-v">${shortenIdentity(v, n, n)}</span>${copyButtonHtml(v, `Copy ${what}`)}</span>`);
  return `<div class="vkeys vkeys-${layout}">${items.join('')}</div>`;
}

function linksHtml(r) {
  // Linked nodes on other clusters arrive with links.json (F-X3); until then records may
  // carry linked_nodes[] from v6.10. Nothing is drawn when there are none.
  const links = Array.isArray(r.linked_nodes) ? r.linked_nodes : [];
  if (links.length === 0) return '';
  const dots = links.map(l => `<i class="vlink vlink-${esc(l.cluster || '').replace(/[^a-z-]/g, '')}"></i>`).join('');
  const tip = 'Linked nodes: ' + links.map(l => l.cluster).join(', ');
  return `<div class="vlinks" data-tip="${esc(tip)}">${dots}</div>`;
}

function nameHtml(r, opts = {}) {
  const size = opts.size || '';
  if (r.name) return `<span class="vname ${size}" data-tip-ellipsis>${esc(r.name)}</span>${copyButtonHtml(r.name, 'Copy name')}`;
  return `<span class="vname vname-id ${size}" data-tip="No name registered on-chain; this is the identity pubkey">${shortenIdentity(r.identity_pubkey, 6, 6)}</span>${copyButtonHtml(r.identity_pubkey, 'Copy identity')}`;
}

function versionHtml(r) {
  const inG = isInGossip(r);
  const ver = inG ? (r.version || '—') : '—';
  const cl = inG ? displayClient(r.client_type, r.client_id_raw) : { label: '', tip: null };
  const tip = versionStatusTip(r);
  return `<div class="vver${versionStatusCls(r)}"${tip ? ` data-tip="${tip}"` : ''}>${esc(ver)}</div>` +
    (cl.label ? `<div class="vcli" style="color:${clientColor(r.client_type)}"${cl.tip ? ` data-tip="${esc(cl.tip)}"` : ''}>${esc(cl.label)}</div>` : '');
}

function commissionBadges(r) {
  const out = [];
  const c = pctPlain(r.commission);
  if (c != null) out.push(`<span class="vbadge vbadge-comm" data-tip="Inflation commission: share of staking rewards kept by the validator">comm ${c}</span>`);
  if (r.mev_commission != null) out.push(`<span class="vbadge vbadge-comm" data-tip="MEV commission: share of Jito tips kept by the validator">mev ${pctPlain(r.mev_commission / 100)}</span>`);
  return out.join('');
}

function pinHtml(r) {
  const g = r.geolocation || {};
  const cc = (g.country_code || '').toLowerCase();
  if (!isInGossip(r) || !cc || cc === '??') return `<span class="vpin vpin-none">?</span>`;
  const medium = g.confidence === 'medium' || g.confidence === 'low';
  const tip = medium
    ? `Location confidence: ${g.confidence}\nSources disagree: ${g.discrepancy_details || 'see the validator page'}`
    : `${g.city || ''}${g.city && g.country ? ', ' : ''}${g.country || g.country_code || ''}`;
  return `<span class="vpin${medium ? ' vpin-unsure' : ''}" data-tip="${esc(tip)}"><img src="https://flagcdn.com/w40/${cc}.png" alt="" loading="lazy"></span>`;
}

function locationHtml(r, ctx) {
  const g = r.geolocation || {};
  const inG = isInGossip(r);
  const city = inG ? (g.city || 'Unknown') : 'Not in gossip';
  const medium = inG && (g.confidence === 'medium' || g.confidence === 'low');
  const unsure = medium ? `<span class="vunsure" data-tip="${esc(`Location confidence: ${g.confidence}\nSources disagree: ${g.discrepancy_details || ''}`)}">?</span>` : '';
  let prov = '';
  if (inG) {
    const name = providerOf(r) || '';
    const src = providerLogoUrl(ctx.summary, name, g.asn);
    const tags = providerTagsText(ctx.summary, name);
    const logo = `<span class="dc-logo" data-initial="${esc((name || '?').charAt(0).toUpperCase())}">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
    const link = g.asn ? copyButtonHtml(datacenterHref(g.asn, ctx.cluster, true), 'Copy link to this datacenter on SONDA', 'datacenter link') : '';
    prov = `<div class="vprov">${logo}<span class="vprov-name" ${tags.length ? `data-tip="${esc([name, ...tags].join('\n'))}"` : 'data-tip-ellipsis'}>${esc(name)}</span>${link}</div>` +
      (g.asn ? `<div class="vasn">${esc(g.asn)}${copyButtonHtml(g.asn, 'Copy ASN')}</div>` : '');
  }
  return `<div class="vcity">${pinHtml(r)}<span class="vcity-name" data-tip-ellipsis>${esc(city)}</span>${unsure}</div>${prov}`;
}

export function connectionBadges(r) {
  const out = [];
  if (r.dz_connected) {
    const metro = (r.dz_metro_code || '').toUpperCase();
    out.push(`<span class="vbadge vbadge-dz" data-tip="${esc(`DoubleZero device ${r.dz_device_name || ''}${r.dz_location ? ` (${r.dz_location})` : ''}`)}">DZ${metro ? ` ${metro}` : ''}</span>`);
    if (r.dz_multicast_publisher) out.push(`<span class="vbadge vbadge-mc" data-tip="Publishes shreds via DoubleZero multicast">Multicast</span>`);
  }
  if (r.bam_node) {
    const region = (r.bam_region || '').toUpperCase().split('-')[0];
    out.push(`<span class="vbadge vbadge-bam" data-tip="${esc(`Jito BAM node ${r.bam_node}`)}">BAM${region ? ` ${region}` : ''}</span>`);
  }
  if (r.rakurai) out.push(`<span class="vbadge vbadge-rk" data-tip="Rakurai client">Rakurai</span>`);
  return out.join('');
}

export function flagBadges(r) {
  const out = [];
  if (r.delinquent) out.push(`<span class="vbadge vbadge-del" data-tip="Delinquent right now: the last vote is more than 128 slots (about a minute) behind the tip in this snapshot">Delinquent</span>`);
  if (r.is_superminority) out.push(`<span class="vbadge vbadge-sm" data-tip="Superminority: among the fewest validators that together hold a third of stake">SM</span>`);
  if (r.sfdp_state === 'Approved') out.push(`<span class="vbadge vbadge-sfdp" data-tip="Solana Foundation Delegation Program: approved">SFDP</span>`);
  if (!isInGossip(r)) out.push(`<span class="vbadge vbadge-muted" data-tip="Vote account has stake but the node is not visible in gossip">No gossip</span>`);
  return out.join('');
}

// Metrics no validator in the cluster has (slot time on alpenglow, IBRL on devnet) are not
// drawn at all, not even as dashes: a badge that never has a value is noise (principle 11.36).
export function perfBadges(r, opts = {}) {
  const avail = opts.avail || { skip: true, slot: true, vlat: true, ibrl: true };
  const pb = (cls, b, i, tip) => `<span class="vperf ${cls}" data-tip="${tip}"><b>${b}</b><i>${i}</i></span>`;
  const out = [];
  if (r._tvc_rank != null) out.push(pb('vperf-rank', `#${r._tvc_rank}`, 'TVC', `TVC rank ${r._tvc_rank} of ${r._tvc_total}: position by vote credits this epoch, ties share a rank`));
  out.push(pb('vperf-main', r.epoch_credits != null ? fmtCompact(r.epoch_credits) : '—', opts.short ? 'cr' : 'credits', `Vote credits this epoch${r.epoch_credits != null ? `: ${fmt(r.epoch_credits)}` : ''}`));
  if (!opts.short) {
    if (avail.skip) out.push(pb('vperf-sec', r.skip_rate != null ? `${r.skip_rate.toFixed(2)}%` : '—', 'skip', 'Skip rate: leader slots skipped this epoch'));
    if (avail.slot) out.push(pb('vperf-sec', r.slot_duration_median != null ? r.slot_duration_median.toFixed(0) : '—', 'ms', 'Median slot time'));
    if (avail.vlat) out.push(pb('vperf-sec', r.median_vote_latency != null ? r.median_vote_latency.toFixed(1) : '—', 'vlat', 'Median vote latency, slots'));
    if (avail.ibrl) out.push(pb('vperf-sec vperf-ibrl', r.ibrl?.ibrl_score != null ? r.ibrl.ibrl_score.toFixed(0) : '—', 'ibrl', 'IBRL score'));
  }
  return out.join('');
}

/** Which optional columns/badges have data anywhere in the cluster. */
export function tableAvailability(records) {
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

/** Toggle the Connections column on a table wrap according to availability. */
export function applyAvailability(wrapEl, avail) {
  if (!wrapEl) return;
  wrapEl.classList.toggle('hide-connections', !avail.connections);
}

// ---------- row ----------
export function renderRow(r, ctx) {
  const href = validatorHref(r, ctx.cluster);
  const conn = connectionBadges(r);
  return `<tr data-href="${href}" data-id="${esc(r.identity_pubkey)}">
    <td class="c-pos"><div class="logo-wrap">${logoHtml(r, 48)}</div>${ctx.pos != null ? `<div class="vpos" data-tip="#${ctx.pos} in this list with the current sort and filters">#${ctx.pos}</div>` : ''}</td>
    <td class="c-id"><div class="vname-row">${nameHtml(r)}</div>${keysHtml(r, 'stack')}${linksHtml(r)}</td>
    <td class="c-ver">${versionHtml(r)}</td>
    <td class="c-stake">${stakeMeterHtml(r, ctx.tiers)}<div class="vstake">${fmtStakeSol(r.activated_stake_lamports)} <small>SOL</small></div><div class="vbadges">${commissionBadges(r)}</div></td>
    <td class="c-loc">${locationHtml(r, ctx)}</td>
    <td class="c-conn"><div class="vbadges">${conn || '<span class="vdash">—</span>'}</div></td>
    <td class="c-perf"><div class="vbadges">${perfBadges(r, { avail: ctx.avail })}</div></td>
    <td class="c-flags"><div class="vbadges">${flagBadges(r)}</div></td>
  </tr>`;
}

// ---------- mobile card ----------
export function renderCard(r, ctx) {
  const href = validatorHref(r, ctx.cluster);
  const g = r.geolocation || {};
  const inG = isInGossip(r);
  const cl = inG ? displayClient(r.client_type, r.client_id_raw) : { label: '' };
  const prov = inG ? providerOf(r) : '';
  const provLogo = prov ? providerLogoUrl(ctx.summary, prov, g.asn) : '';
  // Grid: logo column (full height) | content | side (go button + perf). The logo is the
  // validator's face in the card, larger on tablets and smaller on phones (vtable.css).
  return `<div class="vcard" data-vote="${esc(r.vote_account || r.identity_pubkey)}" data-id="${esc(r.identity_pubkey)}">
    <div class="vcard-logo">${logoHtml(r, 56, 'vcard-face')}${ctx.pos != null ? `<div class="vpos">#${ctx.pos}</div>` : ''}</div>
    <div class="vcard-main">
      <div class="vname-row">${nameHtml(r, { size: 'is-card' })}${linksHtml(r).replace('class="vlinks"', 'class="vlinks is-inline"')}</div>
      <div class="vcard-line"><span class="vstake">${fmtStakeSol(r.activated_stake_lamports)} <small>SOL</small></span>${stakeMeterHtml(r, ctx.tiers, 'is-small')}<span class="vcard-sep"></span><span class="vver${versionStatusCls(r)}">${esc(inG ? (r.version || '—') : '—')}</span>${cl.label ? `<span class="vcli" style="color:${clientColor(r.client_type)}">${esc(cl.label)}</span>` : ''}</div>
      <div class="vcard-line">${pinHtml(r)}<span class="vcity-name">${esc(inG ? (g.city || 'Unknown') : 'Not in gossip')}</span>${prov ? `<span class="vcard-sep"></span><span class="dc-logo" data-initial="${esc(prov.charAt(0).toUpperCase())}">${provLogo ? `<img src="${provLogo}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span><span class="vprov-name">${esc(prov)}</span>` : ''}</div>
      <div class="vbadges vcard-badges">${connectionBadges(r)}${flagBadges(r)}${commissionBadges(r)}</div>
      ${keysHtml(r, 'row')}
    </div>
    <div class="vcard-side">
      <a class="vcard-go" href="${href}" data-tip="Open validator page" aria-label="Open validator page"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></a>
      <div class="vbadges vcard-perf">${perfBadges(r, { short: true })}</div>
    </div>
  </div>`;
}

// ---------- header ----------
// Sortable columns map to sort keys of sortValidators(); dir is the default direction.
export const HEADER_COLUMNS = [
  { cls: 'c-pos', label: '' },
  { cls: 'c-id', label: 'Validator', sort: 'name', dir: 'asc' },
  { cls: 'c-ver', label: 'Version', sort: 'version', dir: 'desc' },
  { cls: 'c-stake', label: 'Stake', sort: 'stake', dir: 'desc' },
  { cls: 'c-loc', label: 'Location', sort: 'city', dir: 'asc' },
  { cls: 'c-conn', label: 'Connections' },
  { cls: 'c-perf', label: 'Performance', sort: 'rank', dir: 'asc', hint: 'TVC' },
  { cls: 'c-flags', label: 'Flags' },
];

export function tableHeadHtml() {
  return `<colgroup>${HEADER_COLUMNS.map(c => `<col class="${c.cls}">`).join('')}</colgroup><thead><tr>${HEADER_COLUMNS.map(c => c.sort
    ? `<th class="${c.cls} th-sort" data-sort="${c.sort}" data-dir="${c.dir}" title="Sort by ${c.label.toLowerCase()}">${c.label}<span class="th-arrow" aria-hidden="true"></span>${c.hint ? `<span class="th-hint">${c.hint}</span>` : ''}</th>`
    : `<th class="${c.cls}">${c.label}</th>`).join('')}</tr></thead>`;
}

/** Reflect the active sort (key + dir) in the header. */
export function markSortedHeader(table, key, dir) {
  table.querySelectorAll('th.th-sort').forEach(th => {
    const active = th.dataset.sort === key;
    th.classList.toggle('is-active', active);
    const arrow = th.querySelector('.th-arrow');
    if (arrow) arrow.textContent = active ? (dir === 'asc' ? '\u2191' : '\u2193') : '\u2195';
  });
}

/** Header clicks: first click = column default direction, second click flips it. */
export function initHeaderSort(table, getCurrent, onChange) {
  table.addEventListener('click', (e) => {
    const th = e.target instanceof Element ? e.target.closest('th.th-sort') : null;
    if (!th) return;
    const key = th.dataset.sort;
    const cur = getCurrent();
    const dir = cur.key === key ? (cur.dir === 'asc' ? 'desc' : 'asc') : th.dataset.dir;
    onChange(key, dir);
  });
}
