# Setup Tutorial (Docker)

Dokumen ini menjelaskan cara setup proyek `isystem` di komputer baru dengan Docker.
Ada 2 skenario utama:
1) Local DB (MySQL di komputer yang sama)
2) VPS DB (MySQL di server 103.121.122.196)

---

## Prerequisites (Wajib untuk semua)

1) Install Docker Desktop dan aktifkan engine WSL2.
2) Aktifkan WSL Integration di Docker Desktop:
   - Settings -> Resources -> WSL Integration
   - Enable integration dengan distro WSL Anda
   - Centang `Ubuntu-22.04` (atau distro yang Anda pakai)
   - Klik Apply & Restart
3) (Opsional tapi disarankan) Install Ubuntu WSL:
   ```
   wsl --install -d Ubuntu-22.04
   ```
4) Clone atau copy folder `isystem` ke komputer baru.

---

## Tutorial 1 - Local DB (MySQL di komputer yang sama)

### 1) Update `.env`
Atur URL aplikasi dan konfigurasi DB:
```
APP_URL=http://localhost:8080
ASSET_URL=http://localhost:8080

DB_HOST=host.docker.internal
DB_PORT=3306
DB_DATABASE=dbsja
DB_USERNAME=your_local_user
DB_PASSWORD=your_local_password
```

### 2) Start Docker
Production mode:
```
docker compose -f isystem/docker-compose.yml up -d --build
```

Development mode (hot reload):
```
docker compose -f isystem/docker-compose.yml -f isystem/docker-compose.dev.yml up -d
```

### 3) Buka aplikasi
```
http://localhost:8080
```

---

## Tutorial 2 - VPS DB (Host: 103.121.122.196)

### 1) Update `.env`
Atur URL aplikasi dan konfigurasi DB:
```
APP_URL=http://localhost:8080
ASSET_URL=http://localhost:8080

DB_HOST=103.121.122.196
DB_PORT=3306
DB_DATABASE=dbsja
DB_USERNAME=abdul
DB_PASSWORD=your_vps_password
```

### 2) Start Docker
```
docker compose -f isystem/docker-compose.yml up -d --build
```

### 3) Pastikan akses VPS dibuka
- Port 3306 dibuka di firewall
- User `abdul` di MySQL boleh akses dari IP client Anda

---

## Catatan Penting

- Jika Anda mengubah `.env`, restart container:
  ```
  docker compose -f isystem/docker-compose.yml up -d
  ```
- Untuk dev mode di WSL, jalankan perintah `docker compose` dari dalam Ubuntu WSL untuk performa file yang lebih baik.

