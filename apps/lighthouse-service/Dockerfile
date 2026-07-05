FROM node:20-slim

WORKDIR /app

# Lighthouse s'appuie sur un navigateur installé dans l'image.
# chromium est fourni par Debian et son binaire est exposé via CHROME_PATH.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.mjs .

ENV NODE_ENV=production
ENV PORT=3017
ENV CHROME_PATH=/usr/bin/chromium

EXPOSE 3017

CMD ["npm", "run", "start"]