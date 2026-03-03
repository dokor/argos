FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=3016

EXPOSE 3016
CMD ["node", "server.mjs"]