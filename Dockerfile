# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for caching dependencies
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the source code
COPY ./src ./src
COPY tsconfig.json ./

# Default command to start your bot
CMD ["npx", "tsx", "src/bot.ts"]
