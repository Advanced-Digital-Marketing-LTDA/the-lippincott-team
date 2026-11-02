# November 2026 HAR market-statistics audit

Internal research and QA record. This file is not website copy.

Run date: November 2, 2026 (UTC). Base: freshly fetched `origin/main`,
`1a63556c14d9990c93ac1ecc8048b146efbfd768`. Local branch:
`content/har-market-statistics-2026-11`.

## Repository and ownership checks

- Read the current root `AGENTS.md`, package scripts, HAR regression tests and
  `docs/audits/lip-65-har-claim-ledger.md` before editing. The explicit monthly
  branch instruction authorizes this isolated branch instead of `dev`.
- `git fetch origin --prune` and `git ls-remote --heads origin` succeeded. The
  remote exposed only `main` and `claude/project-thread-dpxykm`; no matching
  monthly branch existed. The other owner's branch was not touched.
- GitHub REST and GraphQL requests from `gh` returned Forbidden. The public
  [canonical pull-request list](https://github.com/Advanced-Digital-Marketing-LTDA/the-lippincott-team/pulls)
  independently showed 0 open / 128 closed PRs. No matching work was reused
  because none was found. Recheck ownership immediately before any publication.
- `.agents/skills` is absent in this repository and `/workspace/.agents` is
  empty. SEO/GEO, Humanizer and Stop Slop skills were not available; no substitute
  package was installed. Copy changes are restricted to supported figures,
  reporting periods, source links and necessary directional words.
- The existing adversarial-review project skill applies before publication.
  Review stays internal to Codex. PR test-analysis and silent-failure review
  cover content propagation and missing/ambiguous data; no external review posts.

## Replacement source ledger

HAR.com is the sole source for replacement market figures. Reporting period is
read from the report, not inferred from its URL or this November run date.

| ID | HAR URL | Geography/property scope | Period | Verified metric and population | Decision |
| --- | --- | --- | --- | --- | --- |
| GH-SEP-MEDIAN | https://www.har.com/content/department/mls?m=10&y=2026 | Greater Houston; single-family homes, including new homes, not the separate existing-home series | September 2026; released October 14, 2026 | Median sale price $325,000; closed sales | Replace August $330,000 snapshots and their reporting dates/links |
| GH-SEP-DOM | https://www.har.com/content/department/mls?m=10&y=2026 | Greater Houston; single-family | September 2026 versus September 2025 | Average 58 days to sell versus 56 a year earlier; not active-listing age or a median | Replace August 54 / August 2025 52 and date labels |
| GH-SEP-SUPPLY | https://www.har.com/content/department/mls?m=10&y=2026 | Greater Houston; single-family | September 2026 | 5.5 months of inventory/supply; inventory measure | Replace August 5.3 and date labels |
| GH-SEP-EXISTING-COPY | https://www.har.com/content/department/mls?m=10&y=2026 | Greater Houston; single-family | September 2026; released October 14 | Existing buyer article: median $325,000 (-0.3% rounded), average $421,311 (+0.7%), 58 sale DOM (+2 days), active listings 40,192 (+6.3%), pending 6,789 (-11.6%), closed sales 7,030 (-5.7%), supply 5.5 months | Figures already current; replace secondary market attribution with direct HAR report only |
| RATE-OCT29 | https://www.har.com/mortgage/rates-nearby | HAR's displayed 30-year fixed-rate series, presented by FRED; not a local lender quote | October 29 versus October 22, 2026 | 7.24% versus 7.32%; weekly rates, down week over week | Update buy-page rate snapshot and directional wording |

The unparameterized [HAR monthly report](https://www.har.com/content/department/mls)
independently displays the same September report as the dated October URL.
It explicitly distinguishes single-family from all-property totals and from
townhome/condominium sales. None of those separate populations is substituted.

## City trend sources inspected, replacements skipped

Each city was opened independently. The latest listings table is October 2026;
the sold tables end in September 2026. Extraction exposes `Listings Count`,
`Total Transactions` and `DOM`, but omits the selected property-type filter and
does not define whether DOM is a median or average. The global navigation's
“Single Family Homes” link is not evidence of a table filter. Consequently,
new city numbers cannot safely replace claims labeled single-family or median
listing age. Existing values, dates and sources are preserved, including
existing source-scope caveats. These newer rows are research evidence only.

| HAR URL | Latest visible listings period | Median price / count / DOM | Decision |
| --- | --- | --- | --- |
| https://www.har.com/cypress/realestate/pricetrends | October 2026 | $449,990 / 1,650 / 46 | Skip: property filter and DOM aggregation not verified |
| https://www.har.com/magnolia/realestate/pricetrends | October 2026 | $364,945 / 1,196 / 55.5 | Skip: same unresolved scope |
| https://www.har.com/tomball/realestate/pricetrends | October 2026 | $399,019 / 854 / 51 | Skip: same unresolved scope |
| https://www.har.com/katy/realestate/pricetrends | October 2026 | $365,000 / 3,203 / 46 | Skip: same unresolved scope |
| https://www.har.com/waller/realestate/pricetrends | October 2026 | $324,025 / 494 / 41 | Skip: same unresolved scope |
| https://www.har.com/hockley/realestate/pricetrends | October 2026 | $324,990 / 928 / 48.5 | Skip: same unresolved scope |

Cypress's sold table separately shows September $390,000 / 247 transactions /
35 DOM. Its rental listings table shows October $2,400 / 582 listings / 27 DOM;
the sold/leased transactions table shows September $2,400 / 162 / 31. Neither
is substituted for the existing $2,490 September monthly asking-rent tile:
property scope and the explicit monthly unit remain unverified. The existing
August Cypress sold snapshot is also preserved pending property-filter and
DOM-aggregation verification. No sale-to-list ratio is derived from these tables.

## Audit coverage and preservation

### Verified masterplan inventory observations

These are HAR's generic `Home(s) for Sale` counts, checked November 2, 2026.
They are not an HAR-published monthly report, a single-family-only count, or
strictly active-only inventory: the displayed homes can include Coming Soon.
The property scope remains HAR's named masterplan page. No sold-price or
DOM metric is inferred. Every affected duplicate and table source note must
carry its own retrieval date; an unverified peer keeps its October 3 snapshot.

| HAR URL / masterplan | November 2 page observation | Prior snapshot | Decision |
| --- | --- | --- | --- |
| https://www.har.com/towne-lake/masterplan_70 | 82 homes for sale | 91, October 3 | Update count and check date |
| https://www.har.com/fairfield/masterplan_10 | 61 homes for sale | 65, October 3 | Update count and check date |
| https://www.har.com/cane-island/masterplan_116 | 71 homes for sale | 72, October 3 | Update count and check date |
| https://www.har.com/coles-crossing/masterplan_56 | 26 homes for sale | 26, October 3 | Refresh check date; count unchanged |
| https://www.har.com/grand-lakes/masterplan_15 | 38 homes for sale | 38, October 3 | Refresh check date; count unchanged |

The following specific targets were researched and skipped:

- Seven Meadows: [HAR's neighborhood result page](https://www.har.com/pricetrends/seven-meadows-realestate/6961/for-sale)
  shows 22 results, but the match to the page's “core” boundary excluding
  Avalon/Cinco West is unconfirmed. Preserve 16 and October 3.
- Villages of Northpointe: [HAR result page](https://www.har.com/pricetrends/villages-of-northpointe-realestate/5113/for-sale)
  shows 8; the surrounding comparison table's neighborhood counts were
  inconsistent across HAR extracts. Preserve its entire dated October 3 table.
- [Longwood Village](https://www.har.com/pricetrends/longwood-village-realestate/5886/for-sale):
  conflicting 14 versus 20 results; preserve 16 and October 3.
- [Cypress Creek Lakes](https://www.har.com/pricetrends/cypress-creek-lakes/5964?cid=JaneneBarb)
  and [Cypress Mill](https://www.har.com/pricetrends/cypress-mill-realestate/5879):
  inaccessible through the web reader; preserve 34 and 4, October 3.
- [Raleigh Creek](https://www.har.com/pricetrends/raleigh-creek-realestate/12200),
  [Wimbledon Falls](https://www.har.com/pricetrends/wimbledon-falls-realestate/5126),
  [Canyon Gate at Northpointe](https://www.har.com/pricetrends/canyon-gate-at-northpointe-sec-3-realestate/5173)
  and [Northpointe East](https://www.har.com/pricetrends/northpointe-east-realestate/5100):
  inconsistent result counts between HAR extracts; preserve 2, 6, 15 and 11,
  October 3.
- [ZIP 77433](https://www.har.com/zipcode_77433/pricetrends): October listings
  row $474,160 / 1,224 / DOM 46 and September sold row $405,000 / 168 / DOM 39
  do not expose property-type selection or DOM aggregation. Preserve existing
  September listing/August sold claims and their dates, including rentals.
- [ZIP 77493](https://www.har.com/zipcode_77493/pricetrends): October listings
  row $365,990 / 1,737 / DOM 49 has the same unresolved type/DOM scope.
  Preserve September ZIP context and do not relabel it Elyson-only.
- [Prairie View](https://www.har.com/prairieview/realestate/pricetrends): October
  listings row $249,450 / 18 / DOM 48 does not verify the single-family label.
  Preserve September $244,450 school-page city context.
- [HAR-hosted agent city/ZIP table](https://www.har.com/web/marysol/blogs/148382)
  in the October 31 buyer article: no independently verified matching scope
  for replacement average prices/DOM/counts. Preserve the existing September
  numbers, dates and attribution, separately from the official regional report.
- HAR 2025 stock/appraisal facts on Coles Crossing, Fairfield Village North,
  Grand Lakes/Phase Four, Seven Meadows/Avalon/Cinco West and Villages of
  Northpointe remain dated 2025. Do not replace appraised values with listing
  or sold medians. No newer matching dated stock series was verified.

The companion `2026-11-har-market-statistics-audit.json` records every content
file, individual candidate location and disposition against the untouched base.
Coverage includes metadata, hero chips, cards, tables, FAQ answers feeding JSON-LD,
blog bodies, standalone home/buy/sell/reviews, all community and school pages,
config, team documents, shared renderers and page entry points. The regional
comparison renderer reads the preserved regional city table; it has no separate
market figures to update.

Unsupported neighborhood price bands, sold/list ratios, appreciation/rent
claims, NAR/Redfin/Realtor.com statistics, tax/insurance/loan eligibility and
illustrative payment assumptions retain their original values, dates and
sources. Team sales, volume, ratings/reviews, awards, client testimonials and
all other team facts are protected. Layout, contact forms/API/contact details,
Sierra Interactive integrations and settings are outside this change.

## Validation and publication status

Baseline `pnpm test` passed using the repository-pinned pnpm 10.34.5 at
`/workspace/.onboarding-tools/node_modules/.bin/pnpm`; its final script suite
reported 394/394 passing, in addition to the preceding TypeScript suites.
The environment's default pnpm 11 failed before executing tests because it
attempted an auto-install under unwritable `/home/agent/.local/share/pnpm`.
Using the existing pinned executable resolved this without repository changes.

Final validation (November 2):

- `pnpm test`: **420 passed, 0 failed** across all five suites (7 + 2 + 12 +
  5 + 394). An intermediate run caught three obsolete August snapshot
  assertions; only the directly related expectations in
  `scripts/lip-65-market-claims.test.mjs` were updated. Claim-protection
  assertions remain intact; no unrelated tests were edited.
- `SITE_URL=http://localhost:4321 ASTRO_TELEMETRY_DISABLED=1
  NODE_OPTIONS=--dns-result-order=ipv4first pnpm build:local`: **passed** on
  final content. Telemetry's default unwritable home path caused the first
  attempt to fail; a later attempt stalled at Tina's local datalayer indexing
  and was stopped after investigation within five minutes. Explicit IPv4
  loopback ordering resolved it. These are command-only local environment
  settings; no application/configuration source changed.
- `node scripts/check-tina-schema.mjs`: **passed**, six collections; no
  function residue. `tina/tina-lock.json` is unchanged.
- `SITE_URL=http://localhost:4321 ASTRO_TELEMETRY_DISABLED=1 pnpm exec astro
  check`: **56 errors, 0 warnings, 3 hints**. Repeated against an untouched
  archive of the fetched base with identical dependencies/generated schema:
  the same 56 error file/line/column/TypeScript-code tuples occurred. Existing
  Tina rich-text/type errors are preserved, not repaired by this content run.
- Focused Playwright validation: all **16 changed content routes return 200**;
  expected figures/dates and direct HAR links are present; JSON-LD parses;
  no page errors. Checked Cane Island's updated SEO description. Captured
  eight full-page screenshots (home, buy, sell, Cane Island at 390/1440px),
  with sample mobile/desktop visual inspection. Browser requests to external
  hosts were blocked, so local QA did not contact production services or
  submit forms. System Chromium was used because Playwright's bundled
  browser was absent. Evidence: `.launch/qa/har-2026-11/` (gitignored).
- Protected team-line comparisons, unchanged integration/layout source scope,
  audit-JSON parsing and `git diff --check`: **passed**. The audit registry
  records 74 content files plus eight detailed shared sources, and lists
  another 174 source paths scanned for duplicated content.
- Internal Codex adversarial/PR-test/silent-failure review: `verdict:
  approve`, `findings: []`, covering all final changed files. It caught and
  resolved cross-period comparison wording and one geographic label; city
  figures/dates/sources were preserved. Structured review is retained in the
  local QA evidence. No external review messages were posted.
- Codacy local analysis: **unavailable**; its existing gate reported that
  `@codacy/codacy-mcp` is not installed globally and skipped analysis. No
  SonarQube tool was exposed in this environment. Neither is reported as a
  passing analysis, and no credentials were accessed to provision them.

Publication is pending explicit approval. No push, PR creation/update, readiness
change, merge, deployment, production access or settings operation is authorized
by this local preparation. Proposed publication is this branch to the canonical
repository with a **draft** PR targeting `main`, subject to ownership recheck,
pre-push checks and the parent's immediate approval gate.
