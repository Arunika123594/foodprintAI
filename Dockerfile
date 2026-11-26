FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY index.html vite.config.js ./
COPY src ./src
CMD ["npm", "run", "dev:web", "--", "--host", "0.0.0.0"]
