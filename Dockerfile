# syntax=docker/dockerfile:1.6
# ─── Stage 1 ─ build ─────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Where the actual Vite project lives in this monorepo-ish layout
ARG APP_DIR=recruitment-ats-app/recruitment-ats-app

# Initial admin seed (baked into the bundle as VITE_* vars). One-time
# bootstrap — admin is forced to rotate on first sign-in.
ARG VITE_INITIAL_ADMIN_EMAIL=admin@ats.local
ARG VITE_INITIAL_ADMIN_PASSWORD=ChangeMe@1234
ARG VITE_INITIAL_ADMIN_NAME=Administrator
ENV VITE_INITIAL_ADMIN_EMAIL=${VITE_INITIAL_ADMIN_EMAIL} \
    VITE_INITIAL_ADMIN_PASSWORD=${VITE_INITIAL_ADMIN_PASSWORD} \
    VITE_INITIAL_ADMIN_NAME=${VITE_INITIAL_ADMIN_NAME}

# Install deps with cached layer (only re-runs on package*.json change)
COPY ${APP_DIR}/package.json ${APP_DIR}/package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy sources and build
COPY ${APP_DIR}/ ./
RUN npm run build

# ─── Stage 2 ─ runtime (nginx) ───────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Replace default site with our SPA config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/ats.conf

# Static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Healthcheck — index.html must be reachable from inside the container
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
