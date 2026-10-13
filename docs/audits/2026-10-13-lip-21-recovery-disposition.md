# LIP-21 — Historical URL recovery: 2026-10-13 disposition

**Status:** Partial; production acceptance remains open. **Changes:** Read-only test harness and decision register. No live redirect rules, host/CDN config, listing data, production deployment or external service settings changed.

**Source baseline:** `Bonobo791/the-lippincott-team` main at `4b0a49eacb17be2b13311fcdcab2e8446f2f571d`, October 9, 2026. PR #80 already merged exact Amy/contact redirect implementations and local regression tests. Reuse these, not duplicate the routes.

## URL-specific findings and disposition

| Legacy route | Finding | Next disposition |
| --- | --- | --- |
| `/agents/amy-lippincott/` | Merged PR #80 has exact 301 to `/about/amy-lippincott-2/`; target is a relevant Amy bio. | Source handled, production status chain/self-canonical not verified. LIP-53. |
| `/contact/` | Merged PR #80 has exact 301 to `/contact-us/`; target provides contact functionality. | Source handled, production status chain/self-canonical not verified. LIP-54. |
| `/property-search/search-form/` | October 6 audit found 404. Original proposed destination is Sierra results at `https://www.thelippincottteamlistings.com/property-search/results/`, but merged PR #83 changed the current site Search nav to `https://northwest-houston-ai-home-search.thelippincottteam.com/`. The latter describes its inventory as featured, not a full MLS replacement. | No unapproved redirect. Decide intended generic/full search service, verify query/filter/mobile behavior and owner approval (LIP-55); only then implement/verify mapping (LIP-105). |
| `/property-search/detail/70/50208824/4710-oakbluff-court-fulshear-tx-77441/` | HAR lists matching MLS #50208824 at 4710 Oakbluff Ct as sold May 22, 2026. | Do not treat as active or send to homepage. Exact property archive/detail redirect only after listing/content-rights review; otherwise truthful 404/410. LIP-56. |
| `/property-search/detail/70/50914160/5623-sycamore-creek-drive-houston-tx-77345/` | HAR reports the address sold July 31, 2026; separate listing history identifies MLS #50914160. | Do not treat as active or redirect to generic search. Await approved specific historic detail/archive, otherwise truthful 404/410. LIP-57. |
| `/sellers/home-sale-calculator/` | Existing route redirects to `/sell/`. Current seller content offers a manual written valuation rather than an instant calculator. | Preserve working route; ask seller-service owner whether the intent is sufficiently met. LIP-58. |
| Short and long Tomball cost-of-living blog slugs | Long slug serves article; short URL's response/canonical could not be established. | Compare live HTTP responses and duplicate intent before proposing canonical redirect. LIP-103. |
| www / HTTP host normalization | Owner established intended production content origin `https://thelippincottteam.com` in LIP-59. October 6 audit found 302 normalization. Bunny CDN and origin layering complicate route ownership. | Plan correct controlling layer and approved one-hop permanent redirect; protect queries, 404 controls, robots, sitemap and APIs. LIP-59 then LIP-106. |

## Search-form decision contract

Owner must explicitly approve whether the exact historical form goes to Sierra full search or another equivalent general search. The newer AI Home Search displays featured inventory and should not silently replace general-MLS search intent. Test legacy filters against actual supported destination fields, document any dropped/unsupported fields, preserve safe tracking query parameters when supported, and verify mobile/desktop behavior and destination canonical. A bot challenge/403 to scripted retrieval does not conclusively mean a person sees a 403. If no destination qualifies, retain 404/410 or approve an honest explanatory handoff page. Do not redirect expired property details to generic search or homepage.

## Reproducible acceptance

- `node --test scripts/historical-url-recovery.test.mjs` — seven local isolated tests passed October 13, 2026.
- **After an authorized release**, `node scripts/audit/verify-historical-url-recovery.mjs --all-hosts` — read-only JSON probe for the two already-approved profile/contact mappings. Tests four content host/scheme variants, both slash variants, GET/HEAD, identical query retention, exactly one 301, 200 target, self-canonical and page heading. Fails closed on 302 hops, loops, wrong domains, soft 404, canonical mismatch, and network failure. This checker does not implement any redirects or presume listing/search approval.
- Current execution environment's direct `curl` requests returned DNS resolution failure. Public browser content views were possible but did **not** provide reliable current exact HTTP hop chains. DNS failure in this environment is not evidence of a website outage. No production acceptance, deployment SHA/date or permission to release was established.
- Technical review after seven settled days, then GSC URL cohorts after 28 and 56 days. LIP-20's mapping remains an explicit project dependency; parent LIP-21 cannot be marked Done yet.

## Evidence links

- [Merged profile/contact changes and local regression evidence — PR #80](https://github.com/Bonobo791/the-lippincott-team/pull/80)
- [Merged search-nav change — PR #83](https://github.com/Bonobo791/the-lippincott-team/pull/83)
- [Current search navigation config](https://github.com/Bonobo791/the-lippincott-team/blob/main/src/content/config/config.json)
- [AI Home Search app](https://northwest-houston-ai-home-search.thelippincottteam.com/)
- [HAR 4710 Oakbluff Ct history](https://www.har.com/homedetail/4710-oakbluff-fulshear-tx-77441/13182026)
- [HAR sold brokerage history for 5623 Sycamore Creek](https://www.har.com/cctx01/sold_by_cloud-team-realty-inc)
- [Current sell page](https://thelippincottteam.com/sell/)
