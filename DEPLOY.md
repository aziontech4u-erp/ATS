# Deploying the ATS to the VPS

Target: `https://recruitment.erpoman.in/` (public) — proxied by nginx-proxy-manager
on the VPS at `72.61.201.164` to **port 5174** of this container.

The ATS is a static SPA (Vite + React) — there is no backend, no database. The
production container is just **nginx serving the built `dist/`** with an SPA fallback
so `/ats-jobform` (and any future client routes) survive a refresh.

---

## 0. Prerequisites on the VPS

```sh
# Docker Engine + Compose v2
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker

# (Optional) let your user run docker without sudo
sudo usermod -aG docker $USER && newgrp docker
```

## 1. Pull the repo

```sh
cd /opt
sudo git clone https://github.com/aziontech4u-erp/ATS.git
sudo chown -R $USER:$USER ATS
cd ATS
```

## 2. Configure the host port + initial admin

```sh
cp .env.example .env
# Edit .env and set, at minimum:
#   APP_PORT=5174                                ← matches NPM forward
#   VITE_INITIAL_ADMIN_EMAIL=admin@ziontech.local
#   VITE_INITIAL_ADMIN_PASSWORD=...              ← pick something strong-ish
#   VITE_INITIAL_ADMIN_NAME=ZIONTECH Admin
```

> **Important security note.** The initial password is baked into the
> client bundle at build time. Anyone who downloads the JS can read it.
> That's why the app forces an immediate password rotation on first
> sign-in — once that's done, the bundled string stops being a valid
> credential. Pick something one-time-use here, not your real password.

## 3. Build and start

```sh
docker compose up -d --build
```

First build takes a few minutes (npm install + Vite build).
After it's running:

```sh
docker compose ps
docker compose logs -f ats-app
curl -s http://127.0.0.1:5174/healthz   # → "ok"
curl -sI http://127.0.0.1:5174/         # → 200, text/html
curl -sI http://127.0.0.1:5174/ats-jobform  # → 200, text/html (SPA fallback)
```

## 4. nginx-proxy-manager (already configured)

Your proxy host is already set up:

| Field                  | Value                       |
| ---------------------- | --------------------------- |
| Domain Names           | `recruitment.erpoman.in`    |
| Scheme                 | `http`                      |
| Forward Hostname / IP  | `72.61.201.164`             |
| Forward Port           | `5174`                      |
| Websockets Support     | recommended **on**          |
| Block Common Exploits  | recommended **on**          |
| SSL (Let's Encrypt)    | enable with HTTP/2 + HSTS   |

Nothing else needs to change in NPM. Verify in your browser:

- `https://recruitment.erpoman.in/` — main app (login screen).
- `https://recruitment.erpoman.in/ats-jobform` — public intake form.

### First sign-in (one time)

1. Open the app — you see the **Sign in to your ATS** screen.
2. Use the email + password from the `VITE_INITIAL_ADMIN_*` values in `.env`.
3. The app immediately routes you to **Set a New Password** — there is no
   way around this screen. Pick a strong password (10+ chars, upper +
   lower + digit + symbol) and save.
4. After that, the initial password no longer works. Future sign-ins use
   the new one. You can rotate again any time from **Company Settings →
   Security → Change Password**.

If you ever lose the admin password, clear the browser's localStorage
(`recruitment_ats_admin_v1` and `recruitment_ats_session`) and the next
visit will re-seed from the build-time defaults. There is no email-based
recovery because there is no backend.

## 5. Updating after a `git push`

```sh
cd /opt/ATS
git pull origin main
docker compose up -d --build
```

Old containers + dangling images are replaced atomically; downtime is a
couple of seconds while nginx restarts.

## 6. Common operations

```sh
# Tail logs
docker compose logs -f ats-app

# Restart only
docker compose restart ats-app

# Stop / start
docker compose down
docker compose up -d

# Inspect health
docker inspect --format '{{json .State.Health}}' ats-app | jq

# Clean up old images
docker image prune -f
```

## 7. Backups

All ATS data (candidates, jobs, interviews, offers, company settings,
reminders, login session, AI key) lives in **the user's browser localStorage**
— nothing is stored in this container.

To export, use **Company Settings → Backup → Download Backup** inside the app.
The downloaded JSON can be restored from **Restore Backup** on any machine.

## 8. Troubleshooting

**Port 5174 already in use on the host.** Edit `.env`, set `APP_PORT` to a free
port, and update the NPM forward port to match.

**`/ats-jobform` 404s on direct visit.** The container's nginx already handles
this. If you're seeing it, you're hitting a *different* server (test
`curl -sI http://72.61.201.164:5174/ats-jobform` directly).

**Build fails on the VPS with `JavaScript heap out of memory`.** Pre-build the
image elsewhere and push:

```sh
# on your dev machine
docker build -t ghcr.io/aziontech4u-erp/ats:latest .
docker push ghcr.io/aziontech4u-erp/ats:latest

# on the VPS — swap the `build:` block in docker-compose.yml for
# image: ghcr.io/aziontech4u-erp/ats:latest
docker compose pull && docker compose up -d
```

**Confirm assets come back gzipped.**

```sh
curl -sIH 'Accept-Encoding: gzip' https://recruitment.erpoman.in/assets/<filename>.js \
  | grep -i content-encoding
# → content-encoding: gzip
```
