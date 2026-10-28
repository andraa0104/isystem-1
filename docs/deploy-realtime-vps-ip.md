# Deploy realtime PR dan PO In ke VPS melalui IP

Panduan ini untuk aplikasi yang diakses melalui **HTTP dengan IP VPS**.
Browser mengakses aplikasi seperti biasa, lalu membuka WebSocket ke
`ws://IP_VPS:8081`. Port 8080 untuk phpMyAdmin tetap seperti sebelumnya.
Reverb menggunakan PHP; frontend di-install dan di-build dengan Bun.

Ganti `IP_VPS`, `/var/www/isystem-1`, `USER_SSH`, dan `www-data` sesuai server.
Contoh proses permanen di bawah menggunakan Supervisor pada Ubuntu/Debian.
Gunakan user deploy untuk Git, Composer, dan Bun. Gunakan sudo hanya untuk
pengaturan service dan firewall yang memerlukannya.

## 1. Commit dan push dari komputer lokal

Jalankan dari terminal PowerShell pada root project. Tinjau status terlebih dulu:

```powershell
git status --short
```

Stage hanya berkas implementasi realtime berikut:

```powershell
git add -- .env.example composer.json composer.lock package.json package-lock.json bootstrap/app.php config/broadcasting.php config/reverb.php routes/channels.php app/Events/PurchaseOrderInChanged.php app/Events/PurchaseRequirementChanged.php app/Http/Controllers/Marketing/PurchaseOrderInController.php app/Http/Controllers/Marketing/PurchaseRequirementController.php resources/js/lib/po-in-realtime.js resources/js/pages/marketing/purchase-order-in/index.jsx resources/js/pages/marketing/purchase-requirement/index.jsx docs/po-in-websocket.md docs/deploy-realtime-vps-ip.md
git diff --cached --stat
git diff --cached
```

Pastikan staging berisi perubahan yang ingin dipublikasikan. Jika sebelumnya ada
berkas lain yang sudah di-stage, tinjau juga sebelum commit. `.env` server tidak
ikut di-push. Setelah diperiksa:

```powershell
git commit -m "Add realtime updates for PR and PO In using Reverb"
git push origin main
```

Contoh memakai branch `main`. Sesuaikan jika branch deployment berbeda.

## 2. Ambil perubahan di VPS

Login ke VPS dan masuk ke direktori aplikasi:

```sh
ssh USER_SSH@IP_VPS
cd /var/www/isystem-1
git status --short
git pull --ff-only origin main
composer install --no-dev --prefer-dist --optimize-autoloader
bun install
```

Jika Git melaporkan konflik atau perubahan lokal di VPS, selesaikan terlebih dulu
tanpa menimpa perubahan server. Gunakan `composer install` agar versi dependency
mengikuti `composer.lock` yang sudah diuji. `bun install` memasang dependency dari
`package.json`; jika belum ada lockfile Bun, Bun dapat memigrasikan `package-lock.json`.
Untuk deploy berikutnya, commit `bun.lock` dari lingkungan pengembangan yang
menggunakan versi Bun yang sama, lalu gunakan `bun install --frozen-lockfile`.

## 3. Atur .env VPS

```sh
nano .env
```

Tambahkan atau ubah variabel berikut. Ganti contoh IP dengan IP VPS yang sebenarnya.
Pastikan hanya ada satu definisi untuk setiap variabel:

```dotenv
BROADCAST_CONNECTION=reverb

REVERB_APP_ID=isystem-production
REVERB_APP_KEY=GANTI_DENGAN_KEY_ACAK
REVERB_APP_SECRET=GANTI_DENGAN_SECRET_ACAK

REVERB_HOST=127.0.0.1
REVERB_PORT=8081
REVERB_SCHEME=http
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8081

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST=203.0.113.10
VITE_REVERB_PORT=8081
VITE_REVERB_SCHEME=http
```

`VITE_REVERB_HOST` hanya berisi IP, tanpa `http://`, path, atau nomor port.
`REVERB_HOST=127.0.0.1` adalah alamat Laravel untuk menerbitkan event dari server;
`REVERB_SERVER_HOST=0.0.0.0` membuat Reverb menerima koneksi dari browser luar VPS.
Jangan mengubah `APP_URL` atau `ASSET_URL` ke port WebSocket: keduanya tetap memakai
alamat aplikasi yang saat ini berjalan, termasuk port aplikasi jika ada.

Jika belum mempunyai key/secret Reverb, jalankan perintah berikut **dua kali**,
lalu isi hasil pertama sebagai key dan hasil kedua sebagai secret:

```sh
php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
```

Jika key/secret production sudah ada, gunakan nilai yang sama. Biarkan `APP_KEY`
Laravel yang sudah ada tetap seperti sebelumnya.

Pastikan cache aplikasi berfungsi. Jika menggunakan `CACHE_STORE=database` tetapi
database tenant tidak memiliki tabel `cache`, ubah ke:

```dotenv
CACHE_STORE=file
```

Jika sudah memakai Redis atau cache lain yang berfungsi, pertahankan konfigurasi
tersebut. Dengan config cache Laravel aktif, override environment pada proses
Supervisor tidak mengganti nilai cache yang sudah tersimpan; atur `.env` sebelum
membuat ulang config cache. User service harus dapat menulis `storage` dan
`bootstrap/cache`.

## 4. Build dengan Bun

```sh
php artisan config:clear
php artisan route:clear
bun run build
php artisan config:cache
```

`VITE_REVERB_*` dimasukkan ke hasil build. Jika IP, port, atau key berubah, jalankan
build lagi. Deploy realtime ini tidak menambahkan migrasi database.

## 5. Buka akses TCP 8081

Jika VPS menggunakan UFW yang aktif:

```sh
sudo ufw status
sudo ufw allow 8081/tcp
```

Jika penyedia VPS memiliki firewall/security group tersendiri, izinkan juga
**inbound TCP 8081** di panel tersebut untuk jaringan pengguna aplikasi. Tidak
perlu mengubah port aplikasi atau phpMyAdmin.

## 6. Jalankan Reverb permanen dengan Supervisor

Jika Supervisor belum tersedia pada Ubuntu/Debian:

```sh
sudo apt-get update
sudo apt-get install supervisor
sudo systemctl enable --now supervisor
```

Cari PHP CLI yang digunakan aplikasi:

```sh
command -v php
php -v
```

Buat konfigurasi Supervisor:

```sh
sudo nano /etc/supervisor/conf.d/isystem-reverb.conf
```

Isi, dengan menyesuaikan path PHP, direktori project, dan user service:

```ini
[program:isystem-reverb]
directory=/var/www/isystem-1
command=/usr/bin/php /var/www/isystem-1/artisan reverb:start --host=0.0.0.0 --port=8081
user=www-data
autostart=true
autorestart=true
startsecs=3
stopasgroup=true
killasgroup=true
redirect_stderr=true
stdout_logfile=/var/www/isystem-1/storage/logs/reverb.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=3
```

Aktifkan dan periksa:

```sh
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status isystem-reverb
ss -ltnp | grep ':8081'
```

Status service seharusnya `RUNNING` dan port 8081 seharusnya listening. Jika sudah
ada proses Reverb manual atau service lama, hentikan melalui pengelola prosesnya
sebelum menjalankan service ini agar port tidak dipakai dua proses. Fitur ini
menggunakan broadcast langsung; tidak memerlukan queue worker tambahan.

## 7. Uji realtime

Untuk memeriksa koneksi dari perangkat pengguna, buka aplikasi yang sudah dideploy pada dua browser atau
perangkat dan login pada database perusahaan yang sama. Setelah update deployment,
muat ulang sekali tab lama agar kode WebSocket terbaru terpasang.

- Browser A: input PR yang benar-benar terkait PO In, lalu simpan.
- Browser B: buka daftar PR; baris, total, dan ringkasannya harus berubah sesuai filter.
- Buka juga PO In di browser B; Belum PR, Sisa PR, PR selesai, dan detail yang
  terbuka harus diperbarui berdasarkan hasil query bisnis.

Di Developer Tools browser, tab Network → WS harus menunjukkan koneksi ke
`ws://IP_VPS:8081/app/...` dengan status `101 Switching Protocols`. Request
`/broadcasting/auth` harus berhasil dengan status 200 setelah login. Port 8081
merupakan endpoint WebSocket, bukan halaman web biasa untuk dibuka di address bar.

## 8. Deploy berikutnya

Setelah commit dan push dari lokal, di VPS:

```sh
cd /var/www/isystem-1
git pull --ff-only origin main
composer install --no-dev --prefer-dist --optimize-autoloader
bun install
php artisan config:clear
php artisan route:clear
bun run build
php artisan config:cache
sudo supervisorctl restart isystem-reverb
sudo supervisorctl status isystem-reverb
```

Jika sudah ada `bun.lock` yang sesuai dan dilacak Git, ganti `bun install` dengan
`bun install --frozen-lockfile`. Jika aplikasi memakai PHP-FPM/Octane dengan kode
yang menetap di memori, lakukan reload melalui prosedur deployment server yang biasa.

## Jika belum tersambung

```sh
sudo supervisorctl status isystem-reverb
tail -n 100 storage/logs/reverb.log
tail -n 100 storage/logs/laravel.log
ss -ltnp | grep ':8081'
```

- `Connection refused`: periksa service, host bind, dan port 8081.
- Timeout dari browser luar, tetapi service sudah listening: periksa UFW dan firewall provider VPS.
- Browser mencoba `localhost` atau port 8080: periksa `VITE_REVERB_*`, build ulang,
  lalu muat ulang tab untuk mengambil asset terbaru.
- `/broadcasting/auth` 401/403: pastikan login aktif dan database perusahaan sesuai.
- Error tabel `cache` tidak ada: perbaiki `CACHE_STORE`, lalu config cache dan restart service.
- Jika aplikasi sebenarnya memakai **HTTPS**, gunakan panduan reverse proxy di
  `po-in-websocket.md`; browser HTTPS membutuhkan koneksi `wss://`.

Referensi: [Laravel Reverb](https://laravel.com/docs/12.x/reverb) dan
[Bun install](https://bun.com/docs/pm/cli/install).
