---
name: founding-sales-icp
description: Define a founding-sales ICP (ideal customer profile) and build the first 50–100 prospect list, following Founding Sales ch. 4 "Prospecting". Use when the user wants to figure out who to sell to first, write ICP criteria or tiers, score/rank target accounts, pick decision-maker titles, or build a prospect spreadsheet. Not for writing outreach copy.
---

# Founding Sales ICP & Prospecting

Source: https://www.foundingsales.com/4-prospecting. Goal: **50–100 accounts that have the pain your product resolves**, each with one or more decision-maker contacts, in a Google Sheet. The first list is "supposed prospects"; expect to refine criteria as you learn.

## 1. Target pain, not relationships

Do not target incubator-mates, ex-colleagues, friends or family just because they are reachable. A demo costs ~2 hours (30 min prep, 1 hr call, 30 min follow-up). Twenty unqualified demos waste a week. Unqualified customers also churn, eat support and give misleading feedback. If a friend says "I could use it", ask qualifying questions first. If they don't fit, ask for referrals to people who do.

## 2. Write the ICP as metadata, not a story

Split criteria into two kinds:

- **Required (minimum viable):** without this the product cannot work. Binary. Example (TalentBin): ≥1 recruiter and ≥3 open engineering roles. Example (Immediately): uses Gmail **and** Salesforce.
- **Demand signifiers:** magnitude of pain and ability to pay. Weighted. Example: 5 recruiters, 20 technical reqs, LinkedIn Recruiter seats (~$50k/yr budget); Marketo (sophistication), 50 geographically spread field reps, $50k ACV, a Sales Ops manager.

Tag every criterion **visible** (findable from outside: LinkedIn, job posts, tech stack, news) or **discovery** (only learned on a call). Only visible criteria can be used to build the list; discovery criteria become qualifying questions.

## 3. Score and tier

Accounts that pass the same required criteria can differ a lot. Give each demand signal a weight and sum into a **customer attractiveness score**. Then tier:

| Tier | Meaning |
|------|---------|
| A | All required criteria confirmed with evidence, strong demand signals, deer-sized, in-region, decision-maker found |
| B | Required confirmed, moderate signals, or one non-critical gap |
| C | Required likely but not fully proven, weak signals; keep for later |
| Reject | Fails a required criterion, or is a rabbit/elephant |

Unconfirmed is not the same as confirmed. If a required criterion (e.g. "raised a Series A in the last 18 months") has no source, the account is undecided until someone finds the source.

## 4. Size: rabbits, deer, elephants

- **Rabbits** (small): fast to buy, little legacy, small deals, high churn.
- **Elephants** (large): big deals but slow, legacy-heavy, hard to onboard. They pull you into custom services.
- **Deer** (mid): enough pain, can absorb new tech, decide fast. **Target deer first, and favor the bigger deer** (e.g. 100 people / 3 recruiters / 20 reqs beats 100 people / 3 reqs).

## 5. Geography

Start in your own region so you can visit on-site and share a time zone. If you can't find 50–100 qualified deer locally, that's a signal to move somewhere busier.

## 6. Where visible signals live

- **People/titles:** LinkedIn (Sales Navigator) first; Apollo. Data.com, D&B and resume databases tend to be stale.
- **Firmographics:** LinkedIn Company Search, Crunchbase (funding), D&B, ZoomInfo. Local businesses: Yelp (sort by review count), Google Maps. Vertical platforms: OpenTable, GrubHub, Healthgrades, Doximity, state license databases.
- **Tech stack:** BuiltWith, Wappalyzer, Datanyze, SimilarWeb. Example: Salesforce Web-to-Lead form means CRM spend; Optimizely means A/B testing; Marketo/Eloqua forms usually mean Salesforce plus willingness to pay.
- **Hiring:** careers pages, LinkedIn Jobs, Indeed, Glassdoor. Open roles show current demand. Old postings show staff they probably already have. Paid job-board profiles show willingness to pay for tools.
- **Funding / momentum:** press releases, TechCrunch and trade news, Crunchbase. Record amount, round and date with a link.

Discipline: **source accounts from one reliable source, enrich from many.** Avoid "prospecting ADHD" (hopping between Twitter, Meetup, Facebook). Don't buy marketing lists; build the first 100 by hand, because doing it teaches you which characteristics matter.

## 7. Account-first or contact-first

Start with whichever characteristic is hardest to find or most essential, then pivot:

- **Contact-first** (TalentBin): title search ("Recruiter") → constrain geography → facet by company size → capture account names plus signals (headcount in role).
- **Account-first** (Immediately): find Salesforce+Gmail users via BuiltWith → then find sales leaders on LinkedIn.

## 8. Contacts

- Target the **decision-maker**: owns the pain, has budget and authority. Users are for groundswell later.
- **Cascade** titles, capturing several levels per account. Example: VP Sales → Director Sales Ops → Sales Ops Manager. LinkedIn boolean: `("sales" OR "sales operations") AND ("Director" OR "VP" OR "Vice")`.
- Note **complementary decision-makers** (e.g. CTO for "ship more software") for referrals.
- Go to the CEO only if the direct owner fails. Skip bottom-up/freemium plays at this stage.
- Fill a **Potential Intros** column with shared connections for warm intros.
- Email is the primary channel (templating, tracking). Find it via Google "name + email", personal sites, LinkedIn, or a finder tool. Phone matters for local businesses. **If decision-maker contact info is nearly impossible to find in your vertical, revisit the GTM.**

## 9. The sheet

Start in a Google Sheet, not a CRM. One row per contact; keep queryable fields (tier, score, size, funding) and mail-merge fields (first name, a personal hook such as a bad Glassdoor review link) in separate columns. Always keep an evidence/source link next to each claim.

## Checklist before outreach

- [ ] 50–100 target accounts
- [ ] Each meets the required criteria **with a source**, and shows demand signals
- [ ] In your geography
- [ ] Deer-sized
- [ ] ≥1 decision-maker contact per account (name, title, LinkedIn)
- [ ] Discovery criteria turned into qualifying questions for the first call

## How to run this skill

1. Ask (or infer from the repo) what the product does, the pain it resolves, who feels it, price point, and home geography.
2. Draft required criteria, weighted demand signals, size band, titles cascade, and the tier table above. Mark each criterion visible or discovery.
3. Pick the one reliable sourcing channel and the account-first vs contact-first path.
4. For a full sourced list, run the `founding-sales-icp-prospecting` workflow (`.claude/workflows/founding-sales-icp-prospecting.js`). For email enrichment the user explicitly asks for, run `/founding-sales-enrichment` (`scripts/hunter_enrich.py`) on the resulting CSV; never use Hunter by default.
