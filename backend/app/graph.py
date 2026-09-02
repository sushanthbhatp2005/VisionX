"""Network analysis: PageRank, Louvain, betweenness — actually computed.

Until this existed, `centrality` was a hand-authored number in the corpus and
communities were hand-assigned labels, while the UI claimed "PageRank +
Louvain". This module makes the claim true: every structural number below is
derived from the edge list by networkx, and the corpus values are used only as
a fallback if the computation is unavailable.

The graph is small (24 accounts, 57 weighted edges), so everything is computed
once at import and cached.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import networkx as nx

from .corpus import accounts, communities, edges

log = logging.getLogger("visionx.graph")

# Louvain is stochastic; fix the seed so the demo is reproducible and the
# community colours do not shuffle between restarts.
SEED = 42


@lru_cache
def build_graph() -> nx.Graph:
    g = nx.Graph()
    for a in accounts():
        g.add_node(a["id"], handle=a["handle"], followers=a["followers"],
                   engagement=a["engagement"], persona=a["persona"])
    for src, dst, weight in edges():
        g.add_edge(src, dst, weight=weight)
    return g


@lru_cache
def metrics() -> dict[str, Any]:
    """Compute every structural measure once."""
    g = build_graph()

    pagerank = nx.pagerank(g, weight="weight", alpha=0.85)
    betweenness = nx.betweenness_centrality(g, weight=None, normalized=True)
    degree = nx.degree_centrality(g)
    eigenvector = _safe_eigenvector(g)

    louvain = nx.community.louvain_communities(g, weight="weight", seed=SEED)
    # deterministic ordering: biggest community first, ties by lowest node id
    louvain = sorted(louvain, key=lambda c: (-len(c), min(c)))
    membership = {node: f"L{i + 1}" for i, comm in enumerate(louvain) for node in comm}

    modularity = nx.community.modularity(g, louvain, weight="weight")

    # PageRank values are tiny (they sum to 1); normalise to 0..1 against the
    # top-ranked node so they can be read as a centrality score.
    top_pr = max(pagerank.values()) or 1.0
    centrality = {n: round(v / top_pr, 4) for n, v in pagerank.items()}

    return {
        "pagerank": {n: round(v, 6) for n, v in pagerank.items()},
        "centrality": centrality,          # pagerank, normalised to the leader
        "betweenness": {n: round(v, 4) for n, v in betweenness.items()},
        "degree": {n: round(v, 4) for n, v in degree.items()},
        "eigenvector": eigenvector,
        "membership": membership,
        "communities": _describe(louvain, membership, pagerank),
        "modularity": round(modularity, 4),
        "nodes": g.number_of_nodes(),
        "edges": g.number_of_edges(),
        "density": round(nx.density(g), 4),
        "avg_degree": round(sum(dict(g.degree()).values()) / g.number_of_nodes(), 2),
        "components": nx.number_connected_components(g),
    }


def _safe_eigenvector(g: nx.Graph) -> dict[str, float]:
    try:
        ev = nx.eigenvector_centrality_numpy(g, weight="weight")
    except Exception:
        try:
            ev = nx.eigenvector_centrality(g, weight="weight", max_iter=1000)
        except Exception as exc:  # disconnected or non-convergent
            log.warning("eigenvector centrality unavailable: %s", exc)
            return {}
    return {n: round(float(v), 4) for n, v in ev.items()}


# Palette reused for whatever number of communities Louvain finds.
PALETTE = ["#6ea8ff", "#2fd4a7", "#c77dff", "#ffb02e", "#ff5d73", "#5be7c4", "#ff8a5b", "#9db4ff"]


def _describe(louvain: list[set], membership: dict, pagerank: dict) -> list[dict]:
    """Name each detected community after its highest-PageRank member.

    The hand-authored labels in the corpus are kept as a hint where the
    detected grouping lines up with one, but the grouping itself is Louvain's.
    """
    by_id = {a["id"]: a for a in accounts()}
    hand_labels = {c["id"]: c["label"] for c in communities()}

    out = []
    for i, comm in enumerate(sorted(louvain, key=lambda c: (-len(c), min(c)))):
        members = sorted(comm, key=lambda n: -pagerank.get(n, 0))
        lead = by_id.get(members[0], {})

        # which hand-authored cluster do most of these accounts carry?
        tally: dict[str, int] = {}
        for n in comm:
            tag = by_id.get(n, {}).get("community")
            if tag:
                tally[tag] = tally.get(tag, 0) + 1
        dominant = max(tally, key=lambda k: tally[k]) if tally else None
        purity = round(tally.get(dominant, 0) / len(comm), 2) if dominant else 0.0

        out.append({
            "id": f"L{i + 1}",
            "label": f"{lead.get('handle', 'cluster')} cluster",
            "color": PALETTE[i % len(PALETTE)],
            "size": round(len(comm) / len(by_id), 3),
            "members": members,
            "lead": lead.get("handle"),
            "closest_hand_label": hand_labels.get(dominant),
            "purity": purity,
        })
    return out


def computed_centrality(account_id: str, fallback: float) -> float:
    """PageRank-derived centrality, or the corpus value if unavailable."""
    try:
        return metrics()["centrality"].get(account_id, fallback)
    except Exception:  # pragma: no cover
        return fallback


def enriched_accounts() -> list[dict]:
    """Accounts with computed structure attached, and influence recomputed."""
    from .corpus import influence_score  # noqa: PLC0415

    m = metrics()
    out = []
    for a in accounts():
        computed = m["centrality"].get(a["id"], a["centrality"])
        enriched = {
            **a,
            "centrality_authored": a["centrality"],
            "centrality": computed,
            "pagerank": m["pagerank"].get(a["id"]),
            "betweenness": m["betweenness"].get(a["id"]),
            "degree": m["degree"].get(a["id"]),
            "eigenvector": m["eigenvector"].get(a["id"]),
            "louvain": m["membership"].get(a["id"]),
        }
        enriched["influence"] = influence_score(enriched)
        enriched["influence_authored"] = influence_score(a)
        out.append(enriched)
    return out


def top_by(measure: str = "pagerank", limit: int = 5) -> list[dict]:
    m = metrics()
    scores = m.get(measure, {})
    by_id = {a["id"]: a for a in accounts()}
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])[:limit]
    return [
        {"id": n, "handle": by_id.get(n, {}).get("handle"), measure: v,
         "followers": by_id.get(n, {}).get("followers")}
        for n, v in ranked
    ]
