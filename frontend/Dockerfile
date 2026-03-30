FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG NEXT_PUBLIC_API_URL=http://backend:8000
ARG NEXT_PUBLIC_SOCKET_URL=http://backend:8000
ARG AUTH_SESSION_SECRET=ci-auth-session-secret-please-rotate
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV AUTH_SESSION_SECRET=$AUTH_SESSION_SECRET
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

EXPOSE 3000
HEALTHCHECK CMD wget --quiet --spider http://127.0.0.1:3000/login || exit 1
CMD ["npm", "start", "--", "-H", "0.0.0.0"]
