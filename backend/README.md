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

| Subsystem | Configured | Not configured |
| --- | --- | --- |
| Metrics | TimescaleDB | in-memory ring buffer |
| Graph | Neo4j | in-memory adjacency |
| Vectors | Qdrant | in-memory cosine over hashed bags |
| Stream | Redis Streams | in-memory deque |
| NLP | transformers | rule-based annotator |
| Ingestion | live collectors | off (pull on demand) |

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
pip install -r requirements-nlp.txt   # torch + transformers
```

Without them, `NLP_BACKEND=auto` uses the rule annotator and everything still
works — the rule path is genuinely good on this corpus, because it was written
for romanised code-mix specifically.

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
| `GET /api/network` | accounts, edges, communities |
| `GET /api/network/neighbours/{id}` | graph query, through Neo4j when configured |
| `GET /api/feed` | recent annotated posts |
| `GET /api/alerts` | the alert board |
| `POST /api/alerts/raise` | fire an alert by rule |
| `POST /api/nlp/annotate` | annotate arbitrary text |
| `GET /api/nlp/similar` | near-duplicate lookup via the vector store |
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

## Regenerating the corpus

The synthetic corpus is exported from the frontend so both sides cannot drift:

```bash
node tools/export_corpus.mjs
```

Re-run after editing `src/data/seed.js` or `src/data/narrative.js`.
