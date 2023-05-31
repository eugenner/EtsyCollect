FROM node:14.3

WORKDIR /app
COPY package.json .
RUN npm install

COPY . . 
CMD ["npm", "start"]
