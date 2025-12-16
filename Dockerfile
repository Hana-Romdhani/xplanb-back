# ---------- BUILD STAGE ----------
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy full project
COPY . .

# Build NestJS app
RUN npm run build


# ---------- PRODUCTION STAGE ----------
FROM node:18-alpine AS production

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy only required files
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
RUN mkdir -p /usr/src/app/uploads/images \
&& chown -R node:node /usr/src/app/uploads
USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]
