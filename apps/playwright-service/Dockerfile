FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=3016

EXPOSE 3016
CMD ["npm", "run", "start"]