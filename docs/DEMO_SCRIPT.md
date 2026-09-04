# VisionX — demo script

A 6-minute walkthrough, with what to click and what to say. Timings assume you
talk while the app is already open; do not narrate loading.

**Before you start**

- Open the live site: https://sushanthbhatp2005.github.io/VisionX/
- Have `npm run dev` running on the laptop as a fallback if the venue Wi-Fi is bad.
- Check the top bar reads **STREAMING**. If you rehearsed just before, hit the
  reset button (↺) so numbers start from a clean baseline.
- Decide whether you are running the backend. The pill next to STREAMING says
  **LIVE** (FastAPI) or **SIMULATED** (in-browser). Both look identical on
  stage; LIVE lets you show real ingestion and live NLP, SIMULATED cannot fail.
  If in doubt, run the backend but be ready to keep going if it dies — the
  dashboard falls back on its own and the pill just changes.
- Leave speed at **1x**. Judges read the numbers; 4x makes them jump around.

---

## 0:00 — 0:40 · The claim (Overview)

> "Most social listening tools tell you *what* people are saying. That's the
> easy half. VisionX explains *why* it's happening, predicts *where* it's
> going, identifies *who* is driving it, and recommends *what to do next*."

Point at the pipeline strip: **Collect → Analyse → Predict → Alert → Act**.

> "Every screen you're about to see is one stage of that pipeline. 1.2 million
> posts, nine live topics, nine languages."

**Do not linger here.** The landing page is context, not the demo.

---

## 0:40 — 4:30 · The incident (Guided demo)

Click **Guided demo** in the top bar. It drives the app for you — ten steps,
one click each. Say roughly this at each:

| Step | What you say |
| --- | --- |
| 1. Select the topic | "One conversation: traffic on the Outer Ring Road. Everything below is computed for just this one." |
| 2. A spike is detected | "Volume breaks out of baseline. A keyword dashboard stops here — 'high volume', and that's all it knows." |
| 3. Sentiment turns negative | "Now it's 80% negative. Still not enough to act on: negative *about what*, driven by *whom*?" |
| 4. Emotion resolves to anger | "Eight-class emotion, not a positive/negative slider. Anger plus rising volume escalates. Fear plus rising volume disperses. Different emotion, different response." |
| 5. The network names the drivers | "PageRank and Louvain, computed by networkx — not numbers we typed in. **Look at this** — the largest account has 8.4 million followers and a PageRank of 0.045. The one at the centre has 612 thousand and 0.077." |
| 6. It crosses platforms | "Reddit to X in 32 minutes, X to YouTube in 18, YouTube to Instagram in 41 — and sentiment degrades at every hop." |
| 7. Virality predicted at 87% | "Not 'it's trending'. A probability, a predicted peak, and — look at the badge — a fitted Holt-Winters model on 865 points. That band widens because the residual variance says so, not because we drew it that way." |
| 8. Crisis risk goes HIGH | "Six signals fire together — spike, negative velocity, emotion intensity, geographic concentration, cross-platform spread, account anomalies. **One** alert, not six notifications." |
| 9. The system explains why | "The causal chain. Who seeded it, what merged, what amplified it — each weighted. This is the answer to 'why should I believe your score'." |
| 10. And says what to do next | "Four ranked actions, each with the evidence that produced it. A human still decides. We're decision support, not an oracle." |

**The line to land on step 10:**

> "That's the whole difference. Every other tool ends at step 3."

---

## 4:30 — 5:30 · The three proof points

Exit the walkthrough. Pick whichever two or three land best with the panel —
do not do all of them.

**A. Sarcasm (Topic explorer → Sarcasm & context detection)**

> "'Amazing. Another 5-hour jam. Love this city.' Surface sentiment: positive.
> Resolved: negative, 94% sarcasm. 38% of this topic is ironic — a
> monolingual sentiment model scores that conversation exactly backwards."

**B. Code-mix (Live analytics → Language coverage, or the stream's Code-mixed filter)**

> "'Traffic full jam agide bro' — Kannada-English. 23% of our corpus is
> code-mixed. XLM-R reads that as *neutral*, because the complaint is carried
> by the Kannada half — so our lexicon layer overrides it. That's a quarter of
> the conversation most tools silently drop."

**C. Cascade replay (Influence network → Cascade replay)**

Drag the scrubber from 0.

> "One post, moving through the network. At T+20 it's reached 3 accounts and
> 3.3 million followers. By T+74 it's 24 accounts and 20 million. This is how
> we know *when* to intervene, not just *whether*."

**D. Live NLP (needs the backend running)**

Open http://localhost:8000/docs, POST to `/api/nlp/annotate`, and paste in a
line of the judge's choosing. Ask them for one.

> "This is the actual model, not a lookup. Give me a sentence." Paste
> something sarcastic or code-mixed. "Surface positive, resolved negative,
> sarcasm 99, language Hinglish, routed to the traffic topic."

Then `POST /api/ingest/run` and show real Reddit and news posts arriving,
annotated, routed. That is the moment it stops looking like a mockup.

**E. Coordination + Louvain (Influence network)**

Point at the Louvain communities card.

> "We never told it which accounts were suspicious. Louvain grouped the graph
> on edge weights alone, and the amplifier ring came out as its own community
> at 100% purity."

Then the coordination watch.

> "Four accounts, 53% narrative overlap, an 81-second window — all computed,
> not typed in. The threshold is calibrated: reworded reposts score 0.3 to 0.9
> against each other, and a fact-check on the same topic in the same minute
> scores zero. And note the wording — 'potentially coordinated', queued for
> human review. We don't call them bots."

---

## 5:30 — 6:00 · Close (Reports)

Click **Reports**.

> "It ends in something a person can use: an executive summary in plain
> language, the scores with their drivers, and export to JSON, CSV or PDF."

Click **JSON** so a file actually downloads. It's a small thing and it lands.

> "Synthetic corpus, real pipeline. And if I stop the backend right now" —
> do it — "the pill flips to SIMULATED and nothing else changes. The dashboard
> degrades instead of dying. That's deliberate."

---

## Questions you should expect

**"Is that forecast real or did you draw it?"**
> Point at the badge. "Holt-Winters, additive trend and daily seasonality,
> fitted on 865 points by statsmodels. The interval is the fit's residual
> variance widening with the square root of the horizon. If I stop the backend
> the badge changes to 'projected curve' — because then it *is* just a curve,
> and we'd rather say so."

**"Is this real data?"**
> "No — synthetic, and labelled as such in the footer and in every exported
> report. The pipeline shape is real; the corpus is generated so the demo is
> reproducible and doesn't expose anyone's posts."

**"What about false positives?"**
> "That's why misinformation and coordination are *scores with their factors
> shown*, not verdicts. Every flag is a queue item for a human, and the panel
> tells you exactly which signals produced it. We'd rather be auditable than
> confident."

**"How is this different from Brandwatch / Meltwater / Sprinklr?"**
> "Three things. Indian-language and code-mix handling as a first-class path,
> not an afterthought. Explainability — every score shows its drivers.
> And the action layer: those tools end at a chart."

**"How do you get the data?"**
> "Platform APIs where they exist, crawlers where they don't, into Redis
> Streams. PII is stripped at ingest, locations are aggregated to k ≥ 20."

**"Does the influence score really beat follower count?"**
> Open Influence network. "You tell me — this account has 8.4 million
> followers and sits at the edge of the conversation. This one has 612
> thousand and sits at the centre. Follower count would have you brief the
> wrong person."

**"Does it handle other languages, really?"**
> Run the cross-language search. `GET /api/nlp/similar?text=stuck in a huge
> traffic jam for hours`. "That Kannada-script result scores 0.63 against an
> English query with *zero* words in common — the dense store matched the
> meaning. And be straight if they push: romanised Hindi scores 0.09. The
> encoder is trained on native scripts, so casual romanised Devanagari is out
> of distribution. We measured it, it's in the README, and transliteration is
> the fix we haven't built."

**"What happens if it crashes mid-demo?"**
> "Restart it." Do it. "The alert board comes back — alerts and metrics are in
> SQLite, not memory. And the history endpoint can show a longer window than
> the process has been running, which the old in-memory version couldn't."

**"Where do the topics come from? Did you just pick them?"**
> "The nine tracked ones, yes — they carry the narrative panels. But scroll
> down." Open Topic explorer → Discovered topics. "That's BERTopic over a
> thousand real news articles we harvested. Nothing named in advance. It found
> our traffic topic on its own, which tells you the clustering is real — and
> the biggest cluster in the corpus is AI coverage, which nobody on our team
> thought to track. That's the point: it finds what you didn't think to look
> for."

**"What's not built yet?"**
> Be straight about it: "The demonstrated conversations are synthetic — we
> generate them so the demo is reproducible and doesn't expose real people's
> posts. Everything analysing them is real: FastAPI over WebSocket, XLM-R
> sentiment with a DistilRoBERTa emotion head, PageRank and Louvain via
> networkx, a fitted Holt-Winters forecast, calibrated coordination detection,
> BERTopic discovery over a real harvested corpus, and live ingestion from news
> feeds. Two honest gaps: we haven't run the Docker storage containers end to
> end, and X and YouTube ingestion need API keys we don't have."

---

## If something breaks

- **Charts look frozen** — the stream is paused; hit play in the top bar.
- **Numbers look extreme** — someone left the walkthrough running at step 8;
  hit reset (↺).
- **No internet** — `npm run dev`, then http://localhost:5173. Identical app.
- **Backend died mid-demo** — nothing to do. The pill flips to SIMULATED and
  the dashboard keeps running on its own simulation. Say so if anyone notices:
  "that's the fallback doing its job."
- **Pill stuck on CONNECTING** — the backend is not up. It retries every 15s;
  ignore it, everything works.
- **Nothing loads at all** — the whole thing is static files; there's no
  backend to fall over. Reload the page.

---

## What to put on the slides

- `docs/architecture.svg` — the pipeline diagram, mapping every stage to the
  screen that implements it. Dark background, 1600×900, drops straight into a
  16:9 slide.
- Screenshots worth taking: the guided demo at step 9 (causal chain), the
  influence network with the follower-count comparison visible, and the
  Reports page.
