# VisionX backend

FastAPI + WebSocket service behind the dashboard. It serves the same payload
shapes the frontend's in-browser simulation produces, so the UI runs against
either one without a code change.

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows;  source .venv/bin/activate on Unix
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then http://localhost:8000/docs for the interactive API, and
http://localhost:8000/api/health for what is actually running.

Start the frontend as usual (`npm run dev`) and it finds the backend on its
own — the top bar switches from **SIMULATED** to **LIVE**.

## It degrades instead of failing

Every subsystem has a fallback, and `/api/health` reports which one is live.
That is deliberate: a demo that dies because Redis is not running is worse
than one that quietly runs in-process.

Three tiers, not two: **configured external → SQLite → in-memory**. SQLite is
the default rather than the ceiling, so metrics and the alert board survive a
restart with nothing to install.

| Subsystem | Configured | Default | Last resort |
| --- | --- | --- | --- |
| Metrics | TimescaleDB | SQLite | in-memory ring buffer |
| Alerts | — | SQLite | in-memory deque |
| Vectors | Qdrant | SQLite | in-memory |
| Stream | Redis Streams | SQLite | in-memory deque |
| Graph | Neo4j | in-memory | (derived from the corpus; nothing to persist) |
| NLP | transformers | rule-based annotator | |
| Embeddings | sentence-transformers | hash vectors | |
| Ingestion | live collectors | off (pull on demand) | |

The database is a single file at `app/data/visionx.db` (WAL mode, one
connection behind a lock, because the tick loop and request handlers write from
different threads). Metrics are pruned to `METRICS_RETAIN_HOURS`, and
`GET /api/topics/{id}/history?hours=24` reads from it — so the window can be
longer than the process uptime, which the in-memory series could never do.

Alerts are reloaded on boot, so a restart mid-demo is not an empty board.

If a store is configured but unreachable, only that store falls back, and the
reason appears in `/api/health` under `stores.<name>.reason`.

## The NLP layer

Two annotators behind one interface, and the model path deliberately hands
work back to the rule layer where the models are weak:

- **Sentiment** — `cardiffnlp/twitter-xlm-roberta-base-sentiment`, multilingual
  and tuned on social text.
- **Emotion** — `j-hartmann/emotion-english-distilroberta-base`. English only,
  so on any other language the lexicon takes over. Left to itself it called a
  Kannada-English traffic complaint "joy".
- **Code-mix** — when XLM-R returns neutral on romanised code-mix but the
  lexicon has a clear read, the lexicon wins. `Traffic full jam agide bro` is
  neutral to the model because the complaint is carried by the Kannada half.
- **Sarcasm** — always the rule layer, and it overrides the model. A post
  reading positive with sarcasm ≥ 50 is re-scored negative, and positive
  emotions are suppressed: "Love this city" in a complaint is disgust, not joy.

The `nlp` field on every annotated post records which combination produced it,
e.g. `models + rules (code-mix)`.

Models are ~1.4 GB and download on first run. They load in a background thread,
so startup is instant and the rule annotator serves until they are ready.

```bash
pip install -r requirements-nlp.txt   # torch, transformers, BERTopic
```

That file carries a version lock worth reading before you bump anything:
`umap-learn` and `hdbscan` both call scikit-learn's
`check_array(force_all_finite=...)`, which was renamed in scikit-learn 1.6 and
removed in 1.9. umap 0.5.12 uses the new name, hdbscan 0.8.40 the old one, so
they cannot both work against a single scikit-learn. The pinned trio
(scikit-learn 1.5.2, umap-learn 0.5.7, hdbscan 0.8.40) agrees.

Without them, `NLP_BACKEND=auto` uses the rule annotator and everything still
works — the rule path is genuinely good on this corpus, because it was written
for romanised code-mix specifically.

## Network analysis

`app/graph.py` computes structure with networkx rather than asserting it. The
UI used to display a "PageRank + Louvain" chip over hand-authored numbers;
these are now the real thing:

- **PageRank** over the weighted interaction graph, normalised against the
  top-ranked account to give the `centrality` the influence score consumes.
  The authored value is kept alongside as `centrality_authored` for comparison.
- **Louvain** community detection, seeded for reproducibility. It finds 4
  communities where 7 were authored, at modularity 0.45 — and it isolates the
  amplifier ring at 100% purity without being told those accounts are suspect.
- **Betweenness** identifies the bridges that carry a topic between clusters.

Computing it surfaced a data bug immediately: the edge list contained `a1-a14`
twice with different weights, so networkx saw 56 edges where the corpus claimed
57 and the second weight silently won.

## Forecasting

`app/forecast.py` fits Holt-Winters exponential smoothing (additive trend,
additive daily seasonality) with statsmodels, replacing a shaped curve whose
confidence band came from `spread = 0.09 + p * 0.28` — it widened because the
formula said so, not because uncertainty grew.

The interval now comes from the residual variance of the fit and widens with
√h. On `#TrafficBengaluru` that is roughly ±1100 at one step out and ±3800 at
twelve, and a smoke test asserts the widening, since a formula band need not.

Daily seasonality needs whole days, so `build_fit_history()` generates a
three-day series at 5-minute spacing (864 points) shaped by a commute curve —
civic conversation peaks around 9am and 7pm and collapses overnight. The
observed window the dashboard is showing is appended to that, rescaled so the
two are continuous, and the fit sees both.

A seasonal fit is about a second per topic, so it never runs on the event loop:
fits happen in a worker thread at startup and refit every
`FORECAST_REFIT_SECONDS` (default 120). Until the first fit lands, the shaped
curve is served and the UI badge says `projected curve` rather than naming a
model.

Holt-Winters rather than Prophet deliberately: real prediction intervals, no
Stan toolchain to compile, and for a few-hour-ahead volume forecast the
changepoint and holiday machinery is not what limits accuracy. If you need the
word "Prophet" on a slide, `prophet==1.4.0` installs on this Python — but
budget minutes for the first-run Stan compile.

## Coordination detection

`app/coordination.py` replaces what was a hardcoded string — "37 accounts, 82%
identical narratives, 90-second windows" — with a computation: cluster posts by
3-word shingle similarity inside a time window, require at least three distinct
accounts, then score on account count, narrative overlap and timing.

Thresholds are calibrated against measured separation, not guessed. Reworded
reposts of one narrative score 0.32-0.91 Jaccard against each other; a
fact-check on the same topic in the same minute scores 0.000 against every one
of them. The threshold sits at 0.30, inside that gap.

On the corpus it finds 4 accounts, 53% overlap, an 81-second window, score 67 —
and correctly leaves the fact-check out.

## The vector store

`app/embeddings.py` encodes with the same multilingual sentence model discovery
uses, so it is already cached. What that buys: the hash-vector fallback is
purely lexical, so it finds reused wording and *nothing else* — a post and its
translation scored zero against each other by construction, which quietly
dropped the code-mix this project exists to handle.

Retrieval is hybrid, and each hit carries both scores:

    rank = max(semantic, 0.9 × lexical)

Measured on this corpus, querying `"stuck in a huge traffic jam for hours"`:

| document | dense | lexical |
| --- | --- | --- |
| English original | 0.852 | 0.548 |
| Kannada-English code-mix | 0.652 | 0.257 |
| **Kannada script** | **0.634** | **0.000** |
| romanised Hindi | 0.088 | low |

The Kannada-script row is the argument for a dense store: zero lexical overlap
with an English query, still matched.

**A measured limitation, stated rather than hidden:** romanised Hindi
("ORR par bahut zyada jam hai") scores 0.088. The encoder was trained on native
scripts, so casual romanised Devanagari is out of its distribution — and the
lexical half cannot rescue it either, because it shares almost no tokens with
an English query. Hybrid retrieval helps native scripts and English-heavy
code-mix; it does not solve this case. Transliterating romanised Indic to
native script before embedding would be the real fix, and is not done here.

## Topic discovery

The nine tracked topics are *defined* — someone wrote them down — and ingested
posts were only ever *routed* to one by keyword. `app/discovery.py` answers the
question that left open: where do topics come from in the first place?

BERTopic over a harvested news corpus: embed with
`paraphrase-multilingual-MiniLM-L12-v2` (multilingual on purpose — a
monolingual model buries code-mix in the outlier cluster), reduce with UMAP,
cluster with HDBSCAN, label each cluster by c-TF-IDF. Nothing is named in
advance.

On 1,014 harvested articles it finds 24 topics and calls 34% of the corpus
noise, which is HDBSCAN doing its job rather than forcing every document
somewhere. Results include:

| size | terms | |
| --- | --- | --- |
| 166 | ai, openai, meta, google | untracked |
| 47 | traffic, flyover, metro, corridor | matches the tracked traffic topic |
| 31 | food, fda, safety, fssai | untracked |
| 31 | court, plea, supreme court | untracked |

Both halves matter: it independently rediscovers a topic we do track, which
says the clustering is not noise, and it surfaces conversations nobody defined,
which is the entire point.

Discovery runs on the *harvested* corpus, never the synthetic one — clustering
generated text would only rediscover the templates it was generated from.

```bash
python tools/harvest.py --limit 100 --append   # accumulate documents
python tools/export_discovery.py               # cluster and cache the result
```

A run takes about a minute, so it is never done at request time: the exported
result is loaded at startup and served from cache. `POST /api/discovery/run`
re-runs it in a thread.

**Reddit note:** the harvester hits RSS and Reddit, but Reddit 403-blocks an IP
that fetches many subreddits in quick succession. The collector paces requests
now; if Reddit returns 403 for everything, that has happened and RSS carries
the harvest alone (which is where all 1,014 documents came from).

## Ingestion

**Reddit and RSS need no credentials and pull real posts today.** YouTube and X
need keys; without them they report themselves unavailable rather than failing.

```bash
curl -X POST "http://localhost:8000/api/ingest/run?limit=10"
```

Collected text goes through the same annotator as everything else, then gets
routed to a tracked topic by keyword. Routing requires two whole-word matches —
substring matching sent "businessman" to the traffic topic via `bus`. Below the
threshold a post stays unrouted, which is honest; a mis-routed real post
corrupts the numbers on screen.

Set `INGEST_ENABLED=true` to poll on a timer instead.

## The real storage stack

```bash
docker compose up -d
cp .env.example .env        # DSNs are pre-filled, just uncomment them
uvicorn app.main:app --reload
```

Brings up TimescaleDB, Neo4j, Qdrant and Redis. The metric table is created on
connect, as a hypertable where the extension is available.

> Not verified on this machine — Docker was not installed when this was
> written. The compose file is valid YAML and the images are the standard
> published ones, but the containers have not been started end to end.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | what is running: nlp, stores, ingest, clients |
| `GET /api/topics` | all topics with live state and fusion score |
| `GET /api/topics/{id}` | one topic, with crisis/virality factors and phases |
| `GET /api/topics/{id}/cascade` | cascade hops derived from the graph |
| `GET /api/topics/{id}/forecast` | fitted forecast with model, sigma, AIC |
| `GET /api/topics/{id}/history` | persisted metrics, survives restarts |
| `GET /api/discovery` | topics discovered by BERTopic, from cache |
| `POST /api/discovery/run` | re-run discovery in a worker thread |
| `GET /api/network` | accounts with computed PageRank/Louvain/betweenness |
| `GET /api/network/ranking` | top accounts by any computed measure |
| `GET /api/coordination` | coordinated-behaviour clusters, computed |
| `GET /api/network/neighbours/{id}` | graph query, through Neo4j when configured |
| `GET /api/feed` | recent annotated posts |
| `GET /api/alerts` | the alert board |
| `POST /api/alerts/raise` | fire an alert by rule |
| `POST /api/nlp/annotate` | annotate arbitrary text |
| `GET /api/nlp/similar` | hybrid semantic + lexical search, both scores returned |
| `POST /api/ingest/run` | pull real posts once |
| `GET /api/report/{id}` | the full intelligence brief |
| `POST /api/control/escalate` | drive the demo |
| `WS /ws/stream` | snapshot on connect, delta per tick |

## Tests

```bash
python tools/smoke_test.py
```

Exercises every route and the WebSocket against a running server, printing what
each returned. 18 checks.

## Regenerating the corpus and analysis

The synthetic corpus is exported from the frontend so both sides cannot drift:

```bash
node tools/export_corpus.mjs      # src/data/*.js  ->  app/data/corpus.json
python tools/export_analysis.py   # networkx       ->  src/data/analysis.json
```

The second one matters: GitHub Pages has no Python, but the dashboard should
still show *computed* numbers there. So networkx stays the single
implementation — it runs in the exporter, and the frontend reads the results.
The backend recomputes the same things live, including whatever has streamed
in since.

Re-run both after editing `src/data/seed.js` or `src/data/narrative.js`.
