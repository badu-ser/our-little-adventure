# Our Little Adventure 💗

A lightweight, mobile-friendly romantic two-player platform game. One Node.js process serves the static site and synchronizes room state over WebSockets.

## Features
- Room codes; maximum two players per room
- Cute 2D platform world, moving/jumping and collectible hearts
- Touch controls on phones and keyboard controls on desktop
- Restart and win state
- Tiny in-room chat and rotating romantic notes
- No database, account system, image assets, or paid API required

## Run locally
Requires Node.js 18+.

```bash
npm install
npm start
```
Open `http://localhost:3000`. For testing two players on one machine, open two browser windows and join the same room code.

## Deploy on an OCI Ubuntu VPS
These steps assume Ubuntu 22.04/24.04 and an SSH session.

### 1. Install Node.js and unzip
```bash
sudo apt update
sudo apt install -y curl unzip
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 2. Upload the project
From your computer, upload `akshaya-love-game.zip` to your home folder using `scp` or your SSH app's file transfer. Then on the VPS:

```bash
mkdir -p ~/apps/akshaya-love-game
unzip ~/akshaya-love-game.zip -d ~/apps/akshaya-love-game
cd ~/apps/akshaya-love-game
npm install --omit=dev
npm start
```
The game should log that it is running on port 3000. Test locally on the VPS with `curl -I http://127.0.0.1:3000`. Stop the foreground server with Ctrl+C after testing.

### 3. Keep it running with systemd
```bash
sudo tee /etc/systemd/system/akshaya-love-game.service >/dev/null <<'SERVICE'
[Unit]
Description=Akshaya Love Adventure
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/apps/akshaya-love-game
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /home/ubuntu/apps/akshaya-love-game/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE
sudo systemctl daemon-reload
sudo systemctl enable --now akshaya-love-game
sudo systemctl status akshaya-love-game --no-pager
```
If your VPS username is not `ubuntu`, replace `ubuntu` and `/home/ubuntu` in the service file with your actual Linux username and home path.

### 4. Put it behind HTTPS (recommended)
Do not expose a plain-HTTP game to the public internet if you can avoid it. Point a domain/subdomain to your VPS public IP, then install Nginx and Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo tee /etc/nginx/sites-available/akshaya-love-game >/dev/null <<'NGINX'
server {
    listen 80;
    server_name love.example.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX
sudo ln -s /etc/nginx/sites-available/akshaya-love-game /etc/nginx/sites-enabled/akshaya-love-game
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d love.example.com
```
Replace `love.example.com` with your real domain/subdomain. Certbot needs DNS to point to this VPS and inbound TCP ports 80 and 443 allowed in both the OCI network security rules and Ubuntu firewall if enabled. After HTTPS is working, share `https://love.example.com`.

### 5. OCI networking
For direct testing only, add an ingress rule for TCP 3000 in the OCI security list/NSG and open the Ubuntu firewall if enabled. For production, prefer only ports 80 and 443 public and keep port 3000 private behind Nginx.

### Update the game
```bash
cd ~/apps/akshaya-love-game
# replace files with the new release
npm install --omit=dev
sudo systemctl restart akshaya-love-game
sudo journalctl -u akshaya-love-game -n 80 --no-pager
```

## Personalize the final message
Edit `public/index.html`, find the `id="finalMessage"` paragraph, and replace its text with your own message. You can also edit the `notes` array in `public/game.js`.

## Important limitations
This is a lightweight co-op prototype, not a competitive multiplayer engine. The room code is a shared join code, not strong authentication; do not use it to protect sensitive information. There is no persistence: rooms and collected hearts reset when everyone leaves or the server restarts. For a public production game, add rate limiting, room expiry, stricter server-authoritative movement, and abuse controls.
