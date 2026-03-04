FROM node:18-alpine

# Force cache invalidation
ARG BUILD_ID=default

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
