# SAIL AI Assistant — Stage 1 central service (documentation answers only).
# Zero npm dependencies: Node 20 built-ins only, so no install step and no lockfile.
FROM node:20-alpine
WORKDIR /app
COPY server.mjs .
ENV PORT=8000
EXPOSE 8000
USER node
CMD ["node", "server.mjs"]
