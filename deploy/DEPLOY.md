# Stroke Day — Server par deploy karne ke steps

Teen hisse hain:

| Project | Server par | URL (example) |
|---|---|---|
| StrokeDayLandingBackend | Node + PM2, port 5000, Nginx proxy | https://api.strokeday.example.com |
| StrokeDayLanding | `dist/` static, Nginx | https://strokeday.example.com |
| strokeday-admin-cms | `dist/` static, Nginx | https://admin.strokeday.example.com |

Database Supabase par hai, server par Postgres install nahi karna.
Neeche ke commands Ubuntu 22.04/24.04 VPS ke liye hain.

## 1. DNS

Domain panel me teeno subdomains ka **A record** server ke public IP par point karo.

## 2. Server setup (ek baar)

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
sudo apt install -y certbot python3-certbot-nginx
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

sudo mkdir -p /var/www/strokeday/{landing,admin,uploads}
sudo chown -R $USER:$USER /var/www/strokeday
```

## 3. Backend

```bash
cd /var/www/strokeday
git clone https://github.com/Ms-Anurupa/strokeDayLandingBackend.git api
cd api
cp .env.example .env
nano .env        # DATABASE_URL, DIRECT_URL, JWT_SECRET, CORS_ORIGINS, UPLOAD_DIR bharo
npm ci --omit=dev
npm run migrate:deploy
```

`JWT_SECRET` banane ke liye:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Pehla admin account banao (password kam se kam 12 characters):

```bash
ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD='StrongPasswordHere' npm run create-admin
```

Purani local videos (`uploads/videos/*`) chahiye toh unhe `/var/www/strokeday/uploads/videos/` me copy karo (scp/WinSCP se).

App start karo aur reboot par auto-start set karo:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup      # jo command ye print kare, wo chalao
curl http://127.0.0.1:5000/health
```

## 4. Landing page aur CMS build

Apne computer par (ya server par) build karo. `VITE_API_URL` build ke time bake hota hai.

```bash
# StrokeDayLanding
echo "VITE_API_URL=https://api.strokeday.example.com" > .env.production
npm ci && npm run build
# dist/ ka content -> /var/www/strokeday/landing/

# strokeday-admin-cms
echo "VITE_API_URL=https://api.strokeday.example.com" > .env.production
npm ci && npm run build
# dist/ ka content -> /var/www/strokeday/admin/
```

Windows se upload: `scp -r dist/* user@SERVER_IP:/var/www/strokeday/landing/`

## 5. Nginx + SSL

```bash
sudo cp /var/www/strokeday/api/deploy/nginx-strokeday.conf /etc/nginx/sites-available/strokeday
sudo nano /etc/nginx/sites-available/strokeday     # example domains badlo
sudo ln -s /etc/nginx/sites-available/strokeday /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d strokeday.example.com -d admin.strokeday.example.com -d api.strokeday.example.com
```

## 6. Check karo

- `https://api.../health` → `{"success":true,"database":"up"}`
- `https://api.../participants/getAllParticipants` → **401** aana chahiye (data public nahi hai)
- Landing par ek attendee aur ek participant (video ke saath) register karo
- `https://admin...` par login karo, dono entries dikhni chahiye, video khulna chahiye

## Update deploy

```bash
cd /var/www/strokeday/api && git pull && npm ci --omit=dev && npm run migrate:deploy && pm2 restart strokeday-api
```

Frontend: dobara `npm run build` karke `dist/` upload karo.

## Backup

- Database: Supabase dashboard → Database → Backups
- Videos: `/var/www/strokeday/uploads` ka regular backup lo (e.g. `rsync` ya VPS snapshot)

## Logs

```bash
pm2 logs strokeday-api
sudo tail -f /var/log/nginx/error.log
```
