# icp-skills

Founding-sales tools: define your ideal customer profile (ICP), build a first list of 50–100 prospect accounts, and optionally add Hunter.io emails.

Based on Founding Sales ch. 4, "Prospecting": https://www.foundingsales.com/4-prospecting

## What's in here

| Path | What it is |
|------|------------|
| `skills/founding-sales-icp/SKILL.md` | Claude Code skill. Writes the ICP: required criteria, weighted demand signals, tiers, size, geography, and decision-maker titles. |
| `workflows/founding-sales-icp-prospecting.js` | Claude Code workflow. Builds the prospect CSV (50–100 accounts plus contacts). |
| `scripts/hunter_enrich.py` | Standalone script. Fills the `email` column of a prospect CSV with Hunter.io. Tier A and B rows only by default. |

## How to use

Copy the folders into your project's `.claude/` directory (or the project root for `scripts/`). Keep the same layout: the skill and workflow point at `.claude/workflows/` and `scripts/`.

```
cp -r skills/founding-sales-icp  <project>/.claude/skills/
cp -r workflows                  <project>/.claude/
cp -r scripts                    <project>/
```

### 1. Define the ICP

In Claude Code, ask for the ICP skill, or say what you want:

> Use the founding-sales-icp skill. Product: <what it does>. Pain: <pain it solves>. Who feels it: <roles>. Price: <point>. Home region: <place>.

You get required criteria, weighted demand signals, tiers (A/B/C/Reject), and a decision-maker title cascade. Each criterion is tagged *visible* (findable online) or *discovery* (learned on a call).

### 2. Build the prospect list

Run the workflow with `args`:

```
args: { product: "...", geography: "...", target: 75, out: "prospects.csv" }
```

You can also pass a plain product description string. The workflow writes a CSV with one row per contact. It does not look up emails.

### 3. Add emails (optional, costs Hunter credits)

Only run this when you want Hunter addresses. It is opt-in.

```
export HUNTER_API_KEY=...          # or put HUNTER_API_KEY=... in ./.env
python3 scripts/hunter_enrich.py prospects.csv                    # -> prospects.hunter.csv, tiers A,B
python3 scripts/hunter_enrich.py prospects.csv --tiers A,B,C -o out.csv
python3 scripts/hunter_enrich.py --self-test
```

Each lookup uses one Hunter credit.

## Order

ICP → prospect list → (optional) enrichment. Start with the ICP. Refine the criteria as you learn from the first calls.
