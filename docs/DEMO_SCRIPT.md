# VisionX — demo script

A 6-minute walkthrough, with what to click and what to say. Timings assume you
talk while the app is already open; do not narrate loading.

**Before you start**

- Open the live site: https://sushanthbhatp2005.github.io/VisionX/
- Have `npm run dev` running on the laptop as a fallback if the venue Wi-Fi is bad.
- Check the top bar reads **STREAMING**. If you rehearsed just before, hit the
  reset button (↺) so numbers start from a clean baseline.
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
| 5. The network names the drivers | "PageRank and Louvain. **Look at this** — the largest account here has 8.4 million followers and scores 53. The one actually driving it has 612 thousand and scores 92." |
| 6. It crosses platforms | "Reddit to X in 32 minutes, X to YouTube in 18, YouTube to Instagram in 41 — and sentiment degrades at every hop." |
| 7. Virality predicted at 87% | "Not 'it's trending'. A probability, a predicted peak of 72k, and a confidence band that widens honestly as it goes further out." |
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
> code-mixed. Most models score those as neutral and silently drop a quarter
> of the conversation. IndicBERT recovers sentiment, emotion and stance."

**C. Cascade replay (Influence network → Cascade replay)**

Drag the scrubber from 0.

> "One post, moving through the network. At T+20 it's reached 3 accounts and
> 3.3 million followers. By T+74 it's 24 accounts and 20 million. This is how
> we know *when* to intervene, not just *whether*."

**D. Coordination (Influence network → Coordination watch)**

> "Three accounts, near-identical text, 90-second windows. Note the wording —
> 'potentially coordinated', queued for human review. We don't call them bots.
> We're not willing to be wrong about that automatically."

---

## 5:30 — 6:00 · Close (Reports)

Click **Reports**.

> "It ends in something a person can use: an executive summary in plain
> language, the scores with their drivers, and export to JSON, CSV or PDF."

Click **JSON** so a file actually downloads. It's a small thing and it lands.

> "Synthetic data today. The scoring layer is pure functions, so pointing this
> at the live FastAPI service is a one-file change — nothing in the UI moves."

---

## Questions you should expect

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

**"What's not built yet?"**
> Be straight about it: "The backend. This is the full frontend and the
> scoring logic running on a synthetic stream. The models named in the
> architecture are the ones we'd wire in — RoBERTa, IndicBERT, BERTopic,
> Prophet."

---

## If something breaks

- **Charts look frozen** — the stream is paused; hit play in the top bar.
- **Numbers look extreme** — someone left the walkthrough running at step 8;
  hit reset (↺).
- **No internet** — `npm run dev`, then http://localhost:5173. Identical app.
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
