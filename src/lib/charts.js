/**
 * Shared SVG chart builders. Moved out of index.astro on 2026-09-10 so /validators
 * (breakdown cards) and future pages draw the same donut as the homepage.
 */
import { fmt } from './formatters.js';

export const PIE_PALETTE = ['#3b82f6', '#a78bfa', '#22d3ee', '#f97316', '#22c55e', '#eab308', '#ef4444', '#e879f9', '#06b6d4', '#fbbf24', '#8b5cf6', '#10b981'];

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Donut chart. items: [{label, value, color?}]. Returns { svg, legend } where legend uses
 * the donut-legend-* classes from cards.css (the homepage layout). Callers that want a
 * different legend use `svg` only.
 */
export function renderDonut(items, opts = {}) {
  if (!items || items.length === 0) return { svg: '<div style="color:var(--text-muted); font-size:0.78rem;">No data</div>', legend: '' };
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  const size = opts.size ?? 130;
  const cx = size / 2, cy = size / 2;
  const r = opts.ringR ?? 56;
  const ir = opts.innerR ?? 36;
  let angle = -Math.PI / 2;
  const segs = [];
  const legendItems = [];
  items.forEach((it, i) => {
    const frac = it.value / total;
    if (frac === 0) return;
    let pathD;
    if (frac >= 0.999) {
      pathD = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} L ${cx - 0.001} ${cy - ir} A ${ir} ${ir} 0 1 0 ${cx} ${cy - ir} Z`;
    } else {
      const a2 = angle + frac * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const ix1 = cx + ir * Math.cos(a2), iy1 = cy + ir * Math.sin(a2);
      const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle);
      const large = frac > 0.5 ? 1 : 0;
      pathD = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`;
      angle = a2;
    }
    const color = it.color || PIE_PALETTE[i % PIE_PALETTE.length];
    const title = it.title != null ? it.title : `${it.label}: ${fmt(it.value)} (${(frac * 100).toFixed(1)}%)`;
    // data-tip (shared engine) instead of <title>: immediate, same cursor and look as every
    // other tooltip on the site. Native <title> shows after a delay with no cursor change.
    segs.push(`<path d="${pathD}" fill="${color}" data-tip="${esc(title)}"></path>`);
    legendItems.push(`<div class="donut-legend-item">
      <span class="donut-legend-dot" style="background:${color}"></span>
      <span class="donut-legend-label"><span class="legend-text">${it.label}</span><span class="legend-leader"></span></span>
      <span class="donut-legend-num">${(frac * 100).toFixed(1)}%</span>
    </div>`);
  });
  return {
    svg: `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${segs.join('')}</svg>`,
    legend: legendItems.join(''),
  };
}

/**
 * Identicon for validators without an icon (F-8): a "constellation" seeded by the identity
 * pubkey, drawn inside a ring in the cluster colour so it reads as generated, not as a
 * real logo. Most points sit near the rim (80/20) so the shape fills the circle.
 */
function hash32(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function seededRandom(seed) {
  let x = hash32(seed) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
const IDENTICON_PALETTE = ['#a78bfa', '#22d3ee', '#4ade80', '#fbbf24', '#f472b6', '#60a5fa', '#fb923c', '#2dd4bf'];

export function identiconSvg(seed, size = 40, extraClass = '') {
  const rnd = seededRandom(seed || 'sonda');
  const n = 5 + Math.floor(rnd() * 3);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const outer = rnd() < 0.8;
    const d = outer ? 0.62 + rnd() * 0.3 : 0.15 + rnd() * 0.3;
    pts.push([20 + Math.cos(a) * d * 17, 20 + Math.sin(a) * d * 17]);
  }
  const col = IDENTICON_PALETTE[Math.floor(rnd() * IDENTICON_PALETTE.length)];
  const path = 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
  const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.9" fill="${col}"/>`).join('');
  return `<svg class="identicon ${extraClass}" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">` +
    `<circle cx="20" cy="20" r="18.5" fill="${col}" fill-opacity=".07"/>` +
    `<circle cx="20" cy="20" r="18.5" fill="none" stroke="var(--cluster-accent)" stroke-opacity=".7" stroke-width="1.6"/>` +
    `<path d="${path}" fill="none" stroke="${col}" stroke-opacity=".75" stroke-width="1.1" stroke-linejoin="round"/>${dots}</svg>`;
}
