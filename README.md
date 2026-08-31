# VisionX — Social Media Intelligence (demo)

A runnable frontend demo of the VisionX social-media analytics platform. It is
built as a working intelligence console rather than an informational website:
the whole thing runs off a live-updating synthetic stream, and every screen is
part of one pipeline — **Collect → Analyse → Predict → Alert → Act**.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

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
| `/network` | Influence network — force graph, communities, influence scores, coordination watch |
| `/alerts` | Alert board with an alert simulator |
| `/report` | Intelligence brief with JSON / CSV / PDF export |

## Signature features

- **Why is this trending?** — the causal chain behind a spike (who seeded it,
  what migrated, what merged, what amplified it), each step weighted.
- **Virality prediction** — probability, predicted peak size, time-to-peak, and
  the six factors that produced the number.
- **Early crisis detection** — fires on a *combination*: spike + negative
  sentiment velocity + emotion intensity + geographic concentration +
  cross-platform propagation + anomalous account activity.
- **Cross-platform propagation** — origin platform, per-hop delay, volume
  carried, and sentiment degradation along the chain.
- **Influence score** — reach × engagement × centrality × topic relevance ×
  amplification. The largest account (8.4M followers, score 53) is deliberately
  *not* the most influential one (612k followers, score 92).
- **Indic + code-mix** — Hinglish and Kannada-English handled natively; 23% of
  the corpus is code-mixed.
- **Sarcasm resolution** — surface sentiment vs. resolved intent, shown side by
  side ("Amazing. Another 5-hour jam. Love this city." → negative, 94% sarcasm).
- **Misinformation risk** — a score with its contributing factors attached, and
  coordinated activity labelled "potentially coordinated", never "bots".
- **Insight fusion score** — sentiment × emotion × topic × community ×
  influence × time × spread, with every driver and weight exposed.
- **Conversation DNA** — the whole story of a topic on one strip.
- **Recommended actions** — ranked, each with the evidence that produced it.

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
  data/engine.js     pure simulation + scoring functions (no React)
  store/LiveContext  the clock: ticks the series, streams posts, raises alerts
  components/        charts, insight panels, network graph, live feed
  pages/             the six screens
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

## A note for the demo

All data is synthetic. Accounts, posts and incidents are fictional and are
labelled as such in the UI footer and in the exported report. Location data is
presented aggregated, and misinformation / coordination scores are framed as
risk indicators for human review rather than determinations — which is also the
honest position to take when a judge asks about false positives.
