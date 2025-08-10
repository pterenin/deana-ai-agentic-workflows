# Dependencies (prod only)
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Build (needs dev deps for TypeScript)
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime (minimal, non-root)
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
# Copy runtime deps and built code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/lib ./lib
COPY package*.json ./
# Drop privileges
RUN addgroup -S app && adduser -S app -G app \
  && chown -R app:app /app
USER app
EXPOSE 3060
CMD ["node", "lib/streaming-agents-server.js"]
