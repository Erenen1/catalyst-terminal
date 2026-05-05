FROM node:20-alpine AS builder

WORKDIR /app

# Sadece bağımlılık dosyalarını kopyala (Cache dostu)
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Bağımlılıkları kur
RUN npm install --workspace=@chaintrigger/shared --workspace=@chaintrigger/web --no-audit --no-fund

# Kaynak kodları kopyala
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build Arguments for Next.js (Must be available during build time)
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

RUN cd packages/shared && npm run build
ENV NEXT_TELEMETRY_DISABLED 1
RUN cd apps/web && npm run build

# --- Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Sadece standalone çıktılarını kopyala
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
