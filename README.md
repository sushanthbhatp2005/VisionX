# VisionX — Social Media Intelligence (demo)

A runnable frontend demo of the VisionX social-media analytics platform. It is
built as a working intelligence console rather than an informational website:
the whole thing runs off a live-updating synthetic stream, and every screen is
part of one pipeline — **Collect → Analyse → Predict → Alert → Act**.

**Live demo: https://sushanthbhatp2005.github.io/VisionX/**

To run it locally:

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

The dashboard runs standalone on an in-browser simulation — that is what the
live link above is. It also speaks to a real [FastAPI backend](backend/) when
one is running: it probes on load, and the top bar shows **LIVE** or
**SIMULATED** so you always know which you are looking at.

```bash
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## The demo flow

Click **Guided demo** in the top bar. It walks the ten stages of a single
incident, driving the app as it goes (navigating pages, escalating the topic,
firing alerts):

1. Select `#TrafficBengaluru`
2. A volume spike is detected
3. Sentiment turns negative
4. Emotion resolves to anger (not fear — they behave differently)
5. The network names the accounts actually driving it
6. It crosses platforms: Reddit → X → YouTube → Instagram
7. Virality is predicted at 87%, peak ~4h out
8. Crisis risk goes HIGH — one composite alert, not five separate ones
9. The system explains *why* it is happening
10. And recommends what to do next

That last step is the point of the whole demo: analysis becomes a decision.

## Pages

| Route | What it shows |
| --- | --- |
| `/` | Overview — KPIs, headline conversation, differentiators |
| `/dashboard` | Live analytics — volume + forecast, sentiment, emotion, platforms, stance, geography, annotated stream |
| `/explorer` | Topic explorer — every signature panel for one topic |
| `/network` | Influence network — force graph, cascade replay, communities, influence scores, coordination watch |
| `/compare` | Compare topics — two conversations side by side across every metric |
| `/alerts` | Alert board with an alert simulator |
| `/report` | Intelligence brief with JSON / CSV / PDF export |

## Backend

[`backend/`](backend/) is a FastAPI service that serves the identical payload
shapes, so the UI needs no changes to run against it:

- **WebSocket** `/ws/stream` — snapshot on connect, delta per tick
- **Fitted forecasting** — Holt-Winters via statsmodels, refitted on a timer in
  a worker thread, with real prediction intervals
- **Topic discovery** — BERTopic over harvested news, cached and served
- **Computed network analysis** — PageRank, Louvain and betweenness via networkx
- **Computed coordination detection** — shingle clustering with calibrated
  thresholds
- **Real NLP** — XLM-R sentiment and a DistilRoBERTa emotion head, with the
  rule layer taking over for romanised code-mix and sarcasm where the models
  measurably under-read
- **Real ingestion** — Reddit and RSS work with no credentials; YouTube and X
  take keys
- **Real stores** — TimescaleDB, Neo4j, Qdrant and Redis via `docker compose`,
  each falling back to an in-process equivalent independently

Nothing about it is required. With no backend, no models and no containers the
dashboard behaves exactly as it does on the live link. See
[`backend/README.md`](backend/README.md).

## Signature features

- **Why is this trending?** — the causal chain behind a spike (who seeded it,
  what migrated, what merged, what amplified it), each step weighted.
- **Virality prediction** — probability, predicted peak size, time-to-peak, and
  the six factors that produced the number.
- **Fitted volume forecast** — Holt-Winters with additive trend and daily
  seasonality (statsmodels), fitted on a three-day series. The 95% band comes
  from the fit's residual variance and widens with √h, rather than from a
  formula. The chart badge names the model and the number of points it was
  fitted on; standalone it says `projected curve` instead of naming one.
- **Early crisis detection** — fires on a *combination*: spike + negative
  sentiment velocity + emotion intensity + geographic concentration +
  cross-platform propagation + anomalous account activity.
- **Cross-platform propagation** — origin platform, per-hop delay, volume
  carried, and sentiment degradation along the chain.
- **Influence score** — reach × engagement × centrality × topic relevance ×
  amplification, where centrality is **PageRank computed by networkx** over the
  interaction graph. The largest account (8.4M followers, PageRank 0.0451)
  is not the one at the centre (612k followers, PageRank 0.0768). Nothing tells
  the algorithm that; it falls out of the graph.
- **Discovered topics** — BERTopic over a harvested corpus of ~1,000 real news
  articles: multilingual embeddings → UMAP → HDBSCAN → c-TF-IDF labels, with
  nothing named in advance. It independently rediscovers topics we do track
  (`traffic, flyover, metro, corridor`) *and* surfaces ones nobody defined
  (`ai, openai, meta, google` — the largest cluster in the corpus). 34% is
  labelled noise rather than forced into a topic.
- **Louvain communities** — detected, not assigned. Four communities at
  modularity 0.45, and the low-quality amplifier ring is isolated at 100%
  purity without being labelled as suspicious first.
- **Coordination detection** — computed: posts clustered by 3-word shingle
  similarity inside a time window, scored on distinct accounts, narrative
  overlap and timing. Thresholds calibrated against measured separation
  (coordinated reposts 0.32–0.91 Jaccard; a fact-check on the same topic in the
  same minute, 0.000).
- **Indic + code-mix** — Hinglish and Kannada-English handled natively; 23% of
  the corpus is code-mixed.
- **Sarcasm resolution** — surface sentiment vs. resolved intent, shown side by
  side ("Amazing. Another 5-hour jam. Love this city." → negative, 94% sarcasm).
- **Misinformation risk** — a score with its contributing factors attached, and
  coordinated activity labelled "potentially coordinated", never "bots".
- **Insight fusion score** — sentiment × emotion × topic × community ×
  influence × time × spread, with every driver and weight exposed.
- **Conversation DNA** — the whole story of a topic on one strip.
- **Emotion transitions** — the phase ladder a conversation climbs (Neutral →
  Concern → Anger → Mobilisation, or the positive branch), where it sits now,
  and the next likely phase with a probability and an ETA. Anger plus volume
  escalates; fear plus volume disperses — the phase is what changes the response.
- **Cascade replay** — scrub or play a single post travelling through the
  network, with accounts reached, follower reach and hop depth at each moment.
- **Related conversations** — topics that are merging, adjacent, spilling over
  or competing for the same attention. A merging pair has to be briefed as one.
- **Topic comparison** — any two topics side by side across ten metrics, with
  the worse side marked, emotion profiles overlaid, and both phase ladders.
- **Recommended actions** — ranked, each with the evidence that produced it.

## Demo aids

- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — a 6-minute walkthrough with
  timings, what to click, what to say at each step, and prepared answers for
  the questions judges actually ask (including "what isn't built yet").
- [`docs/architecture.svg`](docs/architecture.svg) — the pipeline diagram,
  1600×900 on a dark background, mapping every stage to the screen that
  implements it. Drops straight into a 16:9 slide.

## Controls

- **Guided demo** — the ten-step walkthrough above.
- **Pause / play** — stop the stream to talk over a frozen screen.
- **1x / 2x / 4x** — stream speed.
- **Reset** — back to the starting state.
- The **alert simulator** on `/alerts` fires any rule by hand.

## How it is put together

```
src/
  data/seed.js       synthetic corpus: topics, accounts, edges, posts, geography
  data/narrative.js  emotion phases, topic relationships, cascade derivation
  data/analysis.json computed PageRank/Louvain/coordination (from networkx)
  data/engine.js     pure simulation + scoring functions (no React)
  store/LiveContext  the clock: ticks the series, streams posts, raises alerts
  components/        charts, insight panels, network graph, live feed
  pages/             the seven screens
```

`data/engine.js` holds every derived score (`fusionScore`, `crisisFactors`,
`viralityFactors`, `buildForecast`) as a pure function, and `LiveContext` is the
only stateful piece. To point this at the real backend, replace the interval in
`LiveContext` with a WebSocket subscription — the payload shapes are already
what the FastAPI insight-fusion layer would emit. Nothing in `components/` or
`pages/` needs to change.

Stack: React 18, Vite, Tailwind, Recharts, and a small hand-rolled force layout
for the network graph (no heavy graph dependency).

`.claude/launch.json` is a convenience config for launching the dev server from
Claude Code when this folder is opened as the working directory.

## Deployment

Every push to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`.

One-time setup, needed before the first deploy succeeds: in the repository,
go to **Settings → Pages → Build and deployment** and set **Source** to
**GitHub Actions**. The workflow cannot do this for you — creating a Pages
site needs `administration` permission, which the default `GITHUB_TOKEN` does
not have. The equivalent from a terminal, if the dropdown is being awkward:

```bash
gh api -X POST repos/OWNER/REPO/pages -f build_type=workflow
```

Pages serves the site from a subpath, so `vite.config.js` sets
`base: '/VisionX/'` for builds while leaving the dev server at the root. The app
uses `HashRouter`, so deep links survive a refresh without any 404 fallback.

`npm run preview` mirrors the deployed path — it serves at
http://localhost:4173/VisionX/, not the root.

## A note for the demo

All data is synthetic. Accounts, posts and incidents are fictional and are
labelled as such in the UI footer and in the exported report. Location data is
presented aggregated, and misinformation / coordination scores are framed as
risk indicators for human review rather than determinations — which is also the
honest position to take when a judge asks about false positives.
