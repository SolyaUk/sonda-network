// src/lib/compare.js
const STORAGE_KEY = 'sonda-prev-fetch';

export function savePreviousFetch(cluster, data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cluster, data, savedAt: Date.now() }));
  } catch (e) {}
}

export function loadPreviousFetch(cluster) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.cluster === cluster ? parsed.data : null;
  } catch (e) { return null; }
}

export function getGlowMode() {
  if (typeof window === 'undefined') return 'all';
  return localStorage.getItem('sonda-glow-mode') || 'all';
}

export function applyGlow(el, newVal, keyMetric = false) {
  if (!el) return;
  const mode = getGlowMode();
  if (mode === 'off') return;
  if (mode === 'key' && !keyMetric) return;
  const prev = el.dataset.prev;
  const newStr = String(newVal);
  if (prev !== undefined && prev !== newStr) {
    el.classList.remove('sonda-glow');
    void el.offsetWidth;
    el.classList.add('sonda-glow');
  }
  el.dataset.prev = newStr;
}

export function setTextWithGlow(id, val, keyMetric = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const stringVal = val == null ? '--' : String(val);
  applyGlow(el, stringVal, keyMetric);
  el.textContent = stringVal;
  el.classList.remove('sk-val');
}