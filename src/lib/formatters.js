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
// Client/software palette (canonical, must match Software card on homepage).
// Family-based: clients in the same family share a hue. Visually distinct
// families (Jito vs Harmonic vs Frankendancer vs Firedancer) get different hues.
// Keep in sync with CLIENT_COLORS in index.astro.
// ============================================================================
const CLIENT_COLORS = {
  // Jito family — violet
  'Jito_BAM':                 '#a78bfa',
  'JitoBAM':                  '#a78bfa',
  'Jito_Labs':                '#8b5cf6',
  'Jito':                     '#8b5cf6',
  // Harmonic family — cyan
  'Harmonic':                 '#22d3ee',
  'HarmonicAgave':            '#22d3ee',
  'HarmonicFrankendancer':    '#06b6d4',
  'HarmonicFiredancer':       '#0891b2',
  'Harmonic_Major':           '#0e7490',
  'FD_Harmonic':              '#0891b2',
  // Frankendancer family — magenta
  'Frankendancer':            '#e879f9',
  // Firedancer family — orange
  'Firedancer':               '#f97316',
  'FireBAM':                  '#fb923c',
  // Standalone clients — each its own color
  'Rakurai':                  '#eab308',
  'Raiku':                    '#fbbf24',
  'Agave':                    '#14b8a6',
  'Unknown':                  '#6b7280',
};

/** Color for a client/software name. Returns muted grey if unknown. */
export function clientColor(client) {
  if (!client) return '#6b7280';
  return CLIENT_COLORS[client] || '#6b7280';
}
