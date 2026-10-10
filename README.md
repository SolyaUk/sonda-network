# sonda.network

Public dashboard for **SONDA**, the Solana Observatory for Network Decentralization Analysis.

Solana validator network analytics: network snapshots across mainnet, testnet, devnet and the Alpenglow community cluster, verified, mapped and turned into tactical insight for validators.

Live at **[sonda.network](https://sonda.network)**.

## What this is

SONDA maps the Solana network: where validators run, who hosts them, how concentrated stake is by country, city and network provider, how validators perform, and how live infrastructure (DoubleZero, Jito BAM, Solana RPC, Harmonic) is doing.

The data is collected and cross-checked by an independent backend (four geolocation sources, Solana RPC, DoubleZero, Jito, SFDP and the other sources listed in the site footer), then published as JSON to [data.sonda.network](https://data.sonda.network). This repository is the public dashboard that reads that data.

Built by [Solya validator](https://solya.studio).

## Audience

- Validator operators checking their own standing, choosing a datacenter or comparing providers
- Stake pool operators and delegation programs doing due diligence
- Researchers, journalists and developers in the Solana ecosystem

## Pages

- `/` overview: chain vitals, live infrastructure, insights, decentralization metrics, geographic distribution, roadmap
- `/validators` every vote account with stake: filters with include and exclude, sorting, live refresh; on mainnet also ranks in four stake pools (Jito, xSHIN, SOL Strategies, JPool)
- `/validator?id=<vote account>` validator profile
- `/datacenters` network providers with locations, hosted validators, infrastructure and performance
- `/datacenter?provider=<slug>` one provider: cities, networks, validators

Every page works on four clusters: `mainnet-beta`, `testnet`, `devnet`, `alpenglow-community`.

## Stack

- [Astro 6](https://astro.build/), static shell with client-side rendering from JSON
- [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`
- Cloudflare Pages, auto-deploy from this repository
- Data fetched in the browser from Cloudflare R2 (`data.sonda.network`)

## Local development

Requires Node 22.12 or newer.

```bash
npm install
npm run dev
```

Dev server runs at `http://localhost:4321`. Data is fetched live from `data.sonda.network`, so the dashboard works locally the same way as in production.

```bash
npm run build      # static output in dist/
npm run preview    # preview the built site locally
```

## Project layout

```
src/
  components/   Header, StatusStrip, ClusterBanner, Footer
  layouts/      BaseLayout: document shell, theme init, shared UI init
  pages/        index, validators, validator, datacenters, datacenter, 404
  lib/
    data.js             fetch, cluster bootstrap, validator filtering and sorting
    validator-table.js  shared validators table and mobile cards
    providers.js        provider aggregation for the datacenter pages
    sort-menu.js        sort menu
    pools.js            stake pool ranks: chips, tooltips, filter and sort helpers (mainnet)
    ui.js               copy buttons, toasts, sticky offset, filter helpers, HTML escaping
    charts.js           donut chart, identicons
    tooltip.js          tooltip engine
    refresh.js          in-place auto refresh
    formatters.js       number formatting, client palette, rating thresholds
    compare.js          glow on changed values
  styles/       global.css, cards.css, filter-cards.css, vtable.css
```

## Data

The dashboard reads three files per cluster from `data.sonda.network/current/{cluster}/`:

- `network_summary.json`: aggregated metrics (decentralization, distributions, chain vitals, BAM, DoubleZero)
- `validators.json`: one record per validator
- `infrastructure.json`: DoubleZero devices, Jito, Harmonic and Solana endpoints

`rpc.json` (RPC nodes) is published next to them and is not used by the dashboard yet. The files are produced by the backend in [SolyaUk/sonda](https://github.com/SolyaUk/sonda).

## Cluster switching

The selected cluster is stored in `localStorage` under `sonda-cluster` (default `mainnet-beta`) and mirrored in the `?cluster=` query parameter, so links can be shared. The `<html data-cluster>` attribute drives the `--cluster-accent` CSS variable that tints the interface per cluster.

| Cluster | Accent |
|---|---|
| mainnet-beta | blue |
| testnet | magenta |
| devnet | amber |
| alpenglow-community | rose |

## Theming

Dark theme by default, toggle in the header, stored in `localStorage` under `sonda-theme`. An inline init script in the document head prevents a flash on load.

## Roadmap

| Phase | Status | What |
|---|---|---|
| 0 | Done | Backend pipeline: multi-source geolocation, R2 distribution, automated snapshots, Telegram bot for network events |
| 1 | Done | Public dashboard launched on four clusters |
| 2 | In progress | Per-page deep dives: validators table with filters, validator profiles and age, stake pool ranks, datacenters by provider, chain vitals. Next: range and region filters, validator profile redesign, methodology page |
| 3 | Planned | Historical analytics: location history, per-epoch charts, decentralization trends, endpoints monitor, events archive |
| 4 | Planned | Open data and discoverability: public API, JSON exports, attribution program, provider and location pages |
| 5 | Vision | Validator Score and Datacenter Score, embeddable widgets, alerts, watchlists, internationalization |

## Links

- Dashboard: [sonda.network](https://sonda.network)
- Live data: [data.sonda.network](https://data.sonda.network)
- X: [@SondaNetwork](https://x.com/SondaNetwork)
- Telegram channel with live network events: [t.me/sonda_network_events](https://t.me/sonda_network_events)
- Backend: [SolyaUk/sonda](https://github.com/SolyaUk/sonda)
- Built by: [Solya validator](https://solya.studio)

## License

MIT.

## Contributing

This is a public good built with limited time. Issues and pull requests are welcome. If you find a problem, open an issue with the cluster, the browser and a screenshot if possible.

For commercial inquiries or sponsorship, reach out via Telegram or X.
