# ─── Stage 1: Next.js 빌드 ───────────────────────────────────────────────────
FROM node:20-alpine AS dashboard-builder

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard/ ./

# 빌드 시점에 환경변수 없어도 됨 — 런타임에 주입
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# ─── Stage 2: 최종 이미지 (Python + Node.js) ─────────────────────────────────
FROM python:3.11-slim

# Node.js 설치
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python 파이프라인 ──────────────────────────────────────────────────────────
COPY pipeline/requirements.txt ./pipeline/
RUN pip install --no-cache-dir -r pipeline/requirements.txt

COPY pipeline/ ./pipeline/

# ── Next.js 대시보드 (빌드 결과물만 복사) ─────────────────────────────────────
COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm ci --omit=dev

COPY --from=dashboard-builder /app/dashboard/.next ./dashboard/.next
COPY --from=dashboard-builder /app/dashboard/public ./dashboard/public

# ── 시작 스크립트 ──────────────────────────────────────────────────────────────
COPY docker-start.sh ./
RUN chmod +x docker-start.sh

EXPOSE 3000

CMD ["./docker-start.sh"]
