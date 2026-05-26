# Stage 1: Build the Vite/React application
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies in cache-friendly way
COPY frontend/package*.json ./
RUN npm ci

# Copy sources and build
COPY frontend/ .
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Serve using production NGINX
FROM nginx:1.25-alpine

# Set security headers and configurations
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to default NGINX server directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
