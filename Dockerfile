FROM node:9.3.0-alpine

WORKDIR /usr/app
COPY package.json .
RUN npm install
COPY . .

CMD ["node", "app.js"]
