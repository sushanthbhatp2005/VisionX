// ---------------------------------------------------------------------------
// Computed network and coordination analysis.
//
// These numbers come from networkx (PageRank, Louvain, betweenness) and the
// coordination detector, exported by `python backend/tools/export_analysis.py`.
// They are not authored here -- this module only reads them, so the dashboard
// shows computed values even on GitHub Pages where no Python is available.
//
// Re-run the exporter after editing the edge list or the coordinated sample.
// ---------------------------------------------------------------------------

import analysis from './analysis.json'
import { ACCOUNTS, COMMUNITIES } from './seed.js'

export const ANALYSIS = analysis
export const GRAPH_STATS = analysis.graph
export const DETECTED_COMMUNITIES = analysis.graph.communities
export const COORDINATION = analysis.coordination

/** Per-account computed structure, keyed by account id. */
export const ACCOUNT_METRICS = analysis.accounts

/**
 * Accounts merged with their computed metrics. `centrality` is PageRank
 * normalised to the top-ranked account; `centralityAuthored` is the
 * hand-written value it replaced, kept so the two can be compared on screen.
 */
export const COMPUTED_ACCOUNTS = ACCOUNTS.map((a) => {
  const m = ACCOUNT_METRICS[a.id]
  if (!m) return { ...a, influence: 0, louvain: null }
  return {
    ...a,
    centralityAuthored: m.centrality_authored,
    centrality: m.centrality,
    pagerank: m.pagerank,
    betweenness: m.betweenness,
    degree: m.degree,
    eigenvector: m.eigenvector,
    louvain: m.louvain,
    influence: m.influence,
    influenceAuthored: m.influence_authored,
  }
})

const byId = Object.fromEntries(COMPUTED_ACCOUNTS.map((a) => [a.id, a]))

export const computedAccount = (id) => byId[id]
export const influenceOf = (id) => byId[id]?.influence ?? 0

/** Colour for a Louvain community id (L1, L2, ...). */
const communityColour = Object.fromEntries(DETECTED_COMMUNITIES.map((c) => [c.id, c.color]))
export const louvainColour = (id) => communityColour[id] ?? '#8b95b5'

/** The detected community an account landed in. */
export const louvainOf = (id) => byId[id]?.louvain ?? null

export const detectedCommunity = (lid) => DETECTED_COMMUNITIES.find((c) => c.id === lid)

/** Ranking by any computed measure. */
export function rankBy(measure = 'pagerank', limit = 8) {
  return [...COMPUTED_ACCOUNTS]
    .filter((a) => a[measure] != null)
    .sort((x, y) => y[measure] - x[measure])
    .slice(0, limit)
}

/**
 * The follower-count contrast, computed rather than asserted: the account with
 * the most followers against the one PageRank actually puts at the centre.
 */
export function followerTrap() {
  const biggest = [...COMPUTED_ACCOUNTS].sort((a, b) => b.followers - a.followers)[0]
  const central = rankBy('pagerank', 1)[0]
  return { biggest, central, sameAccount: biggest?.id === central?.id }
}

/** How well Louvain's grouping lines up with the hand-authored labels. */
export function communityAgreement() {
  return DETECTED_COMMUNITIES.map((c) => ({
    ...c,
    handLabel: c.closest_hand_label,
    purityPct: Math.round(c.purity * 100),
    authoredCount: COMMUNITIES.length,
  }))
}
