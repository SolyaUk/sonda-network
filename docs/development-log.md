# SONDA: development log

SONDA shows where the Solana network runs, and how well: validators, RPC nodes and the datacenters behind them, on all four Solana clusters. Live at [sonda.network](https://sonda.network), open source and free.

- Pitch (2 min): https://youtu.be/EjsoDe2cKYA
- Tech demo (3 min): https://youtu.be/WpjFsaGEFj4
- Colosseum Crypto World's Fair project: https://colosseum.com/arena/projects/sonda-1
- Code: this repository (site) and [SolyaUk/sonda](https://github.com/SolyaUk/sonda) (data pipeline)

## How SONDA developed

| When | What happened |
|---|---|
| 2023 | First private scripts to compare datacenters, written while looking for a better home for the Solya validator. Public tools showed how many validators sit in a datacenter, but not how well they do there. |
| April-May 2026 | sonda.network launched on four Solana clusters, with network snapshots running continuously since April 25, 2026. SONDA entered the Colosseum Frontier hackathon. |
| Autumn 2026 | SONDA went through Solana Startup Terminal 2.0 by Superteam Ukraine and was pitched at a program checkpoint. |
| September 14 - October 12, 2026 | Colosseum Crypto World's Fair: four weeks of releases, all live on sonda.network (below). |
| October 12, 2026 | Final submission to Crypto World's Fair (pitch and tech demo) and to the Superteam Ukraine track. |

### Crypto World's Fair, week by week

| Weeks | Shipped | Video |
|---|---|---|
| 1-2 | New validator table and cluster status; datacenters grouped by hosting provider, with a page for every provider | https://youtu.be/rrMwvHKIX8U |
| 3 | Include and exclude filters, performance bands, providers that run Solana infrastructure without validators; Solya moved to Hong Kong and picked its datacenter on SONDA | https://youtu.be/APlhZr4jec0 |
| 4 | Validator age, ranks in four performance pools (Jito, xSHIN, SOL Strategies, JPool), the SOL Strategies location penalty for every provider, DoubleZero on testnet and Alpenglow | https://youtu.be/sVKfJKJGFWU |

During the hackathon: 22 commits with about 7,900 added lines across the two repositories. Built with Claude (Anthropic) as a coding assistant; there is no AI in the data pipeline itself.

## Roadmap

From the roadmap on [sonda.network](https://sonda.network/#about):

- **Phase 0, done (2023 - March 2026).** Backend pipeline: validator analyzer with multi-source geolocation cross-checks, data distribution on Cloudflare R2, automated snapshots, Telegram bot for live network events.
- **Phase 1, done (April - May 2026).** sonda.network launched on four clusters.
- **Phase 2, in progress (since May 2026).** Per-page deep dives. Done: validators table with include and exclude filters, validator profiles, validator age, stake pool ranks, datacenters by provider, cluster status and chain vitals. Next: range and region filters, validator profile redesign, methodology page.
- **Phase 3, planned.** Historical analytics: location history since 2021, per-epoch performance charts for validators and datacenters, decentralization trends over time, endpoint availability history, network events archive.
- **Phase 4, planned.** Open data and discoverability: public API, JSON exports, attribution program for downstream tools, provider and location pages built for search engines and AI assistants.
- **Phase 5, vision.** Validator Score and Datacenter Score, ratings built on them, embeddable widgets, custom alerts, watchlists, internationalization.
