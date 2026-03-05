FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
# Installe Lighthouse
RUN npm ci --omit=dev

COPY server.mjs .

ENV NODE_ENV=production
ENV PORT=3017

EXPOSE 3017

CMD ["npm", "run", "start"]