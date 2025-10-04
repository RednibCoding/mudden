# 📋 Netcup Deployment Checklist

Print this out or keep it open while deploying!

---

## ☁️ Part 1: Server Setup

- [ ] **1.1** - Order Netcup VPS (VPS 200 recommended, ~5€/month)
- [ ] **1.2** - Receive IP address and root password (check email)
- [ ] **1.3** - Save IP and password somewhere safe

---

## 🔌 Part 2: Connect to Server

**Windows users:**
- [ ] **2.1** - Download and install [PuTTY](https://www.putty.org/)
- [ ] **2.2** - Open PuTTY
- [ ] **2.3** - Enter IP address, port 22
- [ ] **2.4** - Click "Open"
- [ ] **2.5** - Type `yes` when asked
- [ ] **2.6** - Enter root password
- [ ] **2.7** - You're in! ✅

**Mac/Linux users:**
- [ ] **2.1** - Open Terminal
- [ ] **2.2** - Type: `ssh root@YOUR_IP` (replace YOUR_IP)
- [ ] **2.3** - Type `yes` when asked
- [ ] **2.4** - Enter root password
- [ ] **2.5** - You're in! ✅

---

## 🛠️ Part 3: Install Software

Copy-paste each command, press Enter, wait for it to finish:

- [ ] **3.1** - Update system:
  ```bash
  apt update && apt upgrade -y
  ```
  ⏱️ Takes 2-3 minutes

- [ ] **3.2** - Install Node.js:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  ```
  ⏱️ Takes 1-2 minutes

- [ ] **3.3** - Check Node.js installed:
  ```bash
  node --version
  ```
  Should show: `v20.x.x` ✅

- [ ] **3.4** - Install PM2:
  ```bash
  npm install -g pm2
  ```
  ⏱️ Takes 1 minute

- [ ] **3.5** - Install Git:
  ```bash
  apt install -y git
  ```
  ⏱️ Takes 1 minute

---

## 📤 Part 4: Upload Your Server

**Choose ONE option:**

### Option A: Using GitHub (Easier)

- [ ] **4A.1** - Push your code to GitHub
- [ ] **4A.2** - On VPS, run:
  ```bash
  cd /opt
  git clone https://github.com/YOUR_USERNAME/mudden.git
  cd mudden
  ```
- [ ] **4A.3** - Install dependencies:
  ```bash
  npm install
  ```
  ⏱️ Takes 2-3 minutes

- [ ] **4A.4** - Build:
  ```bash
  npm run build
  ```
  ⏱️ Takes 1 minute

### Option B: Manual Upload

- [ ] **4B.1** - On local machine, build:
  ```bash
  npm run build
  ```

- [ ] **4B.2** - Download [FileZilla](https://filezilla-project.org/)

- [ ] **4B.3** - In FileZilla:
  - Host: `sftp://YOUR_IP`
  - Username: `root`
  - Password: Your password
  - Port: `22`
  - Click "Quickconnect"

- [ ] **4B.4** - Upload entire `mudden` folder to `/opt/`

- [ ] **4B.5** - On VPS, run:
  ```bash
  cd /opt/mudden
  npm install
  ```

---

## ▶️ Part 5: Start Server

- [ ] **5.1** - Start with PM2:
  ```bash
  cd /opt/mudden
  pm2 start dist/server.js --name mudden
  ```

- [ ] **5.2** - See "online" status? ✅

- [ ] **5.3** - Save PM2 list:
  ```bash
  pm2 save
  ```

- [ ] **5.4** - Enable auto-start:
  ```bash
  pm2 startup
  ```

- [ ] **5.5** - Copy the command it shows and run it

- [ ] **5.6** - Check logs:
  ```bash
  pm2 logs mudden
  ```

- [ ] **5.7** - See "Server running on 0.0.0.0:3000"? ✅

- [ ] **5.8** - Press `Ctrl+C` to exit logs

---

## 🔥 Part 6: Configure Firewall

- [ ] **6.1** - Allow SSH:
  ```bash
  ufw allow 22/tcp
  ```

- [ ] **6.2** - Allow Mudden:
  ```bash
  ufw allow 3000/tcp
  ```

- [ ] **6.3** - Enable firewall:
  ```bash
  ufw enable
  ```

- [ ] **6.4** - Type `y` and press Enter

- [ ] **6.5** - Check status:
  ```bash
  ufw status
  ```

- [ ] **6.6** - See ports 22 and 3000 allowed? ✅

---

## 🎮 Part 7: Update Client

- [ ] **7.1** - On local machine, edit `client/config.json`:
  ```json
  {
    "connection": {
      "host": "YOUR_SERVER_IP",
      "port": 3000,
      "protocol": "http"
    }
  }
  ```

- [ ] **7.2** - Replace `YOUR_SERVER_IP` with your actual IP

- [ ] **7.3** - Save the file

---

## 🌐 Part 8: Deploy Client (Optional)

- [ ] **8.1** - Go to [Netlify.com](https://www.netlify.com/)

- [ ] **8.2** - Sign up (free)

- [ ] **8.3** - Click "Add new site" → "Deploy manually"

- [ ] **8.4** - Drag your `client` folder to the upload area

- [ ] **8.5** - Wait for deployment (1 minute)

- [ ] **8.6** - Get your URL: `your-site.netlify.app`

- [ ] **8.7** - Share with friends! 🎉

---

## ✅ Part 9: Test Everything

- [ ] **9.1** - Open your client (locally or on Netlify)

- [ ] **9.2** - Click "Register"

- [ ] **9.3** - Create a test account

- [ ] **9.4** - Successfully logged in? ✅

- [ ] **9.5** - Type `look` - see location description? ✅

- [ ] **9.6** - Type `help` - see commands? ✅

---

## 🎉 Done!

Your Mudden MUD is now:
- ✅ Running on Netcup VPS
- ✅ Accessible from anywhere
- ✅ Auto-starts on reboot
- ✅ Protected by firewall

---

## 🔄 For Future Updates

When you make changes:

- [ ] Edit `update-netcup.sh` with your server IP
- [ ] Run: `./update-netcup.sh`
- [ ] Done! ✅

---

## 📞 If Something Goes Wrong

1. Check logs: `ssh root@YOUR_IP 'pm2 logs mudden'`
2. Restart: `ssh root@YOUR_IP 'pm2 restart mudden'`
3. Check firewall: `ssh root@YOUR_IP 'ufw status'`
4. Re-read the beginner guide: `NETCUP-BEGINNER-GUIDE.md`

---

**Total Time:** ~30 minutes  
**Total Cost:** ~5€/month  
**Difficulty:** Beginner-friendly ✅

*You got this!* 💪
