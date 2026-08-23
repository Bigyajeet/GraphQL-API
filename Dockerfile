FROM oven/bun:1 AS base
WORKDIR /app

# Copy dependency specifications
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies
RUN bun install

# Copy application source code
COPY . .

# Generate Prisma Client
RUN bun run prisma generate

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

CMD ["bun", "run", "src/server.ts"]
