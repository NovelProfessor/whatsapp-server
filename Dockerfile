FROM node:22

RUN apt-get update && apt-get install -y \
    libgbm-dev \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxrandr2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libwayland-client0 \
    libwayland-cursor0 \
    libwayland-egl1 \
    libx11-xcb1 \
    libdbus-1-3

WORKDIR /app

COPY . .

RUN npm ci

RUN mkdir /data
RUN mkdir /media

VOLUME /data
VOLUME /media

ENTRYPOINT ["node", "server.js"]