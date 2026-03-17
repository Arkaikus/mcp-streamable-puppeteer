FROM oven/bun:1

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

EXPOSE 8000

CMD ["bun", "run", "src/index.ts"]
