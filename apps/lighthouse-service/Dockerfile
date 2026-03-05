FROM node:20-slim

WORKDIR /app

# Installe Lighthouse
RUN npm install -g lighthouse

COPY server.mjs .

EXPOSE 3017

CMD ["node", "server.mjs"]