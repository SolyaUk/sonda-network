# sonda.network

Public dashboard for **SONDA** — Solana Observatory for Network Decentralization Analysis.

Multi-source geo-verified analysis of validator distribution, infrastructure mapping, and network health metrics across all three Solana clusters (mainnet, testnet, devnet).

Live at **[sonda.network](https://sonda.network)**.

## What this is

SONDA maps and verifies the Solana network: where validators run, who their hosts are, how concentrated the network is geographically and by network provider, and how live infrastructure (DoubleZero, Jito BAM, Solana RPC, Harmonic) is performing.

The data is collected and cross-verified by an independent backend (4 geolocation sources, Solana RPC, DoubleZero Malbec API, Jito Kobe, SFDP), then published as JSON to [data.sonda.network](https://data.sonda.network). This repository is the public-facing dashboard that consumes that data.

Built by [Solya validator](https://solya.studio) (Brazil and Ukraine).

## Audience

- Validators checking their own standing, infrastructure coverage, performance
- Stake pool operators and delegation programs running due diligence
- Solana ecosystem researchers and developers
- SFDP context

## Stack

- [Astro 5](https://astro.build/) (static shell with JS islands)
- [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`
- Cloudflare Pages, auto-deploy from this repository
- Data fetched from Cloudflare R2 (`data.sonda.network`)

## Local development

Requires Node 22 LTS or newer.

```bash
npm install
npm run dev
```

Dev server runs at `http://localhost:4321`. Data is fetched live from `data.sonda.network` so the dashboard works the same as production locally.

```bash
npm run build      # static output in dist/
npm run preview    # preview the built site locally
```

## Project layout

```
src/
├── components/
│   ├── Header.astro             top sticky header (logo, nav, cluster, theme, social)
│   ├── StatusStrip.astro        epoch progress + LIVE pill (sticky under header)
│   └── ClusterBanner.astro      "what is this cluster" banner on testnet/devnet
├── layouts/
│   └── BaseLayout.astro         document shell + theme init script
├── pages/
│   └── index.astro              homepage (hero, pulse, live infra, insights,
│                                 decentralization metrics, path, geographic,
│                                 about + roadmap). All JS rendering inline.
├── lib/
│   ├── data.js                  R2 fetch + cluster bootstrap helpers
│   ├── compare.js               previous-fetch storage + glow-on-change helpers
│   └── formatters.js            fmt, pct, flag, rating thresholds
└── styles/
    └── global.css               theme variables, cluster tinting, scrollbar
```

## Homepage flow

```
hero → pulse row → live infrastructure → insights → decentralization metrics
  → path to better decentralization → geographic distribution → about + roadmap
```

The "Decentralization metrics" + "Path to better decentralization" pair sits next to each other on purpose: Path quantifies the gap to thresholds, the metrics show the absolute state. Reading them together is the intended flow.

## Data shape

The dashboard reads four files per cluster from `data.sonda.network/current/{cluster}/`:

- `network_summary.json` — aggregated metrics (decentralization, distributions, BAM, DZ, SFDP)
- `validators.json` — full per-validator records
- `rpc.json` — public RPC nodes
- `infrastructure.json` — DZ devices, Jito endpoints, Solana endpoints, Harmonic

Schema is documented in the project system prompt (`SONDA_NETWORK_PROMPT.md`).

## Cluster switching

State stored in `localStorage` under `sonda-cluster`. Default is `mainnet-beta`. The selected cluster is also reflected in the URL `?cluster=` query parameter so links can be shared. The `<html data-cluster>` attribute drives a `--cluster-accent` CSS variable that tints UI accents per cluster.

| Cluster | Accent |
|---|---|
| mainnet-beta | blue |
| testnet | magenta |
| devnet | amber |

## Theming

Dark theme by default. Toggle in the header. Stored in `localStorage` under `sonda-theme`. An inline init script in the document head prevents flash on load.

## Roadmap

| Phase | Status | What |
|---|---|---|
| 0 | Done | Backend pipeline (multi-source geo, R2, snapshots, Telegram event bot) |
| 1 | Done | Public dashboard launched on all three clusters |
| 2 | In progress | Per-page deep dives: validators, validator profile, endpoints, datacenters, RPC, methodology |
| 3 | Planned | Historical analytics (per-epoch snapshots, decentralization trends, events archive) |
| 4 | Planned | Open data (public API, JSON exports, attribution program) |
| 5 | Vision | Synthetic Validator Score and DC Score, embeddable widgets, alerts, watchlists, i18n |

## Links

- Dashboard: [sonda.network](https://sonda.network)
- Live data: [data.sonda.network](https://data.sonda.network)
- Twitter: [@SondaNetwork](https://x.com/SondaNetwork)
- Telegram channel (live network events): [t.me/sonda_network_events](https://t.me/sonda_network_events)
- Backend scripts: [SolyaUk/sonda](https://github.com/SolyaUk/sonda)
- Built by: [Solya validator](https://solya.studio)

## License

MIT.

## Contributing

This is a public good built with limited time. Issues and pull requests are welcome. If you find a problem, open an issue with the cluster, browser, and a screenshot if possible.

For commercial inquiries or sponsorship, reach out via Telegram or X.
