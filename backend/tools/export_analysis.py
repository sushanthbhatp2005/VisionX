"""Export computed network and coordination analysis for the frontend.

    python tools/export_analysis.py

The dashboard runs standalone on GitHub Pages with no Python available, but it
should still show *computed* numbers rather than authored ones. So networkx
stays the single implementation: it runs here, and the results are written to
src/data/analysis.json for the frontend to read. The backend recomputes the
same things live, including whatever has streamed in since.

Re-run after editing the edge list or the coordinated sample.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.coordination import detect  # noqa: E402
from app.corpus import corpus  # noqa: E402
from app.graph import metrics, enriched_accounts  # noqa: E402

OUT = ROOT.parent / "src" / "data" / "analysis.json"


def main() -> int:
    m = metrics()

    # Coordination over the corpus sample. Offsets are relative, so the
    # detector sees the same spacing the live stream would produce.
    now = time.time()
    sample = [
        {**p, "at": int((now - p["offsetSec"]) * 1000)}
        for p in corpus().get("coordinated_sample", [])
    ]
    coord = detect(sample)

    accounts = {
        a["id"]: {
            "pagerank": a["pagerank"],
            "centrality": a["centrality"],
            "centrality_authored": a["centrality_authored"],
            "betweenness": a["betweenness"],
            "degree": a["degree"],
            "eigenvector": a["eigenvector"],
            "louvain": a["louvain"],
            "influence": a["influence"],
            "influence_authored": a["influence_authored"],
        }
        for a in enriched_accounts()
    }

    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "source": "networkx (PageRank, Louvain, betweenness) + app/coordination.py",
        "graph": {
            "nodes": m["nodes"],
            "edges": m["edges"],
            "density": m["density"],
            "avg_degree": m["avg_degree"],
            "components": m["components"],
            "modularity": m["modularity"],
            "communities": m["communities"],
        },
        "accounts": accounts,
        "coordination": coord,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    top = coord.get("top_cluster")
    print(f"wrote {OUT}")
    print(f"  graph: {m['nodes']} nodes, {m['edges']} edges, "
          f"{len(m['communities'])} Louvain communities, modularity {m['modularity']}")
    if top:
        print(f"  coordination: {top['account_count']} accounts, "
              f"{top['narrative_overlap']}% overlap, {top['window_seconds']}s window, "
              f"score {top['score']}")
    else:
        print("  coordination: nothing above threshold")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
