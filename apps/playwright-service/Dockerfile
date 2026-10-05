FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.mjs app.mjs domain.mjs ./

ENV NODE_ENV=production
ENV PORT=3016

EXPOSE 3016
CMD ["npm", "run", "start"]
