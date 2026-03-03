FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start"]