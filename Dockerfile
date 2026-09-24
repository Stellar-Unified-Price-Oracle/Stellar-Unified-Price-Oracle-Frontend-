# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
# Install production + dev dependencies using the exact lockfile.
# Cached as a separate layer so code changes don't reinstall node_modules.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# `npm ci` respects the exact lockfile — no version drift in the image.
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — development
# Runs the Vite dev server with hot module replacement.
# Source code is bind-mounted at runtime via Docker Compose so edits on the
# host are reflected instantly without rebuilding the image.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS development

WORKDIR /app

# Copy installed modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files for npm scripts
COPY package.json package-lock.json ./

# Expose Vite's default dev port
EXPOSE 5173

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Vite must listen on 0.0.0.0 inside the container to be reachable from the host
ENV HOST=0.0.0.0

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5173/ || exit 1

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — builder
# Type-checks and produces the optimised production bundle.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args are baked into the static bundle at build time
ARG VITE_API_URL=/api
ARG VITE_WS_URL=ws://localhost:3000

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4 — production
# Serves the built assets with Nginx. Minimal image — no Node, no source code.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove the default Nginx config and replace with our SPA-friendly one
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/app.conf

# Copy the production bundle from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
