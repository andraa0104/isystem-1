FROM php:8.2-fpm-bullseye AS asset-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    curl \
    git \
    gnupg \
    unzip \
    libzip-dev \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    && docker-php-ext-install pdo_mysql zip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN printf "APP_NAME=Laravel\nAPP_ENV=production\nAPP_KEY=base64:%s\nAPP_DEBUG=false\nAPP_URL=http://localhost\nDB_CONNECTION=sqlite\nDB_DATABASE=/tmp/database.sqlite\n" "$(php -r 'echo base64_encode(random_bytes(32));')" > .env \
    && touch /tmp/database.sqlite

RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist
RUN npm ci
RUN (npm run build || true) && mkdir -p public/build

FROM php:8.2-fpm-bullseye

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    libicu-dev \
    && rm -rf /etc/nginx/sites-enabled/default \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install pdo_mysql intl

WORKDIR /var/www/html

COPY . .
RUN rm -f public/hot
COPY --from=asset-builder /var/www/html/vendor /var/www/html/vendor
COPY --from=asset-builder /var/www/html/public/build /var/www/html/public/build
COPY --from=asset-builder /var/www/html/bootstrap/cache /var/www/html/bootstrap/cache

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80

ENTRYPOINT ["entrypoint.sh"]
CMD ["/usr/bin/supervisord","-c","/etc/supervisor/conf.d/supervisord.conf"]
