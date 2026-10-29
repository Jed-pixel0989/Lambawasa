FROM node:22-alpine AS frontend

WORKDIR /app

COPY my-react-app/package.json my-react-app/package-lock.json ./
RUN npm ci

COPY my-react-app/ ./
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build -- --base=/

FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite

COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY api/ /var/www/html/api/
COPY --from=frontend /app/dist/ /var/www/html/

EXPOSE 80
