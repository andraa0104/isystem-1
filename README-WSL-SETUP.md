# WSL + Docker Setup (Windows, Ubuntu-22.04)

This guide is a clean, standalone setup from scratch. It does not modify any existing README.

## Requirements
- Windows 10/11 with WSL2 support
- Ubuntu-22.04 (WSL distro)
- Docker Desktop (WSL2 backend)
- Git
- A MySQL server (choose one):
  - Local MySQL (Laragon/XAMPP), or
  - VPS MySQL at `103.121.122.196`

## 1) Install WSL (Command Prompt or PowerShell as Admin)
```
wsl --install
```
If WSL is already installed, ensure WSL2 is the default:
```
wsl --set-default-version 2
```

## 2) Install Ubuntu-22.04 (Command Prompt or PowerShell as Admin)
```
wsl --install -d Ubuntu-22.04
```

## 3) Verify WSL + Ubuntu
```
wsl -l -v
```
You should see `Ubuntu-22.04` with version `2`.

## 4) Update Ubuntu packages
```
wsl -d Ubuntu-22.04 -- bash -lc "sudo apt update && sudo apt upgrade -y"
```

## 5) Install Git (inside Ubuntu)
```
wsl -d Ubuntu-22.04 -- bash -lc "sudo apt install -y git"
```

## 6) Install Docker Desktop (Windows)
1) Download: https://www.docker.com/products/docker-desktop/
2) Install and select **Use WSL 2 instead of Hyper-V**
3) Open Docker Desktop -> Settings -> Resources -> WSL Integration
4) Enable integration for `Ubuntu-22.04`

## 7) Clone the project into WSL (recommended for speed)
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root && git clone <REPO_URL> isystem"
```

## 8) Create .env (this is the step 9 you asked about)
Copy `.env.example` to `.env`:
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && cp .env.example .env"
```

## 9) Configure MySQL (choose one option)

### Option A: Local MySQL (Laragon/XAMPP)
Edit `/root/isystem/.env` to:
```
DB_CONNECTION=mysql
DB_HOST=host.docker.internal
DB_PORT=3306
DB_DATABASE=dbsja
DB_USERNAME=root
DB_PASSWORD=
```

### Option B: VPS MySQL (103.121.122.196)
Edit `/root/isystem/.env` to:
```
DB_CONNECTION=mysql
DB_HOST=103.121.122.196
DB_PORT=3306
DB_DATABASE=dbsja
DB_USERNAME=<user_vps>
DB_PASSWORD=<pass_vps>
```
You can edit the file using nano:
```
wsl -d Ubuntu-22.04 -- bash -lc "nano /root/isystem/.env"
```
Or update it in one command (replace placeholders):
```
wsl -d Ubuntu-22.04 -- bash -lc "sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=mysql/; s/^DB_HOST=.*/DB_HOST=103.121.122.196/; s/^DB_PORT=.*/DB_PORT=3306/; s/^DB_DATABASE=.*/DB_DATABASE=dbsja/; s/^DB_USERNAME=.*/DB_USERNAME=<user_vps>/; s/^DB_PASSWORD=.*/DB_PASSWORD=<pass_vps>/' /root/isystem/.env"
```

## 10) Start the stack (from WSL)
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && docker compose -f docker-compose.dev.yml up -d --build"
```

## 11) Access the app
- App: `http://localhost:8080`
- Vite dev server: `http://localhost:5173`

## 11.1) Start again after PC restart
1) Open Docker Desktop and wait until it shows "Running".
2) Run from WSL:
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && docker compose -f docker-compose.dev.yml up -d"
```
Tips:
- Enable "Start Docker Desktop when you log in".
- (Optional) Use Task Scheduler to run `docker compose ... up -d` after Docker Desktop is ready.

## 12) Common commands
Check status:
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && docker compose -f docker-compose.dev.yml ps"
```
Restart app container:
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && docker compose -f docker-compose.dev.yml restart app"
```
Stop all:
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && docker compose -f docker-compose.dev.yml down"
```
Pull latest changes from GitHub:
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && git pull"
```
If you have local changes and get conflicts:
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && git status"
```
You can temporarily stash local changes:
```
wsl -d Ubuntu-22.04 -- bash -lc "cd /root/isystem && git stash && git pull && git stash pop"
```

## Notes
- This project uses tenant databases (dbsja, dbbbbs, etc.). `.env` selects the DB host; the tenant selects the DB name.
- For best performance, keep the repo inside WSL (`/root/isystem`) instead of `C:\`.
