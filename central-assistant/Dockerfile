# SAIL AI Assistant — central service (Stage 2: own store + signed identity).
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev --no-audit --no-fund
COPY *.mjs ./
ENV PORT=8000
EXPOSE 8000
USER node
CMD ["node", "server.mjs"]
