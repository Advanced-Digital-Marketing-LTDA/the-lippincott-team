# LIP-184 URL-family cohort map

**Evidence cut:** 2026-10-13, repository `main` at `2ad0c746e38dc6f6aef32419b4a29a25d279c651` (PR #85 merged).
**Purpose:** Separate URL populations for LIP-51 and its follow-on reconciliation. This is a route-family map, not a performance analysis or a claim about why rankings changed.

## Page-level GSC cohorts

The October 6 audit reports these URL-family aggregates for `sc-domain:thelippincottteam.com`. The prior window is April 8–July 6, 2026; the recent window is July 7–October 4, 2026. “URL rows” count returned URLs, including variants. They are not unique-page, indexed-page, or property counts.

| Page family | Prior 90-day URL rows / page clicks | Recent 90-day URL rows / page clicks | Cohort treatment |
| --- | ---: | ---: | --- |
| `/property-search/` / IDX | 23,110 / 840 | 1,186 / 23 | Keep as its own listing-inventory cohort. Do not fold into editorial or retained-page totals. |
| Blog | 22 / 98 | 34 / 9 | Editorial cohort. These are URL-row counts, not an article count or proof that every row has a one-to-one historic destination. |
| Homepage variants | 2 / 201 | 2 / 63 | Keep host/path variants separate until the row-level comparison says which paths overlap. |
| Historic `/agents/` | 15 / 50 | 2 / 0 | Historic-profile cohort. Map a person to `/about/` only with an exact source record; the Amy mapping does not resolve all agents. |
| `/about/` | 1 / 12 | 17 / 17 | Current profile/about cohort. Keep separate from historic `/agents/` until each person's mapping is verified. |

These are page-level figures, not Search Console property totals. The audit reports prior-90-day property totals of 1,220 clicks / 164,937 impressions and recent-90-day totals of 118 / 10,282; the corresponding page rows sum differently. Search Console returned 86 daily rows in the prior window and 41 in the recent one. It returned no THE rows from July 3 through August 24. The first later row is not a launch date. The report also identifies a separate `sc-domain:lippincottteam.com` property and an overlapping URL-prefix property that it excluded from totals. Keep those property scopes separate.

## Sampled historical route register

The companion workbook’s `Migration Routes` tab records 17 live probes on October 6, 2026. It supplies the full request URL, status, redirect count, final URL, response chain, destination canonical, capture time, action ID, and proposed disposition. These are exact sampled routes, not an exhaustive former-site export.

| Record | Historical request URL | Observed result on October 6, 2026 | Cohort mapping |
| --- | --- | --- | --- |
| MIG-001 | `https://lippincottteam.com/` | 301 once to `https://thelippincottteam.com/`, then 200; canonical matches. | Legacy domain; same-path homepage mapping. |
| MIG-002 | `https://lippincottteam.com/about/` | 301 once to `https://thelippincottteam.com/about/`, then 200; canonical matches. | Legacy domain; same-path About mapping. |
| MIG-003 | `https://lippincottteam.com/northwest-houston-real-estate/cypress-tx-real-estate/bridgeland-real-estate/` | 301 once to the same path on `thelippincottteam.com`, then 200; canonical matches. | Legacy domain; same-path community mapping. |
| MIG-004 | `https://lippincottteam.com/blog/sell-your-home-in-cypress-tx-when-is-the-right-time/` | 301 once to the same path on `thelippincottteam.com`, then 200; canonical matches. | Legacy domain; same-path editorial mapping. |
| MIG-005 | `https://lippincottteam.com/about/aimee-wiesner-2/` | 301 once to the same path on `thelippincottteam.com`, then 200; canonical matches. | Legacy domain; same-path profile mapping. |
| MIG-006 | `https://lippincottteam.com/about/janet-nicholson-2/` | 301 once to the same path on `thelippincottteam.com`, then 200; canonical matches. | Legacy domain; same-path profile mapping. |
| MIG-007 | `https://lippincottteam.com/blog/cypress-zip-77433-is-the-1-most-moved-to-zip-code-in-america-in-2026/` | 301 once to the same path on `thelippincottteam.com`, then 200; canonical matches. | Legacy domain; same-path editorial mapping. |
| MIG-008 | `https://lippincottteam.com/blog/how-real-estate-agents-price-homes/` | 301 once to the same path on `thelippincottteam.com`, then 200; canonical matches. | Legacy domain; same-path editorial mapping. |
| MIG-009 | `https://lippincottteam.com/contact-us/` | 301 once to `https://thelippincottteam.com/contact-us/`, then 200; canonical matches. | Legacy domain; same-path contact mapping. Keep distinct from the former `/contact/` path. |
| MIG-010 | `https://lippincottteam.com/northwest-houston-real-estate/cypress-tx-real-estate/` | 301 once to the same path on `thelippincottteam.com`, then 200; canonical matches. | Legacy domain; same-path community mapping. |
| MIG-011 | `https://www.thelippincottteam.com/agents/amy-lippincott/` | 302 once to the same non-www path, then 404; 404 canonical. | Historic profile path. PR #80 later implemented `/agents/amy-lippincott/` → `/about/amy-lippincott-2/`; PR #85 says live acceptance remains unverified. |
| MIG-012 | `https://www.thelippincottteam.com/contact/` | 302 once to the same non-www path, then 404; 404 canonical. | Historic contact path. PR #80 later implemented `/contact/` → `/contact-us/`; PR #85 says live acceptance remains unverified. |
| MIG-013 | `https://www.thelippincottteam.com/sellers/home-sale-calculator/` | 302 to the same non-www path, then 301 to `/sell/`, then 200; `/sell/` canonical. | Legacy seller/calculator route. The route works; LIP-58 still needs the owner to decide whether manual valuation serves the former calculator intent. |
| MIG-014 | `https://www.thelippincottteam.com/blog/the-truth-about-living-in-tomball-tx-small-town-charm-big-texas-personality/` | 302 once to the same non-www path, then 200; canonical matches. | Long Tomball article slug retained across host normalization. The distinct short Tomball path under LIP-103 remains untested/unresolved. |
| MIG-015 | `https://www.thelippincottteam.com/property-search/detail/70/50208824/4710-oakbluff-court-fulshear-tx-77441/` | 302 once to same non-www path, then 404; 404 canonical. | Individual retired-listing candidate. LIP-56 still needs the owner/content-rights decision; do not redirect to a generic page. |
| MIG-016 | `https://www.thelippincottteam.com/property-search/detail/70/50914160/5623-sycamore-creek-drive-houston-tx-77345/` | 302 once to same non-www path, then 404; 404 canonical. | Separate retired-listing candidate. LIP-57 still needs the owner/content-rights decision; do not combine with MIG-015 or redirect to generic search. |
| MIG-017 | `https://www.thelippincottteam.com/property-search/search-form/` | 302 once to same non-www path, then 404; 404 canonical. | Legacy IDX search-form cohort. LIP-55/LIP-105 need the approved general-search destination and query/filter contract. |

The first ten rows show the tested `lippincottteam.com` paths preserving their path on a one-hop permanent move to `thelippincottteam.com`. Rows MIG-011–017 test a different host cohort: `www.thelippincottteam.com` normalizes temporarily to non-www. Do not treat those host families as one migration rule. The probe records reflect October 6 responses; later code changes do not establish current production status.

## Cohorts supported by records

| Cohort | Verified URL family or example | Current mapping / disposition | Evidence and limits |
| --- | --- | --- | --- |
| Retained editorial content | `/blog/{slug}/`; sampled rows MIG-004, MIG-007, MIG-008 | Preserve the slug for mapped rows. These three exact sample paths return 301 to the same slug on the current host. Keep all other historical article paths unverified until a source row maps them. | The migration design records 23 posts; the October 6 current sitemap has 23 articles, while GSC returned 22 prior-window and 34 current-window blog URL rows. These are different measures and windows. |
| Retained community content | Sampled rows MIG-003 and MIG-010; current nested community URLs | Keep as a separate content family. MIG-003 and MIG-010 prove same-path mapping for those routes only. | The migration design says community pages use existing nested slugs. The current 70-URL sitemap is a present-day census, not a complete historic URL list. |
| Moved profile | `/agents/amy-lippincott/` → `/about/amy-lippincott-2/` | Approved exact 301 exists in merged PR #80; production chain and destination self-canonical remain unverified in PR #85. | `docs/audits/2026-10-06-historical-url-recovery.md`, `docs/audits/2026-10-13-lip-21-recovery-disposition.md`, and PRs #80/#85. Keep source and destination as separate paths linked by the mapping; do not count them as two properties. |
| Moved contact page | `/contact/` → `/contact-us/` | Approved exact 301 exists in merged PR #80; production chain and destination self-canonical remain unverified in PR #85. | Same records as the profile row. This is a service-page mapping, not an editorial or property URL. |
| Legacy WordPress-only paths | `/opt-out-preferences/*`, `/author/*`, `/team-member-page-design/`, `/buyers/*`, `/sellers/*` | Current repository rules map these to `/privacy-policy/`, `/about/`, `/about/`, `/buy/`, and `/sell/`, respectively. | `public/_redirects`, `astro.config.mjs`, and the migration design. The rule families are documented in code; the complete historical source URL list, response history, and per-URL search exposure are absent. |
| Legacy unpublished community path | `/northwest-houston-real-estate/katy-tx-real-estate/cimarron-real-estate/` | Current repository rule maps to the Katy guide. The code records the guide as unpublished because the team does not sell there. | `public/_redirects` and `astro.config.mjs`. Do not extend this exact disposition to other community URLs. |
| Retired-listing candidates (keep separate by property) | `/property-search/detail/70/50208824/4710-oakbluff-court-fulshear-tx-77441/`; `/property-search/detail/70/50914160/5623-sycamore-creek-drive-houston-tx-77345/` | LIP-21 records the first property sold 2026-05-22 and the second sold 2026-07-31. They are retirement candidates, not approved retirement decisions: keep each property's record separate; no generic-search or homepage substitute. | `docs/audits/2026-10-13-lip-21-recovery-disposition.md` links the HAR record for Oakbluff and the brokerage sold-history record for Sycamore Creek. LIP-56/LIP-57 still require owner/content-rights disposition. Do not mix these two property URLs into retained page totals. |
| Legacy IDX search-form | `/property-search/search-form/` | Unresolved legacy-search cohort. No redirect is approved until the equivalent general-search destination and legacy filter/query contract are confirmed; the featured-only AI search is not assumed equivalent. | Both historical URL recovery audit notes and PR #85 disposition. This route is not a property detail and must not be grouped with either sold listing. |
| Other disposition exceptions | `/sellers/home-sale-calculator/`; short Tomball cost-of-living path | Keep separate under LIP-58 and LIP-103. MIG-013 proves the seller route currently completes two redirects to `/sell/`; MIG-014 proves the long article path works after a temporary host redirect. | The short Tomball route remains untested. A working status alone does not establish intent equivalence for the calculator route. |

## Partition rules for LIP-51 / LIP-185

1. Preserve the literal source URL, host, path, query, source-record ID, observed date, destination (if any), disposition, and verification state as separate columns in the eventual row-level crosswalk.
2. Use the cohort labels above; do not merge editorial pages, people/contact pages, IDX search forms, individual property details, or host variants. Treat a source URL and its mapped destination as one relationship, not one summed property.
3. Mark a row `unverified` when the cited record supplies a family but not the exact historical URL, live status, or per-URL destination. Do not fill those fields from today's route shape.
4. Keep settled GSC dates, page totals, property totals, query disclosure limits, and `absent` versus zero values in their source units. LIP-50 records no returned rows from 2026-07-03 through 2026-08-24; the first later row is not a launch date. No rank-loss cause is assigned here.
5. Do not calculate cohort performance from this map. LIP-185 owns page/property reconciliation and window/CTR/disclosure controls after this mapping is reviewed.

## Coverage boundary and next evidence needed

The cited Library sources are now available and reviewed: `lippincott-search-growth-audit.pdf` (pages 4–6, 10–13, 27) and `lippincott-search-audit-inventory.xlsx` (`URL Inventory`, `Migration Routes`, and GSC tabs), both dated October 6, 2026. The 70-row URL Inventory tab covers the current sitemap and raw HTML checks. It does not cover the complete former 23,000-plus IDX inventory. The 17 route probes and their outcomes appear above; they provide targeted examples, not a complete historical crawl.

To extend the row-level crosswalk beyond the 17 probes, obtain an authorized historical IDX URL/listing export with source URL, tested date, response/redirect chain, destination, identity/MLS key, rights/disposition decision, and source for each fact. The audit also lacks an owner-provided dated domain/platform/IDX change log around July 3 and August 25. Keep unlisted routes and that timeline unverified; the GSC family totals do not supply the missing listing identities or explain ranking changes.

LIP-184 blocks LIP-51; LIP-185 is the next dated checkpoint and also blocks LIP-51. The LIP-21 register and live probe are incorporated only as existing evidence. PR #85 is merged; its documented DNS limitation means live acceptance remains separate from this local mapping.
