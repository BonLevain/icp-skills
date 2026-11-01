#!/usr/bin/env python3
"""Fill the `email` column of a founding-sales-icp-prospecting CSV using Hunter.io Email Finder.

Opt-in only: run this when the user explicitly wants Hunter addresses.
Each lookup costs a Hunter credit, so by default only tier A and B rows are enriched.

  python3 scripts/hunter_enrich.py prospects.csv                 # -> prospects.hunter.csv
  python3 scripts/hunter_enrich.py prospects.csv --tiers A,B,C -o out.csv
  python3 scripts/hunter_enrich.py --self-test

Needs HUNTER_API_KEY in the environment or in ./.env.
"""
import argparse, csv, json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = "https://api.hunter.io/v2/email-finder"


def api_key():
    if os.environ.get("HUNTER_API_KEY"):
        return os.environ["HUNTER_API_KEY"]
    if os.path.exists(".env"):
        for line in open(".env"):
            k, _, v = line.strip().partition("=")
            if k == "HUNTER_API_KEY":
                return v.strip().strip('"\'')
    sys.exit("HUNTER_API_KEY not set (env or .env)")


def find_email(domain, full_name, key):
    q = urllib.parse.urlencode({"domain": domain, "full_name": full_name, "api_key": key})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f"{API}?{q}", timeout=30) as r:
                d = json.load(r).get("data") or {}
                return d.get("email") or "", d.get("score") or "", (d.get("verification") or {}).get("status") or ""
        except urllib.error.HTTPError as e:
            if e.code == 429:  # rate limited
                time.sleep(2 ** attempt)
                continue
            if e.code in (400, 404, 451):  # bad input / not found / claimed-person opt-out
                return "", "", ""
            raise
    return "", "", "rate_limited"


def enrich(rows, tiers, lookup):
    """Mutates rows in place; returns number of lookups made. Caches per (domain, name)."""
    cache, n = {}, 0
    for row in rows:
        name, domain = row.get("contact_name", "").strip(), row.get("domain", "").strip()
        if row.get("email") or row.get("tier") not in tiers or not name or not domain:
            continue
        if (domain, name) not in cache:
            cache[(domain, name)] = lookup(domain, name)
            n += 1
        row["email"], row["hunter_score"], row["hunter_status"] = cache[(domain, name)]
    return n


def self_test():
    rows = [
        {"tier": "A", "domain": "acme.com", "contact_name": "Jo Doe", "email": ""},
        {"tier": "A", "domain": "acme.com", "contact_name": "Jo Doe", "email": ""},  # cached
        {"tier": "C", "domain": "acme.com", "contact_name": "Al Roe", "email": ""},  # tier skipped
        {"tier": "B", "domain": "beta.io", "contact_name": "", "email": ""},  # no name
        {"tier": "B", "domain": "beta.io", "contact_name": "Bo Li", "email": "keep@beta.io"},  # already has
    ]
    n = enrich(rows, {"A", "B"}, lambda d, nm: (f"{nm.split()[0].lower()}@{d}", 90, "valid"))
    assert n == 1, n
    assert rows[0]["email"] == rows[1]["email"] == "jo@acme.com"
    assert rows[2]["email"] == "" and rows[3]["email"] == "" and rows[4]["email"] == "keep@beta.io"
    print("self-test ok")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("csv", nargs="?")
    p.add_argument("-o", "--out")
    p.add_argument("--tiers", default="A,B")
    p.add_argument("--self-test", action="store_true")
    a = p.parse_args()
    if a.self_test:
        return self_test()
    if not a.csv:
        p.error("csv path required")
    with open(a.csv, newline="") as f:
        r = csv.DictReader(f)
        fields, rows = list(r.fieldnames), list(r)
    fields += [c for c in ("email", "hunter_score", "hunter_status") if c not in fields]
    key = api_key()
    n = enrich(rows, set(a.tiers.split(",")), lambda d, nm: find_email(d, nm, key))
    out = a.out or a.csv.rsplit(".", 1)[0] + ".hunter.csv"
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"{n} Hunter lookups, {sum(1 for x in rows if x.get('email'))} rows with email -> {out}")


if __name__ == "__main__":
    main()
