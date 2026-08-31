// ---------------------------------------------------------------------------
// The narrative layer: how a conversation moves, not just what it looks like
// right now. Emotion phase transitions, topic relationships, and the cascade
// path a post takes through the network.
// ---------------------------------------------------------------------------

import { ACCOUNTS, EDGES, TOPICS } from './seed.js'

/* ================================================================== *
 * Emotion phases.
 * Sentiment says how negative a conversation is. A phase says what it is
 * about to do -- which is the part that changes what you should do next.
 * ================================================================== */
export const PHASE_META = {
  neutral: { label: 'Neutral', color: '#8b95b5', blurb: 'Informational sharing, low affect' },
  interest: { label: 'Interest', color: '#7dd3fc', blurb: 'Curiosity and information seeking' },
  concern: { label: 'Concern', color: '#6ea8ff', blurb: 'Questions and uncertainty, fear rising' },
  alarm: { label: 'Alarm', color: '#ff8a5b', blurb: 'Urgent warnings, safety-seeking behaviour' },
  frustration: { label: 'Frustration', color: '#ffb02e', blurb: 'Repeat complaints, sarcasm appears' },
  anger: { label: 'Anger', color: '#ff5d73', blurb: 'Blame attribution, high-intensity language' },
  polarisation: { label: 'Polarisation', color: '#e879f9', blurb: 'Two camps harden, neutral share collapses' },
  mobilisation: { label: 'Mobilisation', color: '#c77dff', blurb: 'Calls to organise, escalate or act' },
  resignation: { label: 'Resignation', color: '#94a3b8', blurb: 'Fatigue and disengagement' },
  approval: { label: 'Approval', color: '#2fd4a7', blurb: 'Endorsement and praise' },
  advocacy: { label: 'Advocacy', color: '#34d399', blurb: 'Active promotion and defence' },
}

// `share` is the portion of the conversation currently sitting in each phase;
// `at` is when that phase first became detectable.
export const PHASES = {
  traffic: {
    current: 'anger',
    next: { phase: 'mobilisation', probability: 71, etaMin: 55 },
    note: 'Anger plus rising volume behaves very differently from fear plus rising volume. This one escalates rather than disperses.',
    timeline: [
      { phase: 'neutral', at: '17:10', share: 11 },
      { phase: 'concern', at: '18:05', share: 17 },
      { phase: 'frustration', at: '18:50', share: 28 },
      { phase: 'anger', at: '19:35', share: 44 },
    ],
  },
  water: {
    current: 'anger',
    next: { phase: 'mobilisation', probability: 64, etaMin: 90 },
    note: 'Fear preceded anger here, which is the panic-buying signature rather than the protest signature.',
    timeline: [
      { phase: 'neutral', at: '07:20', share: 9 },
      { phase: 'concern', at: '08:15', share: 21 },
      { phase: 'alarm', at: '09:40', share: 31 },
      { phase: 'anger', at: '11:05', share: 39 },
    ],
  },
  exam: {
    current: 'alarm',
    next: { phase: 'anger', probability: 58, etaMin: 40 },
    note: 'Still alarm, not anger. A correction published now lands; forty minutes later it argues with anger instead.',
    timeline: [
      { phase: 'neutral', at: '14:40', share: 14 },
      { phase: 'concern', at: '15:10', share: 29 },
      { phase: 'alarm', at: '15:50', share: 57 },
    ],
  },
  nep: {
    current: 'polarisation',
    next: { phase: 'mobilisation', probability: 41, etaMin: 240 },
    note: 'The neutral share is the number to watch. Once it falls below roughly 15% the conversation stops being persuadable.',
    timeline: [
      { phase: 'neutral', at: '09:10', share: 16 },
      { phase: 'interest', at: '10:00', share: 22 },
      { phase: 'concern', at: '11:30', share: 25 },
      { phase: 'polarisation', at: '13:40', share: 37 },
    ],
  },
  metro: {
    current: 'advocacy',
    next: { phase: 'approval', probability: 62, etaMin: 180 },
    note: 'The only tracked topic on the positive ladder. Advocacy decays back to approval rather than escalating.',
    timeline: [
      { phase: 'neutral', at: '11:20', share: 12 },
      { phase: 'interest', at: '11:55', share: 21 },
      { phase: 'approval', at: '12:40', share: 32 },
      { phase: 'advocacy', at: '14:10', share: 35 },
    ],
  },
  lang: {
    current: 'anger',
    next: { phase: 'mobilisation', probability: 78, etaMin: 70 },
    note: 'Polarisation preceded anger, so both camps are now mobilising. Counter-messaging into either one tends to harden the other.',
    timeline: [
      { phase: 'neutral', at: '08:15', share: 8 },
      { phase: 'interest', at: '09:00', share: 14 },
      { phase: 'polarisation', at: '10:20', share: 33 },
      { phase: 'anger', at: '12:45', share: 45 },
    ],
  },
  power: {
    current: 'resignation',
    next: { phase: 'resignation', probability: 66, etaMin: 120 },
    note: 'This one is decaying, not escalating. Anger gave way to fatigue, which is why the crisis score sits well below the sentiment score.',
    timeline: [
      { phase: 'neutral', at: '13:30', share: 10 },
      { phase: 'frustration', at: '14:10', share: 24 },
      { phase: 'anger', at: '15:35', share: 32 },
      { phase: 'resignation', at: '17:20', share: 34 },
    ],
  },
  flood: {
    current: 'alarm',
    next: { phase: 'mobilisation', probability: 57, etaMin: 45 },
    note: 'Alarm with trust still at 44 means official messaging is being believed. That window is the whole opportunity.',
    timeline: [
      { phase: 'neutral', at: '06:02', share: 13 },
      { phase: 'concern', at: '06:30', share: 26 },
      { phase: 'alarm', at: '07:05', share: 61 },
    ],
  },
  health: {
    current: 'concern',
    next: { phase: 'alarm', probability: 49, etaMin: 300 },
    note: 'Slow-moving and fear-led. Misinformation risk is the live problem here, not velocity.',
    timeline: [
      { phase: 'neutral', at: '10:40', share: 18 },
      { phase: 'concern', at: '12:00', share: 47 },
      { phase: 'alarm', at: '15:10', share: 35 },
    ],
  },
}

/* ================================================================== *
 * Topic relationships. Conversations do not stay in their own lane --
 * they merge, spill over, and compete for the same attention.
 * ================================================================== */
export const RELATION_META = {
  merged: { label: 'Merging', color: '#ff5d73', blurb: 'Sharing posts and hashtags; converging into one conversation' },
  adjacent: { label: 'Adjacent', color: '#6ea8ff', blurb: 'Same audience and vocabulary, still distinct' },
  spillover: { label: 'Spillover', color: '#ffb02e', blurb: 'One is seeding grievance in the other' },
  competing: { label: 'Competing', color: '#c77dff', blurb: 'Contesting the same attention; one rises as the other falls' },
}

const RELATED_EDGES = [
  ['nep', 'lang', 'merged', 78],
  ['exam', 'nep', 'merged', 71],
  ['traffic', 'metro', 'competing', 62],
  ['water', 'power', 'adjacent', 58],
  ['flood', 'water', 'adjacent', 51],
  ['flood', 'power', 'spillover', 49],
  ['water', 'health', 'spillover', 46],
  ['health', 'water', 'adjacent', 46],
  ['lang', 'exam', 'adjacent', 44],
  ['health', 'flood', 'spillover', 38],
  ['traffic', 'power', 'spillover', 34],
  ['metro', 'lang', 'competing', 27],
]

export function relatedFor(topicId) {
  const out = []
  for (const [a, b, relation, strength] of RELATED_EDGES) {
    const other = a === topicId ? b : b === topicId ? a : null
    if (!other) continue
    if (out.some((r) => r.id === other)) continue
    const topic = TOPICS.find((t) => t.id === other)
    if (topic) out.push({ id: other, tag: topic.tag, title: topic.title, relation, strength })
  }
  return out.sort((x, y) => y.strength - x.strength)
}

/* ================================================================== *
 * Cascade path: how a single post travels outward through the graph.
 * Derived from the network rather than hand-authored, so it stays true
 * to whatever the edge list says.
 * ================================================================== */
export function cascadeFor(topicId) {
  const topic = TOPICS.find((t) => t.id === topicId) || TOPICS[0]
  const seed = topic.influencers[0]

  const neighbours = new Map()
  for (const [a, b, w] of EDGES) {
    if (!neighbours.has(a)) neighbours.set(a, [])
    if (!neighbours.has(b)) neighbours.set(b, [])
    neighbours.get(a).push([b, w])
    neighbours.get(b).push([a, w])
  }

  const seen = new Set([seed])
  const hops = [{ id: seed, at: 0, depth: 0, parent: null }]
  let frontier = [{ id: seed, at: 0, depth: 0 }]

  while (frontier.length && hops.length < ACCOUNTS.length) {
    const next = []
    for (const node of frontier) {
      const edges = (neighbours.get(node.id) || []).sort((x, y) => y[1] - x[1])
      for (const [other, w] of edges) {
        if (seen.has(other)) continue
        seen.add(other)
        // a stronger tie carries the post faster
        const at = node.at + Math.round(46 - w * 3.4)
        const hop = { id: other, at, depth: node.depth + 1, parent: node.id }
        hops.push(hop)
        next.push(hop)
      }
    }
    frontier = next
  }

  return hops.sort((a, b) => a.at - b.at)
}

// Reach over time, for the cascade scrubber's summary line.
export function cascadeReach(hops, atMinute) {
  const reached = hops.filter((h) => h.at <= atMinute)
  const followers = reached.reduce((sum, h) => {
    const a = ACCOUNTS.find((x) => x.id === h.id)
    return sum + (a?.followers ?? 0)
  }, 0)
  return { accounts: reached.length, followers, ids: reached.map((h) => h.id) }
}
