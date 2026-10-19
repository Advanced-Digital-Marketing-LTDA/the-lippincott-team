# Coolify / Docker deployment image for the TinaCMS + Astro site.
#
# Coolify: use the "Dockerfile" build pack (Dockerfile location: /Dockerfile).
# Environment variables set on the Coolify app are injected as --build-arg at
# build time (the "Build Variable" flag, on by default) and as container env
# at runtime. Coolify's proxy passes PORT (Ports Exposes) and HOST.
#
# Build needs TinaCloud credentials (PUBLIC_TINA_CLIENT_ID, TINA_TOKEN) and a
# canonical SITE_URL; it fails fast with ERR_MISSING_CLOUD_CREDS otherwise.
# Runtime: adapter-node standalone server on $PORT (default 4321).

FROM node:22-alpine AS base
# --ignore-scripts is a no-op here (pnpm@10.34.5 ships no install lifecycle
# scripts — its platform binaries come via optionalDependencies), kept to
# make the "no lifecycle scripts" guarantee explicit.
RUN npm install -g pnpm@10.34.5 --ignore-scripts

# ---------- deps: install the full dependency tree ----------
FROM base AS deps
WORKDIR /app
# pnpm-workspace.yaml carries the allowBuilds allowlist (better-sqlite3,
# sharp, ...). Install with --ignore-scripts so no dependency can run
# arbitrary lifecycle code during installation (S6505), then rebuild only
# the allowlisted native modules explicitly — keep the rebuild list in sync
# with allowBuilds in pnpm-workspace.yaml (protobufjs is allowlisted there
# but not present in the installed tree, so it is intentionally omitted).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts \
 && pnpm rebuild better-sqlite3 core-js esbuild sharp workerd

# ---------- build ----------
FROM base AS build
WORKDIR /app
# Declare defaults so plain `docker build` also works; Coolify passes these as
# --build-arg automatically (Build Variable flag, on by default). TINA_TOKEN
# is deliberately ARG-only: ARG values are visible to the RUN that consumes
# them but are not baked into image config or layer metadata the way ENV
# values are, so the credential cannot be recovered from the image.
ARG PUBLIC_TINA_CLIENT_ID=""
ARG TINA_TOKEN=""
ARG SITE_URL="https://thelippincottteam.com"
ARG PUBLIC_CDN_MODE="full-site"
ARG PUBLIC_MEDIA_URL=""
# Coolify sets COOLIFY_BRANCH (Build Variable) — promote it to ENV so
# tina/config.ts branch detection sees it and staging builds don't fall
# back to `main`.
ARG COOLIFY_BRANCH=""
# Coolify passes SOURCE_COMMIT as a build arg when "Include Source Commit in
# Build" is enabled (Application -> General) — promote it to ENV so the
# deploy-commit marker (/__moderaty_commit.txt) is correct. The CI purge
# workflow (.github/workflows/bunny-purge.yml) waits for that marker before
# purging the CDN. Not a credential.
ARG SOURCE_COMMIT=""
ENV PUBLIC_TINA_CLIENT_ID=$PUBLIC_TINA_CLIENT_ID \
    SITE_URL=$SITE_URL \
    PUBLIC_CDN_MODE=$PUBLIC_CDN_MODE \
    PUBLIC_MEDIA_URL=$PUBLIC_MEDIA_URL \
    COOLIFY_BRANCH=$COOLIFY_BRANCH \
    SOURCE_COMMIT=$SOURCE_COMMIT \
    NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=4096
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# tinacms build (client codegen + admin + content index), then astro build.
# BUILD_SCRIPT override mirrors netlify.toml's per-context commands: use
# `build:preview` for staging apps when the branch's Tina schema is not
# indexed by TinaCloud yet (skips the cloud schema check; production client).
# Allowlisted rather than freely interpolated so a mis-set build arg cannot
# inject shell commands.
ARG BUILD_SCRIPT="build"
RUN case "$BUILD_SCRIPT" in \
      build|build:preview|build:local) ;; \
      *) echo "Invalid BUILD_SCRIPT: $BUILD_SCRIPT" >&2; exit 1 ;; \
    esac \
 && pnpm "$BUILD_SCRIPT"

# ---------- runtime ----------
FROM base AS runtime
WORKDIR /app
# Runtime endpoints read SITE_URL from process.env at request time
# (/api/contact's Origin allowlist, /api/bunny-purge's path normalization).
# SITE_URL is deliberately NOT re-declared here: the build stage's URL
# (sitemap/RSS/OpenGraph canonicals) does not carry into this stage, and no
# default is baked in, so SITE_URL must be set explicitly on the app
# (Coolify runtime env var or `docker run -e`). When omitted it stays unset
# and both endpoints fail closed — /api/contact rejects browser Origins that
# are not otherwise allowlisted and /api/bunny-purge answers 503 ("not
# configured") — instead of silently assuming the production origin.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321
COPY package.json pnpm-lock.yaml ./
# Production dependencies only: the standalone server bundle plus native
# modules (sharp) — drops the heavy devDependencies (playwright, tsc, React).
# S6505: --ignore-scripts keeps arbitrary lifecycle code from running at
# install time — safe here because sharp 0.35 ships its platform binaries
# via @img/sharp-* optionalDependencies and has no install script.
COPY pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/dist ./dist
# The generated Tina client + seeded content cache (tina/__generated__) are
# referenced by the /tina-island re-render endpoint at runtime.
COPY --from=build /app/tina ./tina
# Deploy tooling: the container entrypoint (serve + OPT-IN cache purge) and
# the purge script it calls (scripts/bunny-purge.mjs + its shared URL
# normalizer). No purge credential is ever baked into the image — the CI
# workflow holds the key in repository secrets and purges after the deploy is
# serving; BUNNY_PURGE_ON_START is the opt-in last resort for hosts without
# CI.
COPY scripts/bunny-purge.mjs scripts/bunny-url.mjs scripts/cdn-config.mjs ./scripts/
COPY scripts/deploy ./scripts/deploy
USER node
EXPOSE 4321
# Health check via node's built-in fetch — no curl/wget needed in the image.
# Coolify parses this HEALTHCHECK (it takes precedence over its UI checks) and
# gates Traefik routing / rolling updates on it.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/scripts/deploy/docker-entrypoint.sh"]
CMD ["node", "./dist/server/entry.mjs"]
