export const meta = {
  name: 'founding-sales-icp-prospecting',
  description: 'Opus GTM founder sets ICP tiers; Sonnet SDEs over-source prospects; founder grades harshly and sends SDEs back for missing data; writes a prospect CSV',
  whenToUse: 'Build a founding-sales prospect list (50-100 accounts + LinkedIn contacts). args: {product, geography?, target?, out?} or a product description string. No Hunter.io; run /founding-sales-enrichment separately if emails are wanted.',
  phases: [
    { title: 'ICP', detail: 'founder writes criteria, weights, tiers, sourcing angles', model: 'opus' },
    { title: 'Prospect', detail: 'SDEs source companies + contacts, one per angle', model: 'sonnet' },
    { title: 'Review', detail: 'founder tiers each company, requests missing data', model: 'opus' },
    { title: 'Research', detail: 'SDEs chase the data the founder asked for', model: 'sonnet' },
    { title: 'Sheet', detail: 'write the CSV' },
  ],
}

const opts = typeof args === 'string' ? { product: args } : (args || {})
if (!opts.product) throw new Error('Pass args.product: what you sell, the pain it solves, who feels it, price point')
const TARGET = opts.target || 75
const OUT = opts.out || 'prospects.csv'
const GEO = opts.geography || 'infer from the product context; default to the founder\'s home region'
const MAX_REVIEW_ROUNDS = 3   // founder review → research → re-review, per chunk
const MAX_SOURCING_ROUNDS = 2 // initial sweep + one top-up if A/B count < target
const CHUNK = 12

const SKILL = '.claude/skills/founding-sales-icp/SKILL.md'
const NO_HUNTER = 'Do NOT use Hunter.io or any paid email finder. Contacts are name, title and LinkedIn URL (find via web search like `site:linkedin.com/in "<company>" "VP Sales"`, the company team page, or LinkedIn itself).'

const str = { type: 'string' }
const strs = { type: 'array', items: str }
const CONTACT = { type: 'object', properties: { name: str, title: str, linkedin: str }, required: ['name', 'title'] }
const EVIDENCE = { type: 'object', properties: { claim: str, url: str }, required: ['claim', 'url'] }

const ICP_SCHEMA = {
  type: 'object',
  properties: {
    summary: str,
    geography: str,
    size_band: str,
    required: { type: 'array', items: { type: 'object', properties: { criterion: str, how_to_verify: str }, required: ['criterion', 'how_to_verify'] } },
    signals: { type: 'array', items: { type: 'object', properties: { signal: str, weight: { type: 'number' }, how_to_verify: str }, required: ['signal', 'weight', 'how_to_verify'] } },
    discovery_questions: strs,
    tiers: { type: 'object', properties: { A: str, B: str, C: str, Reject: str }, required: ['A', 'B', 'C', 'Reject'] },
    titles: strs,
    angles: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'object', properties: { name: str, instructions: str }, required: ['name', 'instructions'] } },
  },
  required: ['summary', 'geography', 'size_band', 'required', 'signals', 'tiers', 'titles', 'angles'],
}

const COMPANIES_SCHEMA = {
  type: 'object',
  properties: {
    companies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: str, domain: str, hq: str, employees: str, funding: str,
          why_maybe: str,
          evidence: { type: 'array', items: EVIDENCE },
          contacts: { type: 'array', items: CONTACT },
        },
        required: ['name', 'domain', 'why_maybe', 'evidence', 'contacts'],
      },
    },
  },
  required: ['companies'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          domain: str,
          decision: { type: 'string', enum: ['A', 'B', 'C', 'Reject', 'Undecided'] },
          score: { type: 'number' },
          rationale: str,
          data_requests: strs,
        },
        required: ['domain', 'decision', 'score', 'rationale', 'data_requests'],
      },
    },
  },
  required: ['verdicts'],
}

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          domain: str,
          answers: { type: 'array', items: { type: 'object', properties: { request: str, answer: str, url: str }, required: ['request', 'answer'] } },
          new_contacts: { type: 'array', items: CONTACT },
          funding: str,
          employees: str,
        },
        required: ['domain', 'answers'],
      },
    },
  },
  required: ['findings'],
}

const ADD_SCHEMA = {
  type: 'object',
  properties: { angles: ICP_SCHEMA.properties.angles },
  required: ['angles'],
}

const keyOf = d => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')

// ---------- ICP ----------
phase('ICP')
const icp = await agent(
  `You are the founding GTM lead (founder-seller) of this startup. Read ${SKILL} and apply it.

Product context:
${opts.product}

Geography: ${GEO}
Target: ${TARGET} qualified accounts.

Write the ICP:
- required: binary must-haves that are VISIBLE from outside (funding, tech stack, open roles, headcount in a role...). Each with how_to_verify (which source proves it).
- signals: weighted demand signifiers (weights sum to 100), each with how_to_verify.
- discovery_questions: criteria only learnable on a call.
- size_band: the "deer" range, favoring bigger deer.
- tiers: concrete, testable definitions of A / B / C / Reject using the criteria above.
- titles: decision-maker cascade, most to least senior owner of the pain.
- angles: 3-6 DISTINCT sourcing angles, one per SDE (e.g. "LinkedIn title search for X in region", "BuiltWith users of Y", "Crunchbase Series A-B in Z"). Each angle uses one reliable source to find accounts.
Be picky; this list decides who we spend demo hours on.`,
  { label: 'founder:icp', phase: 'ICP', model: 'opus', schema: ICP_SCHEMA },
)
if (!icp) throw new Error('Founder failed to produce an ICP')
const ICP = JSON.stringify(icp, null, 2)
log(`ICP: ${icp.required.length} required, ${icp.signals.length} signals, ${icp.angles.length} angles`)

// ---------- helpers ----------
const companies = new Map() // key -> record

function upsert(c, source) {
  const k = keyOf(c.domain)
  if (!k) return null
  const cur = companies.get(k)
  if (cur) {
    cur.evidence.push(...(c.evidence || []))
    cur.contacts.push(...(c.contacts || []))
    cur.sources.add(source)
    return null
  }
  const rec = { key: k, name: c.name, domain: k, hq: c.hq || '', employees: c.employees || '', funding: c.funding || '', why_maybe: c.why_maybe || '', evidence: [...(c.evidence || [])], contacts: [...(c.contacts || [])], sources: new Set([source]), verdict: null }
  companies.set(k, rec)
  return rec
}

const brief = c => ({
  domain: c.domain, name: c.name, hq: c.hq, employees: c.employees, funding: c.funding,
  sde_pitch: c.why_maybe, evidence: c.evidence, contacts: c.contacts,
  prior_verdict: c.verdict && { decision: c.verdict.decision, rationale: c.verdict.rationale, requested: c.verdict.data_requests },
})

function sdeSource(angle, i, round, perAngle) {
  const seen = [...companies.keys()]
  return agent(
    `You are an eager SDE on a founding sales team. Your boss (the GTM founder) wrote this ICP:
${ICP}

Your sourcing angle: ${angle.name}
${angle.instructions}

Find AT LEAST ${perAngle} companies, more is better. Be overeager: if a company MIGHT fit and you aren't sure, ADD IT and say what's uncertain in why_maybe. The founder will cut; your job is to not miss anyone.
For each company: domain, HQ, headcount, any funding you saw, evidence (claim + source URL for every criterion you could check), and 1-3 contacts from the title cascade (${icp.titles.join(' > ')}).
${NO_HUNTER}
${seen.length ? `Skip these already-found domains: ${seen.join(', ')}` : ''}`,
    { label: `sde:${angle.name}${round > 1 ? ` r${round}` : ''}`, phase: 'Prospect', model: 'sonnet', schema: COMPANIES_SCHEMA },
  )
}

async function judge(chunk, label) {
  let pending = chunk
  for (let round = 1; pending.length && round <= MAX_REVIEW_ROUNDS; round++) {
    const final = round === MAX_REVIEW_ROUNDS
    const r = await agent(
      `You are the GTM founder. You are picky and grade harshly: demo hours are scarce, and unqualified customers churn and mislead the roadmap.
ICP:
${ICP}

Your SDEs brought these companies (round ${round}/${MAX_REVIEW_ROUNDS}):
${JSON.stringify(pending.map(brief), null, 2)}

For EACH company return a verdict:
- decision A/B/C/Reject per the tier definitions. A required criterion with no source URL is NOT confirmed.
- score 0-100 from the weighted signals, only counting evidenced signals.
- If you cannot decide because data is missing, decision = "Undecided" and put SPECIFIC data_requests the SDE can go find (e.g. "Find news articles on <company>'s fundraising: round, amount, date", "Count open <role> postings on their careers page", "Find the LinkedIn of their VP Sales").
- You may also add data_requests on an A/B that lacks a decision-maker contact.
${final ? '- This is the FINAL round: no more research. Decide A/B/C/Reject now; use Undecided only if a required criterion is still totally unknown. data_requests may be empty.' : ''}
Do your own spot checks if something smells off.`,
      { label: `founder:${label} r${round}`, phase: 'Review', model: 'opus', schema: REVIEW_SCHEMA },
    )
    if (!r) break
    const byKey = new Map(r.verdicts.map(v => [keyOf(v.domain), v]))
    const again = []
    for (const c of pending) {
      c.verdict = byKey.get(c.key) || { decision: 'Undecided', score: 0, rationale: 'Founder did not return a verdict', data_requests: [] }
      if (!final && c.verdict.decision !== 'Reject' && c.verdict.data_requests.length) again.push(c)
    }
    if (!again.length) break

    const res = await agent(
      `You are an SDE. The GTM founder needs more data before deciding on these companies. Go find it: news articles, press releases, Crunchbase, careers pages, BuiltWith, LinkedIn. Cite a URL for every answer; if you truly can't find it, say "not found" and where you looked.
${NO_HUNTER}

ICP for context:
${ICP}

Requests:
${JSON.stringify(again.map(c => ({ domain: c.domain, name: c.name, requests: c.verdict.data_requests })), null, 2)}`,
      { label: `sde:research ${label} r${round}`, phase: 'Research', model: 'sonnet', schema: RESEARCH_SCHEMA },
    )
    for (const f of (res && res.findings) || []) {
      const c = companies.get(keyOf(f.domain))
      if (!c) continue
      for (const a of f.answers) c.evidence.push({ claim: `${a.request} → ${a.answer}`, url: a.url || '' })
      c.contacts.push(...(f.new_contacts || []))
      if (f.funding) c.funding = f.funding
      if (f.employees) c.employees = f.employees
    }
    pending = again
  }
}

const chunks = list => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK))
const qualified = () => [...companies.values()].filter(c => c.verdict && (c.verdict.decision === 'A' || c.verdict.decision === 'B')).length

// ---------- source → review, with one top-up round ----------
let angles = icp.angles
let chunkNo = 0
for (let round = 1; round <= MAX_SOURCING_ROUNDS && angles.length; round++) {
  // overeager: ask for ~2x what we need, since the founder will cut hard
  const perAngle = Math.max(5, Math.ceil((TARGET * 2 - qualified()) / angles.length))
  // Barrier: dedup by domain across all SDEs before spending founder reviews.
  const found = (await parallel(angles.map((a, i) => () => sdeSource(a, i, round, perAngle)))).filter(Boolean)
  const fresh = found.flatMap((r, i) => r.companies.map(c => upsert(c, angles[i].name))).filter(Boolean)
  log(`Sourcing round ${round}: ${fresh.length} new companies (${companies.size} total)`)
  await pipeline(chunks(fresh), ch => judge(ch, `batch${++chunkNo}`))
  log(`After round ${round}: ${qualified()} A/B accounts (target ${TARGET})`)
  if (qualified() >= TARGET || round === MAX_SOURCING_ROUNDS) break

  const tally = [...companies.values()].map(c => `${c.domain}: ${c.verdict ? c.verdict.decision : '?'} via ${[...c.sources].join('/')}`)
  const more = await agent(
    `You are the GTM founder. Only ${qualified()} of ${TARGET} needed accounts are A/B. ICP:
${ICP}

Results so far (domain: tier via angle):
${tally.join('\n')}

Give 2-4 NEW sourcing angles for the SDEs that lean into what produced A/B accounts and avoid what produced rejects.`,
    { label: 'founder:top-up', phase: 'ICP', model: 'opus', schema: ADD_SCHEMA },
  )
  angles = (more && more.angles) || []
}

// ---------- sheet ----------
phase('Sheet')
const RANK = { A: 0, B: 1, C: 2, Undecided: 3, Reject: 4 }
const all = [...companies.values()].sort((a, b) =>
  (RANK[a.verdict ? a.verdict.decision : 'Undecided'] - RANK[b.verdict ? b.verdict.decision : 'Undecided']) ||
  ((b.verdict ? b.verdict.score : 0) - (a.verdict ? a.verdict.score : 0)))

const HEAD = ['tier', 'score', 'company', 'domain', 'hq', 'employees', 'funding', 'founder_rationale', 'open_questions', 'evidence', 'sourced_via', 'contact_name', 'contact_first_name', 'contact_title', 'contact_linkedin', 'potential_intros', 'email', 'status']
const cell = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const rows = []
for (const c of all) {
  const v = c.verdict || { decision: 'Undecided', score: 0, rationale: '', data_requests: [] }
  const seenC = new Set()
  const contacts = c.contacts.filter(p => p.name && !seenC.has(p.name.toLowerCase()) && seenC.add(p.name.toLowerCase()))
  const base = [v.decision, v.score, c.name, c.domain, c.hq, c.employees, c.funding, v.rationale, v.data_requests.join(' | '),
    c.evidence.map(e => `${e.claim} (${e.url})`).join(' | '), [...c.sources].join(' | ')]
  // one row per contact, mail-merge style; email left blank (Hunter is a separate opt-in script)
  for (const p of contacts.length ? contacts : [{}]) {
    rows.push([...base, p.name || '', (p.name || '').split(' ')[0], p.title || '', p.linkedin || '', '', '', 'new'])
  }
}
const csv = [HEAD, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n'

await agent(
  `Write the following text EXACTLY, byte for byte, to the file ${OUT} (relative to the current working directory) using the Write tool. Then reply "ok".

${csv}`,
  { label: 'write-csv', phase: 'Sheet', model: 'sonnet', effort: 'low' },
)

const counts = {}
for (const c of all) { const d = c.verdict ? c.verdict.decision : 'Undecided'; counts[d] = (counts[d] || 0) + 1 }
return { out: OUT, companies: all.length, contact_rows: rows.length, tiers: counts, target: TARGET, icp }
