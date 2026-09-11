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
