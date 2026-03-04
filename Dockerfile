FROM node:18-alpine

# Force cache invalidation with timestamp
ARG BUILD_ID=default
ARG BUILD_DATE=unknown

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && \
    # Clear any cached native modules
    rm -rf node_modules/.cache && \
    # Remove sqlite3 completely if present
    rm -rf node_modules/sqlite3 node_modules/@types/sqlite3 && \
    # Verify sql.js is available
    ls node_modules/sql.js > /dev/null && echo "✓ sql.js verified" || echo "✗ sql.js missing"

EXPOSE 3000

CMD ["npm", "start"]
