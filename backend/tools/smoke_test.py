"""End-to-end smoke test against a running backend.

    python tools/smoke_test.py [base_url]

Checks every REST route and the WebSocket, and prints what each one actually
returned rather than just asserting -- the point is to see the service work.
"""
from __future__ import annotations

import asyncio
import json
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
WS = BASE.replace("http", "ws") + "/ws/stream"

ok_count = 0
fail_count = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global ok_count, fail_count
    if condition:
        ok_count += 1
        print(f"  PASS  {label}{'  ' + detail if detail else ''}")
    else:
        fail_count += 1
        print(f"  FAIL  {label}{'  ' + detail if detail else ''}")


async def test_rest(client: httpx.AsyncClient) -> None:
    print("\nREST")

    r = await client.get(f"{BASE}/api/health")
    h = r.json()
    check("GET /api/health", r.status_code == 200 and h["status"] == "ok",
          f"tick={h['tick']} nlp={h['nlp']['active']} loaded={h['nlp'].get('loaded')}")

    r = await client.get(f"{BASE}/api/topics")
    topics = r.json()
    check("GET /api/topics", r.status_code == 200 and len(topics) == 9, f"{len(topics)} topics")

    r = await client.get(f"{BASE}/api/topics/traffic")
    t = r.json()
    check("GET /api/topics/traffic",
          r.status_code == 200 and "fusion" in t and "crisisFactors" in t and "phases" in t,
          f"fusion={t['fusion']['score']} band={t['band']['label']}")

    r = await client.get(f"{BASE}/api/topics/traffic/cascade")
    c = r.json()
    check("GET /api/topics/traffic/cascade", r.status_code == 200 and len(c) > 5,
          f"{len(c)} hops, span {c[-1]['at']}min")

    r = await client.get(f"{BASE}/api/topics/traffic/forecast")
    if r.status_code == 503:
        check("GET /api/topics/traffic/forecast", False, "no fit yet (first refit still running)")
    else:
        f = r.json()
        widths = [p["hi"] - p["lo"] for p in f["points"]]
        check("GET /api/topics/traffic/forecast", r.status_code == 200 and f["fitted_on"] > 500,
              f"{f['model']}, fitted on {f['fitted_on']} pts, sigma {f['sigma']}, AIC {f['aic']}")
        # a fitted interval widens with the horizon; a formula band need not
        check("prediction interval widens with horizon",
              widths[-1] > widths[0] * 1.5,
              f"h=1 width {widths[0]} -> h={len(widths)} width {widths[-1]}")
        check("forecast is seasonal", f["seasonal"] is True, "daily seasonality fitted")

    r = await client.get(f"{BASE}/api/discovery")
    if r.status_code == 503:
        check("GET /api/discovery", False, "no discovery run cached")
    else:
        d = r.json()
        untracked = [t for t in d["topics"] if not t["nearest_tracked"]]
        check("GET /api/discovery", d["ok"] and d["topics_found"] > 5,
              f"{d['topics_found']} topics from {d['documents']} docs, "
              f"{d['outlier_share'] * 100:.0f}% noise")
        # the point of discovery: finding conversations nobody defined
        check("discovery finds untracked conversations", len(untracked) > 0,
              f"{len(untracked)} match none of the 9 tracked topics")
        # and it should still rediscover what we do track, or it is just noise
        check("discovery also rediscovers tracked topics",
              len(untracked) < d["topics_found"],
              f"{d['topics_found'] - len(untracked)} line up with tracked topics")

    r = await client.get(f"{BASE}/api/network")
    n = r.json()
    check("GET /api/network", len(n["accounts"]) == 24 and len(n["edges"]) == 56,
          f"{len(n['accounts'])} accounts, {len(n['edges'])} edges, "
          f"modularity {n['graph']['modularity']}")
    check("network is computed, not authored",
          n.get("computed_by") == "networkx"
          and all("pagerank" in a for a in n["accounts"])
          and len(n["detected_communities"]) > 0,
          f"{len(n['detected_communities'])} Louvain communities")

    # the argument the demo rests on: PageRank must not simply track followers
    r = await client.get(f"{BASE}/api/network/ranking?measure=pagerank&limit=24")
    ranking = r.json()["ranking"]
    top_pr = ranking[0]
    biggest = max(ranking, key=lambda x: x["followers"])
    check("PageRank leader is not the largest account",
          top_pr["handle"] != biggest["handle"],
          f"{top_pr['handle']} ({top_pr['followers']:,}) over {biggest['handle']} ({biggest['followers']:,})")

    r = await client.get(f"{BASE}/api/network/ranking?measure=betweenness&limit=3")
    check("GET /api/network/ranking (betweenness)", r.status_code == 200,
          ", ".join(x["handle"] for x in r.json()["ranking"]))

    r = await client.get(f"{BASE}/api/coordination")
    coord = r.json()
    top = coord.get("top_cluster")
    check("GET /api/coordination finds the ring",
          top is not None and top["account_count"] >= 3,
          f"{top['account_count']} accounts, {top['narrative_overlap']}% overlap, "
          f"{top['window_seconds']}s window, score {top['score']}" if top else "nothing flagged")
    check("coordination excludes the fact-check contrast",
          top is not None and "@fact_check_kar" not in coord["flagged_accounts"],
          "@fact_check_kar not swept in")

    r = await client.get(f"{BASE}/api/network/neighbours/a1")
    check("GET /api/network/neighbours/a1", r.status_code == 200 and len(r.json()) > 0,
          f"{len(r.json())} neighbours")

    r = await client.get(f"{BASE}/api/feed?limit=5")
    check("GET /api/feed", r.status_code == 200 and len(r.json()) > 0, f"{len(r.json())} posts")

    r = await client.get(f"{BASE}/api/alerts")
    check("GET /api/alerts", r.status_code == 200, f"{len(r.json())} alerts")

    r = await client.get(f"{BASE}/api/report/traffic")
    rep = r.json()
    check("GET /api/report/traffic", r.status_code == 200 and "recommended_actions" in rep,
          f"{len(rep['recommended_actions'])} actions")

    # the sarcasm case, which is the whole point of the NLP layer
    r = await client.post(f"{BASE}/api/nlp/annotate",
                          json={"text": "Amazing. Another 5-hour jam on ORR. Love this city so much yaar."})
    a = r.json()
    check("POST /api/nlp/annotate (sarcasm)",
          a["surface"] == "pos" and a["sentiment"] == "neg" and a["sarcasm"] >= 50,
          f"{a['lang']} {a['surface']}->{a['sentiment']} sarc={a['sarcasm']} [{a['backend']}]")

    r = await client.post(f"{BASE}/api/nlp/annotate",
                          json={"text": "Traffic full jam agide bro, Marathahalli inda Silk Board 2 hours!"})
    a = r.json()
    check("POST /api/nlp/annotate (code-mix)",
          a["lang"] == "Kannada-English" and a["sentiment"] == "neg",
          f"{a['lang']} {a['sentiment']} emo={a['emotion']} [{a['backend']}]")

    r = await client.post(f"{BASE}/api/control/escalate", json={"topic_id": "traffic", "amount": 0.8})
    check("POST /api/control/escalate", r.status_code == 200)

    r = await client.post(f"{BASE}/api/alerts/raise", json={"topic_id": "traffic", "kind": "crisis"})
    check("POST /api/alerts/raise", r.status_code == 200, f"raised={r.json()['raised']}")

    r = await client.get(f"{BASE}/api/ingest/status")
    st = r.json()
    avail = [c["platform"] for c in st["collectors"] if c["available"]]
    check("GET /api/ingest/status", r.status_code == 200, f"available: {', '.join(avail)}")

    await client.post(f"{BASE}/api/control/reset")


async def test_ws() -> None:
    print("\nWebSocket")
    try:
        from websockets.asyncio.client import connect  # type: ignore
    except ImportError:  # older websockets
        from websockets.client import connect  # type: ignore

    async with connect(WS) as ws:
        snap = json.loads(await ws.recv())
        check("snapshot on connect",
              snap["type"] == "snapshot" and len(snap["topics"]) == 9,
              f"{len(snap['topics'])} topics, {len(snap['feed'])} posts, {len(snap['alerts'])} alerts")
        check("snapshot carries series",
              len(snap["topics"]["traffic"]["history"]) == 42
              and len(snap["topics"]["traffic"]["forecast"]) == 12,
              "42 history + 12 forecast points")

        tick = json.loads(await asyncio.wait_for(ws.recv(), timeout=12))
        check("tick delta received",
              tick["type"] == "tick" and "topics" in tick and "post" in tick,
              f"tick={tick['tick']} post={tick['post']['lang']}/{tick['post']['sentiment']}")

        await ws.send(json.dumps({"action": "escalate", "topic_id": "traffic", "amount": 0.9}))
        t2 = json.loads(await asyncio.wait_for(ws.recv(), timeout=12))
        check("escalate over socket", t2["type"] == "tick",
              f"traffic growth={t2['topics']['traffic']['growth']}%")


async def main() -> int:
    async with httpx.AsyncClient(timeout=30) as client:
        await test_rest(client)
    await test_ws()
    print(f"\n{ok_count} passed, {fail_count} failed")
    return 1 if fail_count else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
