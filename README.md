# Token Radar 4 — pre-token protocols ranked by implied value

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hayhahen-ui/token-radar-01-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![reward](https://make.fun/badge/token-radar-01/hayhahen-ui/token-radar-01-entry/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry for the [make.fun bounty token-radar-01](https://make.fun/bounty/token-radar-01):
build the best token launch radar. The program reads the sealed DefiLlama
snapshot, scores every pre-token protocol with the radar-4 model, and writes a
ranked board, a dashboard and a dossier.

## The model (radar-4)

```
implied = round( tvl_usd x 0.25 x category x growth x maturity x chains x scale )
```

- **Base** is TVL times 0.25.
- **Category** is the median market-cap-to-TVL of the live-token protocols in
  the same category, divided by the median over all live-token protocols,
  shrunk toward 1.0 by n / (n + 3) where n is the category's live sample
  count, then clamped to [0.5, 2.0]. A category with fewer than 3 live samples
  scores 1.0. A multiple from three protocols is a rumour, one from thirty is
  a market. The multiples are computed from the snapshot itself at run time;
  no protocol name is ever special-cased.
- **Growth** is the seven-day TVL change clamped to [-60, 120] per cent. A rise
  counts at weight 0.5, a fall at weight 1.0, so a shrinking protocol is
  punished twice as hard. A protocol with no reported seven-day move scores
  0.98: no momentum evidence is not the same as flat momentum.
- **Maturity** is 0.6 plus up to 0.4 for the first 1,095 days listed, plus up to
  0.15 more for the next 1,095 days. Age is the time since the protocol was
  first listed; an unlisted age uses 365 days.
- **Chains** adds 0.04 per extra chain, up to 5 extra chains.
- **Scale** is the protocol's TVL divided by its category's median TVL,
  clamped to [0.8, 1.25]. Within a category, the largest protocols are the
  ones a token would price highest. The medians are computed from the
  snapshot itself at run time.

The board covers all 40 watchlist protocols and adds the pre-token protocols
below the $50M floor with the most TVL, for 226 rows. Live-token protocols
are set aside with their market caps shown, never mixed into the ranking.
Every row carries an eight-step farm plan with concrete costs and times,
derived from the protocol's category, chains, TVL and age — including the
chain's own typical gas cost, so the same step costs $8 on Ethereum and
$0.05 on Polygon. The eighth step totals the plan: the capital that stays in
the position, the gas across every transaction the plan makes, and the
minimum hold.

## The dashboard

`dashboard/` is a static page with no network: a sortable, filterable board
(sort every column, filter by category and chain, filter watchlist-only,
filter pre-token vs live token, search by name, category or chain), a detail view for each protocol
with the full model breakdown (base x category x growth x maturity x chains
x scale) and its farm plan, a Top-10 chart, a category breakdown, a
value-against-size scatter that shows what the model adds beyond TVL, a
compare tray for up to three protocols, and a "How the radar scores" section
with the category multiples table, the scale references and a worked example
for the rank-1 row.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

Node 22.18 or later, standard library only, no network. The run writes
`out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and
`out/dossier.json`. Run it twice: both runs write identical bytes.

## Layout

- `main.ts` — reads the snapshot, builds the board, writes the outputs
- `lib/model.ts` — the radar-4 model, the board builder and the farm plans
- `vendor/makefun-board.ts` — make.fun's dossier library (vendored)
- `dashboard/` — the static page (index.html, app.css, app.js, charts.css, charts.js)
- `screenshots/` — board, detail and filtered views of the dashboard

## License

MIT. See LICENSE.
