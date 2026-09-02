// Exports the frontend's synthetic corpus to JSON so the Python service and
// the React app share one source of truth. Re-run after editing src/data/.
//
//   node backend/tools/export_corpus.mjs
//
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

const seed = await import(`file://${resolve(root, 'src/data/seed.js')}`)
const narrative = await import(`file://${resolve(root, 'src/data/narrative.js')}`)

const payload = {
  generated_at: new Date().toISOString(),
  source: 'src/data/seed.js + src/data/narrative.js',
  platforms: seed.PLATFORMS,
  emotions: seed.EMOTIONS,
  languages: seed.LANGUAGES,
  personas: seed.PERSONAS,
  accounts: seed.ACCOUNTS,
  communities: seed.COMMUNITIES,
  edges: seed.EDGES,
  influence_weights: seed.INFLUENCE_WEIGHTS,
  topics: seed.TOPICS,
  posts: seed.POSTS,
  coordinated_sample: seed.COORDINATED_SAMPLE,
  stream_templates: seed.STREAM_TEMPLATES,
  handles: seed.HANDLES,
  city_coords: seed.CITY_COORDS,
  places: seed.PLACES,
  phase_meta: narrative.PHASE_META,
  phases: narrative.PHASES,
  relation_meta: narrative.RELATION_META,
  related: Object.fromEntries(seed.TOPICS.map((t) => [t.id, narrative.relatedFor(t.id)])),
  cascades: Object.fromEntries(seed.TOPICS.map((t) => [t.id, narrative.cascadeFor(t.id)])),
}

const out = resolve(here, '../app/data/corpus.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(payload, null, 2))

console.log(
  `wrote ${out}\n  ${payload.topics.length} topics · ${payload.accounts.length} accounts · ` +
  `${payload.edges.length} edges · ${payload.posts.length} annotated posts`
)
