# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: homeowners in Northwest Houston (Cypress, Tomball, Katy, Waller,
Hockley, Magnolia) choosing a listing agent — the sellers-first audience.
Close second: home buyers in the same area, including relocation buyers
evaluating communities and school districts.
Secondary (operators): Lippincott Team members editing content visually in
the TinaCMS admin (`/admin/`); developers maintaining the Astro codebase.

## Product Purpose

Marketing and lead-generation website for The Lippincott Team, a real estate
team at eXp Realty. It presents the team's track record, local expertise,
community/school knowledge, and listings access, and turns visitors into
contacts. Success means a phone call to 713-494-1818 — the conversion the
site is judged on (sticky mobile click-to-call bar, contact numbers
throughout); contact-form submissions and property-search click-throughs are
supporting actions.

## Positioning

Nine-time Houston Business Journal Residential Real Estate Award winners
with a hyper-local Northwest Houston specialization: dedicated content
hierarchies for each community and school district (not generic city pages),
a 12-agent team bench under eXp Realty, and an integrated Sierra/IDX
property search. A neighboring team cannot truthfully copy the award record
or the depth of the community/school coverage.

## Operating Context

- Content is edited visually in TinaCMS (`pnpm dev`, admin at `/admin/`);
  content lives in Git as MDX/JSON under `src/content/`.
- The site was migrated from WordPress; legacy URLs are preserved via the
  migrated URL hierarchy and `public/_redirects`.
- Property search plus the Buyers/Sellers funnels run on the external
  Sierra/IDX platform at thelippincottteam.com; this site links into them.
- Hosted on Netlify (static HTML + on-demand `/tina-island` editing
  endpoint); Google Tag Manager is embedded in the shared page shell.

## Capabilities and Constraints

Confirmed functionality: page-builder blocks (hero, CTA, features, stats,
testimonials, FAQ, team/community grids, video), blog with RSS, team bios,
nested community and school-district pages, contact page, reviews page,
privacy/terms pages.

Binding constraints (confirmed with the user):

1. Sierra/IDX links — property search and the Buyers/Sellers links point to
   the external Sierra platform and must stay linked.
2. SEO URL structure — the migrated WordPress URL hierarchy
   (`/northwest-houston-real-estate/...`, `/northwest-houston-schools-real-estate/...`,
   blog, team bios) and `public/_redirects` must be preserved.
3. eXp Realty + fair housing — eXp branding/compliance and fair-housing
   legal obligations constrain copy, claims, and identity usage.

Technical facts: Astro 7 static site, zero React in the shipped page tree,
TinaCMS as the content source of truth. No test suite; `pnpm build:local` is
the de-facto check.

## Brand Commitments

- Name: "The Lippincott Team — eXp Realty" (site owner per config).
- Logo: `/logo.webp` (also used for SEO/OpenGraph).
- Contact identity: Amy Lippincott, amy@lippincottteam.com, 713-494-1818,
  17803 W Cypress Hill Circle, Cypress, TX 77433; Facebook
  (facebook.com/realestatewithamy) is the linked social channel.
- The 9× Houston Business Journal award claim is a standing proof point used
  in the SEO description and footer blurb.

(The incumbent visual system — Montserrat/Libre Baskerville, crimson/navy/
parchment tokens — exists in code but was not confirmed as binding; it is
documented separately, not here.)

## Evidence on Hand

- 9 Houston Business Journal Residential Real Estate Awards (claimed in
  `src/content/config/config.json` and the Awards block content).
- Real team roster: 12 agent bios in `src/content/team/`.
- Real testimonials/reviews: `src/content/page/reviews.mdx` and testimonial
  block content migrated from WordPress.
- Community and school-district bodies migrated from WordPress
  (`src/content/community/`, nested hierarchies).
- Absence to respect: no fabricated testimonials, statistics, or client
  names may be introduced; use only the migrated/confirmed content.

## Product Principles

1. Sellers first, buyers served: every surface must work for a listing
   prospect; buyer/relocation journeys are a close second, never an
   afterthought.
2. Phone-first conversion: make calling effortless everywhere (especially
   mobile); forms and search click-throughs support, not replace, the call.
3. Hyper-local authority: community and school-district depth is the
   differentiator — keep it accurate, navigable, and prominent.
4. Proof with real evidence only: awards, reviews, and the team roster carry
   the persuasion; never invent claims.
5. Protect migrated SEO equity: URL structure, redirects, and content
   hierarchy are revenue assets, not refactor candidates.
