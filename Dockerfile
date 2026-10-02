FROM php:8.2-apache

RUN docker-php-ext-install curl pdo_mysql

WORKDIR /var/www/html
COPY . .

RUN rm -f .env.local \
    && chown -R www-data:www-data /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]