FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=builder /app/build ./build
COPY --from=builder /app/src/lib/server/db/migrations ./src/lib/server/db/migrations
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && apk del python3 make g++
EXPOSE 5173
ENV PORT=5173
ENV HOST=0.0.0.0
CMD ["node", "build"]
