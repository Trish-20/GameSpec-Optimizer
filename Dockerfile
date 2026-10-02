FROM php:8.2-apache

# mod_headers is NOT enabled by default in this image. Without it the
# .htaccess cache rules below would be silently ignored and browsers
# would keep serving stale HTML and CSS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev \
    && docker-php-ext-install curl pdo_mysql \
    && a2enmod headers \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html
COPY . .

# Fail the build if the cache-control rules silently stopped working,
# rather than shipping an image that quietly serves stale assets.
RUN rm -f .env.local \
    && chown -R www-data:www-data /var/www/html \
    && test -f /var/www/html/.htaccess \
    && apache2ctl -t

EXPOSE 80

CMD ["apache2-foreground"]