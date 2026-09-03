import React, { useMemo, useState } from 'react'
import { Sparkles, Telescope } from 'lucide-react'
import { Card, Chip, Meter } from './ui.jsx'
import { TOPICS } from '../data/seed.js'
import discovery from '../data/discovery.json'

/**
 * Topics BERTopic found in a real news corpus, with nothing named in advance.
 *
 * The nine tracked topics were written down by a person. These were not — they
 * are what fell out of embedding ~1,000 harvested articles, reducing with UMAP,
 * clustering with HDBSCAN, and taking the terms that distinguish each cluster.
 *
 * The interesting column is the last one: a discovered topic matching nothing
 * we track is a conversation nobody thought to watch for.
 */
export default function DiscoveredTopics({ limit = 10 }) {
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState(null)

  const topics = useMemo(() => {
    const list = discovery.topics ?? []
    return showAll ? list : list.slice(0, limit)
  }, [showAll, limit])

  const untracked = (discovery.topics ?? []).filter((t) => !t.nearest_tracked).length
  const tagOf = (id) => TOPICS.find((t) => t.id === id)?.tag ?? id

  if (!discovery.ok) {
    return (
      <Card title="Discovered topics" right={<Chip tone="warn">no run</Chip>}>
        <p className="text-[12.5px] text-slate-400">{discovery.reason ?? 'Discovery has not been run.'}</p>
      </Card>
    )
  }

  const maxSize = Math.max(...(discovery.topics ?? []).map((t) => t.size), 1)

  return (
    <Card
      title="Discovered topics"
      right={<Chip tone="accent"><Telescope size={11} /> BERTopic · nothing named in advance</Chip>}
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Documents', discovery.documents?.toLocaleString()],
          ['Topics found', discovery.topics_found],
          ['Unmatched', untracked],
          ['Noise', `${Math.round((discovery.outlier_share ?? 0) * 100)}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-ink-700/40 px-2.5 py-1.5">
            <div className="label">{k}</div>
            <div className="font-mono text-[16px] font-bold text-white">{v}</div>
          </div>
        ))}
      </div>

      <p className="mb-2.5 text-[11.5px] leading-relaxed text-slate-500">
        Clustered from a real harvested news corpus, not the synthetic one — clustering generated
        text would only rediscover its own templates. HDBSCAN is allowed to call{' '}
        {Math.round((discovery.outlier_share ?? 0) * 100)}% of it noise rather than forcing every
        document into a topic.
      </p>

      <div className="space-y-1.5">
        {topics.map((t) => {
          const isOpen = open === t.id
          return (
            <div key={t.id} className="rounded-lg border border-line bg-ink-700/40">
              <button
                onClick={() => setOpen(isOpen ? null : t.id)}
                className="w-full px-3 py-2 text-left transition hover:bg-white/[.02]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-500">{t.size}</span>
                  <span className="text-[13px] font-medium text-slate-100">
                    {t.keywords.slice(0, 4).join(', ')}
                  </span>
                  {t.nearest_tracked ? (
                    <span className="ml-auto rounded bg-pos/10 px-1.5 py-px text-[10px] text-pos">
                      matches {tagOf(t.nearest_tracked)}
                    </span>
                  ) : (
                    <span className="ml-auto rounded bg-warn/10 px-1.5 py-px text-[10px] text-warn">
                      <Sparkles size={9} className="mr-0.5 inline" /> untracked
                    </span>
                  )}
                </div>
                <div className="mt-1.5">
                  <Meter
                    value={(t.size / maxSize) * 100}
                    color={t.nearest_tracked ? '#2fd4a7' : '#ffb02e'}
                    height={3}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-line px-3 py-2">
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {t.keywords.map((k, i) => (
                      <span
                        key={k}
                        className="rounded bg-ink-600 px-1.5 py-px font-mono text-[10px] text-slate-300"
                        title={`c-TF-IDF ${t.scores?.[i]?.toFixed(3) ?? ''}`}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                  {t.samples?.map((s, i) => (
                    <p key={i} className="mt-1 text-[11px] leading-snug text-slate-500">
                      “{s}”
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(discovery.topics?.length ?? 0) > limit && (
        <button className="btn mt-2 w-full" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${discovery.topics.length}`}
        </button>
      )}

      <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
        {discovery.note}
      </p>
    </Card>
  )
}
