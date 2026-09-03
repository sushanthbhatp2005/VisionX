"""Run topic discovery and cache the result for both sides.

    python tools/export_discovery.py [--min-topic-size 8]

Discovery takes about a minute on a thousand documents, so it is not something
to run at request time or on stage. This runs it once and writes:

  app/data/discovery.json   loaded by the backend at startup
  ../src/data/discovery.json  read by the frontend, which has no Python

Re-run after tools/harvest.py brings in new documents.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.discovery import discover, load_harvest  # noqa: E402

BACKEND_OUT = ROOT / "app" / "data" / "discovery.json"
FRONTEND_OUT = ROOT.parent / "src" / "data" / "discovery.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-topic-size", type=int, default=8)
    ap.add_argument("--max-docs", type=int, default=2000)
    args = ap.parse_args()

    posts = load_harvest()
    print(f"harvest: {len(posts)} documents")
    if not posts:
        print("nothing to cluster — run tools/harvest.py first")
        return 1

    started = time.time()
    result = discover(min_topic_size=args.min_topic_size, max_docs=args.max_docs)

    if not result.get("ok"):
        print(f"discovery failed: {result.get('reason')}")
        return 1

    payload = {**result, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    for out in (BACKEND_OUT, FRONTEND_OUT):
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=1), encoding="utf-8")
        print(f"wrote {out}")

    untracked = [t for t in result["topics"] if not t["nearest_tracked"]]
    print(f"\n{result['topics_found']} topics from {result['documents']} documents "
          f"in {time.time() - started:.0f}s "
          f"({result['outlier_share'] * 100:.0f}% outliers)")
    print(f"{len(untracked)} of them match nothing we track:")
    for t in untracked[:6]:
        print(f"  [{t['size']:>3}] {', '.join(t['keywords'][:4])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
