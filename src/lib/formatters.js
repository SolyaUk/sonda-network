// src/lib/formatters.js

export function fmt(n) {
  if (n == null || Number.isNaN(n)) return '--';
  return Number(n).toLocaleString('en-US');
}

export function pct(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '--%';
  return `${Number(n).toFixed(digits)}%`;
}

export function flag(cc) {
  if (!cc || cc === '??' || cc.length !== 2) return '🌐';
  return cc.toUpperCase().split('').map(c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  ).join('');
}

export function shortenIdentity(pubkey, before = 4, after = 4) {
  if (!pubkey) return '';
  if (pubkey.length <= before + after + 3) return pubkey;
  return `${pubkey.slice(0, before)}...${pubkey.slice(-after)}`;
}

export function fmtSol(lamports, digits = 0) {
  if (lamports == null) return '--';
  const sol = lamports / 1e9;
  if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M SOL`;
  if (sol >= 1e3) return `${(sol / 1e3).toFixed(1)}K SOL`;
  return `${sol.toFixed(digits)} SOL`;
}

export function fmtTimestamp(timestamp) {
  if (!timestamp) return '--';
  return new Date(timestamp).toUTCString().replace('GMT', 'UTC');
}

export function nakRating(dim, val) {
  if (val == null) return { label: '--', cls: 'neutral' };
  if (dim === 'validator') {
    if (val >= 30) return { label: 'Healthy', cls: 'good' };
    if (val >= 15) return { label: 'Moderate', cls: 'warning' };
    return { label: 'Concentrated', cls: 'critical' };
  }
  if (val <= 2) return { label: 'Critical', cls: 'critical' };
  if (val <= 5) return { label: 'Warning', cls: 'warning' };
  if (val <= 10) return { label: 'Moderate', cls: 'warning' };
  return { label: 'Healthy', cls: 'good' };
}

export function hhiRating(val) {
  if (val == null) return { label: '--', cls: 'neutral' };
  if (val > 2500) return { label: 'Highly concentrated', cls: 'critical' };
  if (val > 1500) return { label: 'Moderately concentrated', cls: 'warning' };
  return { label: 'Competitive', cls: 'good' };
}

export function giniRating(val) {
  if (val == null) return { label: '--', cls: 'neutral' };
  if (val > 0.8) return { label: 'Very high inequality', cls: 'critical' };
  if (val > 0.6) return { label: 'High inequality', cls: 'warning' };
  if (val > 0.4) return { label: 'Moderate inequality', cls: 'neutral' };
  return { label: 'Low inequality', cls: 'good' };
}

export function smRating(val, dim) {
  if (val == null) return 'neutral';
  if (dim === 'validator') {
    if (val >= 30) return 'good';
    if (val >= 15) return 'warning';
    return 'critical';
  }
  if (val <= 2) return 'critical';
  if (val <= 5) return 'warning';
  return 'good';
}

export function shannonRating(val) {
  if (val == null) return { label: '--', cls: 'neutral' };
  if (val > 0.8) return { label: 'High diversity', cls: 'good' };
  if (val > 0.5) return { label: 'Moderate diversity', cls: 'warning' };
  return { label: 'Low diversity', cls: 'critical' };
}

// Hash-based color for software versions. Stable per version string.
// Different palette than client colors so the two cards are visually distinct.
const VERSION_PALETTE = [
  '#3b82f6', '#a78bfa', '#22d3ee', '#f97316', '#22c55e',
  '#eab308', '#ef4444', '#e879f9', '#06b6d4', '#fbbf24',
  '#8b5cf6', '#10b981', '#f43f5e', '#0ea5e9', '#84cc16',
];

export function versionColor(version) {
  if (!version || version === 'unknown') return '#6b7280';
  let hash = 0;
  for (let i = 0; i < version.length; i++) {
    hash = ((hash << 5) - hash) + version.charCodeAt(i);
    hash |= 0;
  }
  return VERSION_PALETTE[Math.abs(hash) % VERSION_PALETTE.length];
}
// ============================================================================
// Client/software palette: the one canonical map, used on every page. Family-based:
// clients of one family share a hue; grey is reserved for Unknown. Names follow the
// backend registry (agave client_ids.rs, REFERENCE R12.3).
// ============================================================================
const CLIENT_COLORS = {
  // Jito family: violet
  'JitoBAM':                  '#a78bfa',
  'Jito':                     '#8b5cf6',
  // Harmonic family: cyan
  'HarmonicAgave':            '#22d3ee',
  'HarmonicFrankendancer':    '#06b6d4',
  'HarmonicFiredancer':       '#0891b2',
  // Frankendancer family: magenta
  'Frankendancer':            '#e879f9',
  // Firedancer family: orange
  'Firedancer':               '#f97316',
  'FireBAM':                  '#fb923c',
  // Agave family: teal
  'Agave':                    '#14b8a6',
  'Paladin':                  '#5eead4',  // Agave fork (client id 4), not on any cluster yet
  // Standalone clients: each its own color
  'Rakurai':                  '#eab308',
  'Raiku':                    '#fbbf24',
  'Mithril':                  '#a3e635',  // Overclock client (gossip id 19785)
  'Sig':                      '#60a5fa',  // Syndica client (client id 7), not on any cluster yet
  'Unknown':                  '#6b7280',
};

/** Color for a client/software name. Returns muted grey if unknown. */
export function clientColor(client) {
  if (!client) return '#6b7280';
  return CLIENT_COLORS[client] || '#6b7280';
}

/**
 * Display form of a client_type. Backend passes unmapped gossip client ids through as
 * "Unknown(N)"; show them as "Unknown" and keep the raw code for the tooltip.
 * Returns { label, tip } where tip is null when nothing extra to say.
 */
export function displayClient(client, clientIdRaw) {
  if (!client) return { label: '', tip: null };
  const m = /^Unknown\((\d+)\)$/.exec(client);
  if (m) return { label: 'Unknown', tip: `Unrecognized client id ${m[1]} reported in gossip` };
  // analyzer v3.11: unknown codes arrive as client_type "Unknown" with client_id_raw
  if (client === 'Unknown' && clientIdRaw != null) return { label: 'Unknown', tip: `Unrecognized client id ${clientIdRaw} reported in gossip` };
  return { label: client, tip: null };
}

/**
 * Compact number: 1300929 -> "1.30M", 171863416367 -> "171.9B", 4321 -> "4.32k", 987 -> "987".
 * Three significant digits keep neighbouring validators distinguishable in a column.
 */
export function fmtCompact(n) {
  if (n == null || Number.isNaN(n)) return '--';
  const neg = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const sig = (v) => (v >= 99.95 ? v.toFixed(0) : v >= 9.995 ? v.toFixed(1) : v.toFixed(2));
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
  for (const [div, suffix] of units) {
    // 0.9995 guard: 999.6k rounds up to 1.00M instead of printing 1000k
    if (abs / div >= 0.9995) return neg + sig(abs / div) + suffix;
  }
  return neg + String(Math.round(abs));
}

/**
 * Short region code of a Jito BAM node from its name: "fra-mainnet-bam-2-tee" -> "FRA".
 * bam_region in the data carries the full node name, so the prefix is the only short form.
 */
export function bamRegionCode(nodeName) {
  if (!nodeName) return '';
  const head = String(nodeName).split('-')[0];
  return head ? head.toUpperCase() : '';
}
