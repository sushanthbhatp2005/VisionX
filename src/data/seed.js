// ---------------------------------------------------------------------------
// VisionX demo corpus.
// Everything here is synthetic. It mirrors the shape of the real pipeline
// (collect -> analyse -> predict -> alert -> act) so the UI can be pointed at a
// live FastAPI/WebSocket backend later without touching the components.
// ---------------------------------------------------------------------------

export const PLATFORMS = [
  { id: 'x', name: 'X', color: '#9db4ff' },
  { id: 'reddit', name: 'Reddit', color: '#ff8a5b' },
  { id: 'youtube', name: 'YouTube', color: '#ff5d73' },
  { id: 'instagram', name: 'Instagram', color: '#c77dff' },
  { id: 'news', name: 'News / Blogs', color: '#2fd4a7' },
]

export const EMOTIONS = ['anger', 'fear', 'joy', 'sadness', 'surprise', 'disgust', 'trust', 'anticipation']

export const LANGUAGES = [
  { id: 'en', name: 'English', share: 41 },
  { id: 'hi', name: 'Hindi', share: 17 },
  { id: 'kn', name: 'Kannada', share: 14 },
  { id: 'hinglish', name: 'Hinglish (code-mixed)', share: 15 },
  { id: 'kn-en', name: 'Kannada-English', share: 8 },
  { id: 'ta', name: 'Tamil', share: 3 },
  { id: 'te', name: 'Telugu', share: 2 },
]

// --- behavioural personas (not demographics) -------------------------------
export const PERSONAS = {
  amplifier: { label: 'Amplifiers', color: '#ff5d73', blurb: 'High share ratio, little original content' },
  seeker: { label: 'Information Seekers', color: '#6ea8ff', blurb: 'Questions, low sharing, high dwell time' },
  supporter: { label: 'Supporters', color: '#2fd4a7', blurb: 'Consistently positive stance' },
  critic: { label: 'Critics', color: '#ffb02e', blurb: 'Sustained negative stance, deep reply threads' },
  starter: { label: 'Trend Starters', color: '#c77dff', blurb: 'Post before topic acceleration' },
}

// --- accounts / network ----------------------------------------------------
export const ACCOUNTS = [
  { id: 'a1', handle: '@blrcommutes', name: 'Bengaluru Commutes', followers: 612000, engagement: 8.4, centrality: 0.94, relevance: 0.97, amplification: 3.1, persona: 'starter', community: 'c1', verified: true },
  { id: 'a2', handle: '@natdailywire', name: 'National Daily Wire', followers: 8420000, engagement: 1.2, centrality: 0.51, relevance: 0.38, amplification: 1.4, persona: 'amplifier', community: 'c2', verified: true },
  { id: 'a3', handle: '@civicpulse_in', name: 'Civic Pulse India', followers: 2140000, engagement: 4.9, centrality: 0.81, relevance: 0.72, amplification: 2.4, persona: 'critic', community: 'c1', verified: true },
  { id: 'a4', handle: '@techie_rants', name: 'Techie Rants', followers: 184000, engagement: 12.6, centrality: 0.77, relevance: 0.9, amplification: 2.9, persona: 'critic', community: 'c3', verified: false },
  { id: 'a5', handle: '@namma_metro_fan', name: 'Namma Metro Fan', followers: 96000, engagement: 9.8, centrality: 0.62, relevance: 0.84, amplification: 1.9, persona: 'supporter', community: 'c4', verified: false },
  { id: 'a6', handle: 'r/bangalore', name: 'r/bangalore', followers: 512000, engagement: 6.1, centrality: 0.88, relevance: 0.95, amplification: 2.7, persona: 'seeker', community: 'c3', verified: false },
  { id: 'a7', handle: '@policy_watch', name: 'Policy Watch', followers: 430000, engagement: 3.4, centrality: 0.69, relevance: 0.55, amplification: 1.6, persona: 'seeker', community: 'c2', verified: true },
  { id: 'a8', handle: '@viral_bharat', name: 'Viral Bharat', followers: 3100000, engagement: 2.1, centrality: 0.44, relevance: 0.29, amplification: 4.2, persona: 'amplifier', community: 'c5', verified: false },
  { id: 'a9', handle: '@kn_news_live', name: 'KN News Live', followers: 1250000, engagement: 3.8, centrality: 0.58, relevance: 0.66, amplification: 2.0, persona: 'amplifier', community: 'c2', verified: true },
  { id: 'a10', handle: '@student_voice_blr', name: 'Student Voice BLR', followers: 74000, engagement: 14.2, centrality: 0.55, relevance: 0.88, amplification: 2.2, persona: 'critic', community: 'c4', verified: false },
  { id: 'a11', handle: '@urbanmobility_lab', name: 'Urban Mobility Lab', followers: 58000, engagement: 7.2, centrality: 0.73, relevance: 0.93, amplification: 1.5, persona: 'starter', community: 'c1', verified: false },
  { id: 'a12', handle: '@daily_forward_99', name: 'Daily Forward', followers: 22000, engagement: 0.6, centrality: 0.21, relevance: 0.31, amplification: 5.6, persona: 'amplifier', community: 'c5', verified: false, suspicious: true },
  { id: 'a13', handle: '@news_alert_7788', name: 'News Alert 7788', followers: 18400, engagement: 0.5, centrality: 0.19, relevance: 0.28, amplification: 5.4, persona: 'amplifier', community: 'c5', verified: false, suspicious: true },
  { id: 'a14', handle: '@bmtc_updates', name: 'BMTC Updates', followers: 141000, engagement: 5.6, centrality: 0.66, relevance: 0.86, amplification: 1.7, persona: 'supporter', community: 'c4', verified: false },
  { id: 'a15', handle: '@fact_check_kar', name: 'Fact Check Karnataka', followers: 210000, engagement: 6.9, centrality: 0.64, relevance: 0.7, amplification: 1.3, persona: 'seeker', community: 'c3', verified: true },
]

export const COMMUNITIES = [
  { id: 'c1', label: 'Civic / mobility core', color: '#6ea8ff', size: 0.31 },
  { id: 'c2', label: 'Mainstream media', color: '#2fd4a7', size: 0.18 },
  { id: 'c3', label: 'Tech worker cluster', color: '#c77dff', size: 0.22 },
  { id: 'c4', label: 'Student & commuter', color: '#ffb02e', size: 0.19 },
  { id: 'c5', label: 'Low-quality amplifier ring', color: '#ff5d73', size: 0.1 },
]

export const EDGES = [
  ['a1', 'a3', 9], ['a1', 'a6', 8], ['a1', 'a11', 7], ['a1', 'a4', 6], ['a1', 'a14', 5],
  ['a3', 'a2', 6], ['a3', 'a9', 5], ['a3', 'a7', 4], ['a3', 'a11', 6],
  ['a4', 'a6', 8], ['a4', 'a15', 4], ['a4', 'a10', 5],
  ['a6', 'a10', 6], ['a6', 'a15', 5], ['a6', 'a11', 4],
  ['a2', 'a8', 7], ['a2', 'a9', 6], ['a2', 'a7', 4],
  ['a8', 'a12', 9], ['a8', 'a13', 9], ['a12', 'a13', 10], ['a8', 'a9', 3],
  ['a5', 'a14', 7], ['a5', 'a10', 4], ['a14', 'a10', 5], ['a14', 'a1', 6],
  ['a7', 'a15', 3], ['a9', 'a1', 4], ['a11', 'a5', 3], ['a12', 'a3', 2], ['a13', 'a1', 2],
]

// Influence is deliberately NOT follower count.
export function influenceScore(a) {
  const reach = Math.min(Math.log10(a.followers) / 7, 1)
  const eng = Math.min(a.engagement / 15, 1)
  const amp = Math.min(a.amplification / 6, 1)
  const raw = 0.22 * reach + 0.26 * eng + 0.24 * a.centrality + 0.18 * a.relevance + 0.1 * amp
  return Math.min(99, Math.round(raw * 118))
}

export const INFLUENCE_WEIGHTS = [
  { key: 'reach', label: 'Reach', weight: 22 },
  { key: 'eng', label: 'Engagement', weight: 26 },
  { key: 'centrality', label: 'Network centrality', weight: 24 },
  { key: 'relevance', label: 'Topic relevance', weight: 18 },
  { key: 'amp', label: 'Amplification', weight: 10 },
]

// --- topics ----------------------------------------------------------------
export const TOPICS = [
  {
    id: 'traffic',
    tag: '#TrafficBengaluru',
    title: 'Outer Ring Road gridlock',
    category: 'Urban mobility',
    hero: true, // drives the guided demo
    mentions: 48230,
    growth: 186,
    velocity: 92,
    sentiment: { pos: 9, neu: 19, neg: 72 },
    sentimentShift: -31,
    emotions: { anger: 74, fear: 21, joy: 4, sadness: 33, surprise: 18, disgust: 47, trust: 8, anticipation: 26 },
    stance: { support: 11, oppose: 68, neutral: 14, unclear: 7 },
    sarcasm: 38,
    virality: 87,
    peakEtaMin: 244,
    predictedMentions: 72400,
    predictedNeg: 68,
    crisis: 88,
    misinfo: 34,
    coordination: 22,
    platforms: { x: 21400, reddit: 12800, youtube: 6900, instagram: 5300, news: 1830 },
    propagation: [
      { from: 'reddit', to: 'x', delayMin: 32, volume: 8200, sentimentDelta: -14 },
      { from: 'x', to: 'youtube', delayMin: 18, volume: 4100, sentimentDelta: -9 },
      { from: 'youtube', to: 'instagram', delayMin: 41, volume: 3300, sentimentDelta: -6 },
      { from: 'x', to: 'news', delayMin: 76, volume: 1830, sentimentDelta: 4 },
    ],
    geo: [
      { place: 'Bengaluru', neg: 79, mentions: 31200 },
      { place: 'Mysuru', neg: 46, mentions: 4100 },
      { place: 'Mangaluru', neg: 39, mentions: 2600 },
      { place: 'Hyderabad', neg: 51, mentions: 3900 },
      { place: 'Chennai', neg: 44, mentions: 3300 },
      { place: 'Delhi NCR', neg: 33, mentions: 3130 },
    ],
    influencers: ['a1', 'a3', 'a4', 'a6', 'a11'],
    drivers: [
      { at: '18:04', kind: 'seed', text: '@blrcommutes posts a 3-hour ORR jam thread', weight: 28 },
      { at: '18:37', kind: 'migration', text: 'r/bangalore thread crosses 2.1k upvotes, migrates to X', weight: 22 },
      { at: '19:12', kind: 'sentiment', text: 'Negative sentiment jumps +43% in 90 minutes', weight: 19 },
      { at: '19:48', kind: 'merge', text: 'Three adjacent topics merge: #ORR, #BMTC, #WFHagain', weight: 16 },
      { at: '20:26', kind: 'amplify', text: 'Engagement multiplies 5.2x, two media accounts pick it up', weight: 15 },
    ],
    misinfoFactors: [
      { label: 'Reused 2023 flood photo attached to 41 posts', weight: 34 },
      { label: 'Unverified casualty claim circulating', weight: 26 },
      { label: 'Low-credibility source share', weight: 22 },
      { label: 'Contradictory road-closure timings', weight: 18 },
    ],
    actions: [
      { p: 'critical', text: 'Issue an ORR advisory within 30 minutes', why: 'Negative velocity is outpacing every official message' },
      { p: 'high', text: 'Verify the reused flood image before it reaches broadcast', why: '41 posts already carry it and two media accounts are adjacent' },
      { p: 'high', text: 'Brief @bmtc_updates and @namma_metro_fan with route data', why: 'The supporter cluster has 2.4x reply reach into commuters' },
      { p: 'medium', text: 'Monitor the amplifier ring for 60 minutes', why: 'Three accounts posted near-identical text in 90-second windows' },
    ],
  },
  {
    id: 'water',
    tag: '#WaterSupply',
    title: 'Cauvery pumping schedule change',
    category: 'Civic utilities',
    mentions: 31700,
    growth: 128,
    velocity: 79,
    sentiment: { pos: 12, neu: 26, neg: 62 },
    sentimentShift: -22,
    emotions: { anger: 61, fear: 52, joy: 5, sadness: 44, surprise: 24, disgust: 31, trust: 11, anticipation: 29 },
    stance: { support: 14, oppose: 59, neutral: 19, unclear: 8 },
    sarcasm: 27,
    virality: 71,
    peakEtaMin: 310,
    predictedMentions: 44800,
    predictedNeg: 66,
    crisis: 67,
    misinfo: 41,
    coordination: 18,
    platforms: { x: 12900, reddit: 6100, youtube: 5400, instagram: 5900, news: 1400 },
    propagation: [
      { from: 'instagram', to: 'x', delayMin: 44, volume: 5100, sentimentDelta: -11 },
      { from: 'x', to: 'reddit', delayMin: 26, volume: 3400, sentimentDelta: -7 },
      { from: 'x', to: 'youtube', delayMin: 62, volume: 2900, sentimentDelta: -5 },
    ],
    geo: [
      { place: 'Bengaluru', neg: 71, mentions: 19800 },
      { place: 'Mandya', neg: 66, mentions: 4300 },
      { place: 'Mysuru', neg: 58, mentions: 3900 },
      { place: 'Tumakuru', neg: 49, mentions: 3700 },
    ],
    influencers: ['a3', 'a9', 'a1', 'a15'],
    drivers: [
      { at: '07:45', kind: 'seed', text: 'Board notice on revised pumping hours', weight: 30 },
      { at: '08:50', kind: 'sentiment', text: 'Fear emotion climbs to 52, a 7-day high', weight: 26 },
      { at: '10:15', kind: 'migration', text: 'Reels from affected wards cross into X', weight: 23 },
      { at: '12:00', kind: 'amplify', text: 'Regional news picks it up in three languages', weight: 21 },
    ],
    misinfoFactors: [
      { label: '"Supply cut for 10 days" claim, unverified', weight: 37 },
      { label: 'Old 2024 tanker-queue video recirculating', weight: 28 },
      { label: 'Conflicting ward-wise schedules', weight: 20 },
      { label: 'Rapid propagation ahead of verification', weight: 15 },
    ],
    actions: [
      { p: 'critical', text: 'Publish the ward-wise schedule in KN, EN and HI', why: 'Conflicting schedules are the top misinformation driver' },
      { p: 'high', text: 'Counter the "10-day cut" claim with the actual notice', why: 'Fear at 52 with 128% growth is a panic-buying pattern' },
      { p: 'medium', text: 'Prepare tanker-deployment comms for four wards', why: 'Geographic concentration is 62% inside four wards' },
    ],
  },
  {
    id: 'exam',
    tag: '#ExamResults',
    title: 'Result portal outage claims',
    category: 'Education',
    mentions: 14260,
    growth: 212,
    velocity: 84,
    sentiment: { pos: 18, neu: 31, neg: 51 },
    sentimentShift: -17,
    emotions: { anger: 49, fear: 57, joy: 12, sadness: 38, surprise: 41, disgust: 18, trust: 14, anticipation: 55 },
    stance: { support: 21, oppose: 44, neutral: 24, unclear: 11 },
    sarcasm: 22,
    virality: 76,
    peakEtaMin: 150,
    predictedMentions: 26900,
    predictedNeg: 55,
    crisis: 52,
    misinfo: 78,
    coordination: 61,
    platforms: { x: 6100, reddit: 2400, youtube: 2900, instagram: 2500, news: 360 },
    propagation: [
      { from: 'x', to: 'instagram', delayMin: 12, volume: 2400, sentimentDelta: -6 },
      { from: 'instagram', to: 'youtube', delayMin: 29, volume: 1800, sentimentDelta: -4 },
      { from: 'x', to: 'reddit', delayMin: 33, volume: 1500, sentimentDelta: 3 },
    ],
    geo: [
      { place: 'Bengaluru', neg: 54, mentions: 5100 },
      { place: 'Hubballi', neg: 49, mentions: 2600 },
      { place: 'Kalaburagi', neg: 47, mentions: 2300 },
      { place: 'Mysuru', neg: 43, mentions: 4260 },
    ],
    influencers: ['a10', 'a8', 'a12', 'a13'],
    drivers: [
      { at: '15:02', kind: 'seed', text: 'Screenshot of an error page posted', weight: 22 },
      { at: '15:19', kind: 'amplify', text: '37 accounts repost near-identical text in 90s windows', weight: 36 },
      { at: '15:44', kind: 'migration', text: 'Crosses to Instagram within 12 minutes', weight: 24 },
      { at: '16:10', kind: 'sentiment', text: 'Fear reaches 57, anticipation 55', weight: 18 },
    ],
    misinfoFactors: [
      { label: 'Claim of a "leaked answer key" with no source', weight: 41 },
      { label: 'Edited screenshot of the results portal', weight: 33 },
      { label: 'Coordinated amplification detected', weight: 30 },
      { label: 'Accounts created within the last 14 days', weight: 26 },
    ],
    actions: [
      { p: 'critical', text: 'Publish portal status with a timestamped uptime log', why: 'Misinformation risk is 78/100, driven by an edited screenshot' },
      { p: 'critical', text: 'Escalate the 37-account cluster for platform review', why: 'Coordination score 61 with 82% narrative overlap' },
      { p: 'medium', text: 'Pin an official reply under the top five posts', why: 'Corrections land 3.4x better in-thread than standalone' },
    ],
  },
  {
    id: 'nep',
    tag: '#EducationPolicy',
    title: 'New assessment framework rollout',
    category: 'Policy',
    mentions: 26480,
    growth: 41,
    velocity: 58,
    sentiment: { pos: 27, neu: 38, neg: 35 },
    sentimentShift: -6,
    emotions: { anger: 38, fear: 34, joy: 17, sadness: 19, surprise: 22, disgust: 15, trust: 31, anticipation: 44 },
    stance: { support: 42, oppose: 31, neutral: 18, unclear: 9 },
    sarcasm: 19,
    virality: 54,
    peakEtaMin: 610,
    predictedMentions: 31900,
    predictedNeg: 37,
    crisis: 31,
    misinfo: 47,
    coordination: 14,
    platforms: { x: 9800, reddit: 5100, youtube: 6400, instagram: 3600, news: 1580 },
    propagation: [
      { from: 'news', to: 'x', delayMin: 22, volume: 5400, sentimentDelta: -8 },
      { from: 'x', to: 'youtube', delayMin: 55, volume: 3900, sentimentDelta: -3 },
      { from: 'youtube', to: 'instagram', delayMin: 88, volume: 2100, sentimentDelta: 5 },
    ],
    geo: [
      { place: 'Delhi NCR', neg: 41, mentions: 7100 },
      { place: 'Bengaluru', neg: 33, mentions: 5600 },
      { place: 'Lucknow', neg: 38, mentions: 3900 },
      { place: 'Kolkata', neg: 44, mentions: 3100 },
      { place: 'Chennai', neg: 29, mentions: 3300 },
      { place: 'Pune', neg: 27, mentions: 3480 },
    ],
    influencers: ['a7', 'a10', 'a2', 'a15'],
    drivers: [
      { at: '09:10', kind: 'seed', text: 'Ministry circular published, picked up by six outlets', weight: 31 },
      { at: '10:02', kind: 'sentiment', text: 'Student cluster stance flips 12 points to oppose', weight: 24 },
      { at: '11:40', kind: 'amplify', text: 'Explainer video crosses 400k views on YouTube', weight: 21 },
      { at: '13:15', kind: 'merge', text: 'Merges with the #ExamCalendar discussion', weight: 12 },
    ],
    misinfoFactors: [
      { label: 'Draft clause quoted out of context in 300+ posts', weight: 38 },
      { label: 'Screenshot of a superseded circular', weight: 29 },
      { label: 'Rapid propagation before source verification', weight: 19 },
      { label: 'Coordinated hashtag pairing', weight: 14 },
    ],
    actions: [
      { p: 'high', text: 'Publish a clause-by-clause clarification', why: 'The out-of-context clause drives 38% of misinformation risk' },
      { p: 'medium', text: 'Engage the student cluster directly', why: 'Stance is still fluid: 18% neutral, 9% unclear' },
      { p: 'low', text: 'Track YouTube explainers for 24 hours', why: 'Video is the highest-retention channel on this topic' },
    ],
  },
  {
    id: 'metro',
    tag: '#MetroPhase3',
    title: 'Phase 3 corridor approval',
    category: 'Infrastructure',
    mentions: 18940,
    growth: 74,
    velocity: 61,
    sentiment: { pos: 64, neu: 24, neg: 12 },
    sentimentShift: 18,
    emotions: { anger: 9, fear: 11, joy: 66, sadness: 6, surprise: 34, disgust: 4, trust: 58, anticipation: 71 },
    stance: { support: 71, oppose: 12, neutral: 13, unclear: 4 },
    sarcasm: 11,
    virality: 63,
    peakEtaMin: 380,
    predictedMentions: 24100,
    predictedNeg: 14,
    crisis: 8,
    misinfo: 12,
    coordination: 6,
    platforms: { x: 7600, reddit: 3900, youtube: 3100, instagram: 3400, news: 940 },
    propagation: [
      { from: 'news', to: 'x', delayMin: 14, volume: 4200, sentimentDelta: 6 },
      { from: 'x', to: 'instagram', delayMin: 37, volume: 2600, sentimentDelta: 9 },
      { from: 'x', to: 'reddit', delayMin: 51, volume: 1900, sentimentDelta: -4 },
    ],
    geo: [
      { place: 'Bengaluru', neg: 11, mentions: 12800 },
      { place: 'Mysuru', neg: 9, mentions: 2200 },
      { place: 'Hyderabad', neg: 16, mentions: 1900 },
      { place: 'Chennai', neg: 14, mentions: 2040 },
    ],
    influencers: ['a5', 'a1', 'a14', 'a11'],
    drivers: [
      { at: '11:20', kind: 'seed', text: 'Cabinet approval note released', weight: 34 },
      { at: '12:05', kind: 'amplify', text: 'Route render from @namma_metro_fan gets 41k likes', weight: 27 },
      { at: '14:30', kind: 'sentiment', text: 'Positive sentiment rises 18 points', weight: 22 },
    ],
    misinfoFactors: [
      { label: 'Speculative timeline presented as confirmed', weight: 21 },
      { label: 'Unofficial route map in circulation', weight: 15 },
    ],
    actions: [
      { p: 'medium', text: 'Publish the official route map', why: 'An unofficial map is currently filling the vacuum' },
      { p: 'low', text: 'Amplify through the supporter cluster', why: 'Positive momentum is at a six-day high' },
    ],
  },
]

// --- annotated sample posts ------------------------------------------------
// Pre-annotated the way the NLP layer would annotate them.
export const POSTS = [
  { topic: 'traffic', platform: 'x', author: '@techie_rants', lang: 'Hinglish', text: 'Amazing. Another 5-hour jam on ORR. Love this city so much yaar.', sentiment: 'neg', surface: 'pos', sarcasm: 94, emotion: 'anger', stance: 'oppose', place: 'Bengaluru', bot: 4 },
  { topic: 'traffic', platform: 'x', author: '@blrcommutes', lang: 'Kannada-English', text: 'Traffic full jam agide bro, Marathahalli inda Silk Board 2 hours!', sentiment: 'neg', surface: 'neg', sarcasm: 8, emotion: 'anger', stance: 'oppose', place: 'Bengaluru', bot: 2 },
  { topic: 'traffic', platform: 'reddit', author: 'u/orr_survivor', lang: 'English', text: 'Left office at 6, still on ORR at 8:40. This is not sustainable for anyone.', sentiment: 'neg', surface: 'neg', sarcasm: 3, emotion: 'sadness', stance: 'oppose', place: 'Bengaluru', bot: 1 },
  { topic: 'traffic', platform: 'instagram', author: '@blr_reels', lang: 'Hinglish', text: 'Bhai ye traffic dekh ke lagta hai WFH hi theek tha', sentiment: 'neg', surface: 'neu', sarcasm: 41, emotion: 'disgust', stance: 'oppose', place: 'Bengaluru', bot: 6 },
  { topic: 'traffic', platform: 'x', author: '@urbanmobility_lab', lang: 'English', text: 'Signal retiming at three junctions could recover 22% of peak throughput. Data thread below.', sentiment: 'neu', surface: 'neu', sarcasm: 2, emotion: 'trust', stance: 'neutral', place: 'Bengaluru', bot: 1 },
  { topic: 'traffic', platform: 'youtube', author: '@civicpulse_in', lang: 'English', text: 'Nobody is accountable. Same road, same jam, third year running.', sentiment: 'neg', surface: 'neg', sarcasm: 12, emotion: 'anger', stance: 'oppose', place: 'Bengaluru', bot: 2 },
  { topic: 'traffic', platform: 'x', author: '@daily_forward_99', lang: 'Hindi', text: 'Traffic ki wajah se log fanse hue hain, koi kuch nahi kar raha', sentiment: 'neg', surface: 'neg', sarcasm: 5, emotion: 'fear', stance: 'oppose', place: 'Unknown', bot: 88 },
  { topic: 'water', platform: 'x', author: '@civicpulse_in', lang: 'Kannada', text: 'Neeru bandilla 3 dinagalinda. Yaaru uttara kodalla.', sentiment: 'neg', surface: 'neg', sarcasm: 6, emotion: 'anger', stance: 'oppose', place: 'Bengaluru', bot: 2 },
  { topic: 'water', platform: 'instagram', author: '@ward_watch', lang: 'Hinglish', text: 'Tanker ka wait 6 ghante. Bahut badhiya arrangement hai.', sentiment: 'neg', surface: 'pos', sarcasm: 89, emotion: 'disgust', stance: 'oppose', place: 'Bengaluru', bot: 7 },
  { topic: 'metro', platform: 'x', author: '@namma_metro_fan', lang: 'English', text: 'Phase 3 approval is genuinely the best civic news this year. 45 km more coverage.', sentiment: 'pos', surface: 'pos', sarcasm: 2, emotion: 'joy', stance: 'support', place: 'Bengaluru', bot: 1 },
  { topic: 'metro', platform: 'instagram', author: '@blr_daily', lang: 'Kannada-English', text: 'Metro barutte anta ondh varsha inda kelthidivi, finally approval sikkide!', sentiment: 'pos', surface: 'pos', sarcasm: 9, emotion: 'anticipation', stance: 'support', place: 'Bengaluru', bot: 3 },
  { topic: 'nep', platform: 'x', author: '@student_voice_blr', lang: 'English', text: 'Continuous assessment sounds fine on paper. Who is training the teachers for it?', sentiment: 'neu', surface: 'neu', sarcasm: 14, emotion: 'fear', stance: 'unclear', place: 'Bengaluru', bot: 1 },
  { topic: 'nep', platform: 'youtube', author: '@policy_watch', lang: 'Hindi', text: 'Naye framework me practical weightage badhaya gaya hai, ye achha kadam hai', sentiment: 'pos', surface: 'pos', sarcasm: 3, emotion: 'trust', stance: 'support', place: 'Delhi NCR', bot: 2 },
  { topic: 'exam', platform: 'x', author: '@news_alert_7788', lang: 'English', text: 'BREAKING: answer key leaked, portal deliberately shut down. Share fast!', sentiment: 'neg', surface: 'neg', sarcasm: 4, emotion: 'surprise', stance: 'oppose', place: 'Unknown', bot: 92 },
  { topic: 'exam', platform: 'x', author: '@fact_check_kar', lang: 'English', text: 'The circulating screenshot is edited. Portal uptime log shows no outage after 14:00.', sentiment: 'neu', surface: 'neu', sarcasm: 2, emotion: 'trust', stance: 'neutral', place: 'Bengaluru', bot: 1 },
  { topic: 'exam', platform: 'instagram', author: '@exam_help_x', lang: 'Hinglish', text: 'Result site khul hi nahi raha, 2 ghante se try kar raha hoon', sentiment: 'neg', surface: 'neg', sarcasm: 8, emotion: 'fear', stance: 'oppose', place: 'Hubballi', bot: 11 },
]

// Fragments used to synthesise the live stream.
export const STREAM_TEMPLATES = [
  { lang: 'Hinglish', text: 'Yaar ye {t} ka issue ab roz ka ho gaya hai', s: 'neg', e: 'anger', sar: 12 },
  { lang: 'English', text: 'Anyone else seeing this with {t}? Third time this week.', s: 'neg', e: 'sadness', sar: 6 },
  { lang: 'Kannada-English', text: '{t} problem tumba jaasti agide, yaaru nodalla', s: 'neg', e: 'anger', sar: 9 },
  { lang: 'English', text: 'Wonderful handling of {t}. Truly world class.', s: 'neg', e: 'disgust', sar: 91 },
  { lang: 'Hindi', text: '{t} par official statement kab aayega?', s: 'neu', e: 'anticipation', sar: 4 },
  { lang: 'English', text: 'Credit where due, the update on {t} was quick today.', s: 'pos', e: 'trust', sar: 5 },
  { lang: 'Hinglish', text: '{t} ke baare me koi update mila kisi ko?', s: 'neu', e: 'fear', sar: 3 },
  { lang: 'Kannada', text: '{t} bagge sarkaara enu heltilla', s: 'neg', e: 'anger', sar: 7 },
  { lang: 'English', text: 'Data thread on {t}: the numbers do not match the official claim.', s: 'neg', e: 'surprise', sar: 8 },
  { lang: 'English', text: 'Finally some movement on {t}. Long overdue but welcome.', s: 'pos', e: 'joy', sar: 6 },
  { lang: 'Hinglish', text: 'Har baar {t} pe wahi excuse, kuch naya bolo', s: 'neg', e: 'disgust', sar: 24 },
  { lang: 'English', text: 'Sharing my {t} experience from this morning, photos attached.', s: 'neu', e: 'surprise', sar: 3 },
]

export const HANDLES = [
  '@commute_blr', '@ward_watch', '@techie_rants', '@blr_daily', '@civic_notes',
  '@namma_voice', '@road_report', '@city_pulse', '@student_voice_blr', '@metro_watch',
  '@daily_forward_99', '@news_alert_7788', '@kn_news_live', '@urbanmobility_lab',
]

// Approximate lat/lng, projected by the geo panel onto a simplified outline.
export const CITY_COORDS = {
  'Bengaluru': [77.59, 12.97],
  'Mysuru': [76.65, 12.3],
  'Mangaluru': [74.85, 12.87],
  'Mandya': [76.9, 12.52],
  'Tumakuru': [77.1, 13.34],
  'Hubballi': [75.12, 15.36],
  'Kalaburagi': [76.83, 17.33],
  'Hyderabad': [78.49, 17.39],
  'Chennai': [80.27, 13.08],
  'Delhi NCR': [77.21, 28.61],
  'Lucknow': [80.95, 26.85],
  'Kolkata': [88.36, 22.57],
  'Pune': [73.86, 18.52],
  'Mumbai': [72.88, 19.08],
}

export const PLACES = ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Unknown']
