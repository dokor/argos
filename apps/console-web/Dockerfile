# ---- deps ----
FROM node:24.21.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- build ----
FROM node:24.21.0-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# ---- run ----
FROM node:24.21.0-alpine AS run
ARG ARGOS_REVISION=unknown
LABEL org.opencontainers.image.revision=$ARGOS_REVISION \
      org.opencontainers.image.source="https://github.com/dokor/argos"
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
