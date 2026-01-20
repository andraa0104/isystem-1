# Database Host Setup (Docker)

This guide explains how to switch the database host for the app when running
with Docker. It covers local XAMPP/Laragon and a VPS host.

## A) XAMPP/Laragon (Local Host DB)

1) Allow remote connections in MySQL config (my.ini/my.cnf):
   - Set bind-address = 0.0.0.0
   - Restart MySQL

2) Create a DB user that can connect remotely:

   CREATE USER 'abdul'@'%' IDENTIFIED BY 'aq1sw2de3';
   GRANT ALL PRIVILEGES ON dbsja.* TO 'abdul'@'%';
   FLUSH PRIVILEGES;

3) Update .env:

   DB_HOST=host.docker.internal
   DB_PORT=3306
   DB_DATABASE=dbsja
   DB_USERNAME=abdul
   DB_PASSWORD=aq1sw2de3

   Notes:
   - Windows/Mac: use host.docker.internal
   - Linux: use your host LAN IP (e.g. 192.168.x.x)

4) Recreate the app container to pick up env changes:

   docker compose up -d --force-recreate app

5) Clear Laravel config cache:

   docker compose exec app php artisan config:clear

6) Hard refresh the browser.

## B) VPS (Remote DB Host)

1) Ensure MySQL allows remote connections:
   - Set bind-address = 0.0.0.0
   - Open port 3306 in firewall (UFW/security group)

2) Create a DB user that can connect remotely:

   CREATE USER 'abdul'@'%' IDENTIFIED BY 'aq1sw2de3';
   GRANT ALL PRIVILEGES ON dbsja.* TO 'abdul'@'%';
   FLUSH PRIVILEGES;

3) Update .env:

   DB_HOST=103.121.122.196
   DB_PORT=3306
   DB_DATABASE=dbsja
   DB_USERNAME=abdul
   DB_PASSWORD=aq1sw2de3

4) Recreate the app container to pick up env changes:

   docker compose up -d --force-recreate app

5) Clear Laravel config cache:

   docker compose exec app php artisan config:clear

6) Hard refresh the browser.

## Common Notes

- If you use docker-compose.override.yml, ensure it does not override DB_HOST.
- If the app still shows old data, confirm the container env:

  docker compose exec app printenv | rg "DB_HOST|DB_DATABASE|DB_USERNAME"
