# Base image pinned by manifest-list digest (resolved 2026-07-19 via Docker Hub
# API, tag node:22-alpine last pushed 2026-06-23). Bump via Dependabot docker
# ecosystem updates or by re-resolving the tag digest — do not float unpinned.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_RELEASE
# TODO(audit F3): build-time service-role key lands in image history. Move to a
# BuildKit secret (--secret id=...,env=...) or drop entirely once the public
# catalog prerender reads through RLS-safe public access instead of admin.
ARG SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

# Node-native health check against the pure liveness route — no curl/wget
# installed solely for probing (directive 8.7).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/live').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]