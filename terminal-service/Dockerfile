FROM node:20

# Install build dependencies for node-pty
RUN apt-get update && apt-get install -y python3 make g++ 

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["node", "index.js"]
