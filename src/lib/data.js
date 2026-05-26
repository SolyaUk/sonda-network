// src/lib/data.js
export const R2_BASE = 'https://data.sonda.network';
export const CLUSTERS = ['mainnet-beta', 'testnet', 'devnet', 'alpenglow-community'];
export const DEFAULT_CLUSTER = 'mainnet-beta';

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