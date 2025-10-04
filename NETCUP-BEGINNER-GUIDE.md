# 🚀 Deploy Mudden to Netcup VPS - Complete Beginner Guide

This guide assumes **zero server experience**. We'll go step-by-step!

---

## 📋 What You Need

1. A Netcup VPS (any small plan works - ~5€/month)
2. Your VPS IP address (from Netcup control panel)
3. Root password (sent by Netcup via email)
4. 30 minutes of time

---

## Part 1: Connect to Your Server

### Step 1: Get SSH Client

**Windows:**
- Download [PuTTY](https://www.putty.org/) (free)
- Or use Windows Terminal (built-in on Windows 10/11)

**Mac/Linux:**
- You already have SSH! Just use Terminal.

### Step 2: Connect to Your Server

**On Mac/Linux (Terminal):**
```bash
ssh root@YOUR_SERVER_IP
```
Replace `YOUR_SERVER_IP` with your actual IP (e.g., `123.45.67.89`)

**On Windows (PuTTY):**
1. Open PuTTY
2. Host Name: `YOUR_SERVER_IP`
3. Port: `22`
4. Click "Open"

**First time connecting:**
- It will ask "Are you sure?" → Type `yes` and press Enter
- Enter the root password (from Netcup email)
- You're in! You'll see a prompt like: `root@vps:~#`

---

## Part 2: Install Required Software

Copy and paste these commands one by one (press Enter after each):

### Step 1: Update System
```bash
apt update && apt upgrade -y
```
⏱️ Takes 2-3 minutes. Wait for it to finish.

### Step 2: Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```
⏱️ Takes 1-2 minutes.

**Check it worked:**
```bash
node --version
npm --version
```
You should see version numbers like `v20.x.x` and `10.x.x`

### Step 3: Install PM2 (Process Manager)
```bash
npm install -g pm2
```
⏱️ Takes 1 minute.

**Check it worked:**
```bash
pm2 --version
```

### Step 4: Install Git
```bash
apt install -y git
```
⏱️ Takes 1 minute.

---

## Part 3: Upload Your Mudden Server

You have 2 options:

### Option A: Using Git (Recommended)

**If your code is on GitHub:**

1. On your VPS:
```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/mudden.git
cd mudden
```

Replace `YOUR_USERNAME` with your GitHub username.

2. Install dependencies:
```bash
npm install
```
⏱️ Takes 2-3 minutes.

3. Build the server:
```bash
npm run build
```
⏱️ Takes 1 minute.

### Option B: Upload Manually (No GitHub)

**On your LOCAL computer** (not VPS):

1. Build the project:
```bash
npm run build
```

2. Create a zip file of your project:
```bash
# On Mac/Linux
tar -czf mudden.tar.gz --exclude='node_modules' .

# On Windows: Right-click folder → "Send to" → "Compressed folder"
```

3. Upload to server:

**Easy way - Use FileZilla (GUI):**
- Download [FileZilla](https://filezilla-project.org/) (free)
- Host: `sftp://YOUR_SERVER_IP`
- Username: `root`
- Password: Your root password
- Port: `22`
- Click "Quickconnect"
- Drag `mudden.tar.gz` to `/opt/` folder

**Command line way:**
```bash
# On your local machine
scp mudden.tar.gz root@YOUR_SERVER_IP:/opt/
```

4. **Back on the VPS**, extract and set up:
```bash
cd /opt
tar -xzf mudden.tar.gz
mv mudden mudden  # Move to proper directory
cd mudden
npm install
```

---

## Part 4: Start Your Server

### Step 1: Start with PM2
```bash
cd /opt/mudden
pm2 start dist/server.js --name mudden
```

You should see:
```
┌─────┬──────────┬─────────┬─────────┬─────────┐
│ id  │ name     │ status  │ cpu     │ memory  │
├─────┼──────────┼─────────┼─────────┼─────────┤
│ 0   │ mudden   │ online  │ 0%      │ 20.0mb  │
└─────┴──────────┴─────────┴─────────┴─────────┘
```

✅ Your server is running!

### Step 2: Make It Auto-Start on Reboot
```bash
pm2 save
pm2 startup
```

The second command will show you a line to copy. **Copy that line and run it**.

It looks like:
```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

Press Enter. Done!

### Step 3: Check Server Logs
```bash
pm2 logs mudden
```

You should see:
```
✓ Server running on 0.0.0.0:3000
✓ Ready for connections!
```

Press `Ctrl+C` to exit logs.

---

## Part 5: Open the Firewall

Your server is running, but we need to allow connections:

```bash
# Allow SSH (so you don't lock yourself out!)
ufw allow 22/tcp

# Allow Mudden
ufw allow 3000/tcp

# Enable firewall
ufw enable
```

It will ask "Command may disrupt existing ssh connections. Proceed?"
→ Type `y` and press Enter

**Check firewall status:**
```bash
ufw status
```

Should show:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
3000/tcp                   ALLOW       Anywhere
```

---

## Part 6: Test Your Server

### From Your Web Browser:
Open: `http://YOUR_SERVER_IP:3000`

You should see... nothing! That's OK - the server doesn't serve web pages directly.

### From Your Client:

1. **Update `client/config.json`:**
```json
{
  "connection": {
    "host": "YOUR_SERVER_IP",
    "port": 3000,
    "protocol": "http"
  }
}
```

2. **Serve the client locally:**
```bash
cd client
python3 -m http.server 8080
```

3. **Open:** `http://localhost:8080`

4. **Login/Register** - You should connect to your Netcup server!

---

## Part 7: Deploy Client to Netlify (Optional)

Make your client accessible to everyone:

1. Go to [Netlify](https://www.netlify.com/)
2. Sign up (free)
3. Click "Add new site" → "Deploy manually"
4. **Drag your `client` folder** into the upload area
5. Done! You get a URL like: `your-site.netlify.app`

Now anyone can play!

---

## 🎯 You're Live!

Your Mudden server is now:
- ✅ Running on Netcup
- ✅ Auto-starts on reboot
- ✅ Accessible from anywhere
- ✅ Firewall protected

---

## 📝 Useful Commands

**Check if server is running:**
```bash
pm2 status
```

**View logs:**
```bash
pm2 logs mudden
```

**Restart server:**
```bash
pm2 restart mudden
```

**Stop server:**
```bash
pm2 stop mudden
```

**Start server:**
```bash
pm2 start mudden
```

---

## 🔄 Update Your Server

When you make changes to your code:

### If using Git:
```bash
ssh root@YOUR_SERVER_IP
cd /opt/mudden
git pull
npm install
npm run build
pm2 restart mudden
```

### If uploading manually:
1. Build locally: `npm run build`
2. Upload new files with FileZilla
3. On server: `pm2 restart mudden`

---

## 🆘 Troubleshooting

### "Can't connect to server"
```bash
# Check if it's running
pm2 status

# Check logs for errors
pm2 logs mudden

# Check firewall
ufw status

# Check if port is listening
netstat -tlnp | grep 3000
```

### "Server keeps crashing"
```bash
# Look at error logs
pm2 logs mudden --err

# Try running manually to see error
cd /opt/mudden
node dist/server.js
```

### "Forgot root password"
- Use Netcup control panel to reset it
- Or use their web console (KVM)

### "Locked out of SSH"
- Make sure you allowed port 22: `ufw allow 22/tcp`
- Use Netcup web console (KVM) to access

---

## 💰 Cost

- **Netcup VPS 200:** ~5€/month
  - 2 GB RAM
  - 40 GB SSD
  - 1 vCore
  - **More than enough for your MUD!**

- **Netlify (client hosting):** Free

**Total: ~5€/month** 🎉

---

## 🎮 Next Steps

1. ✅ Server running? Good!
2. Update client config with your server IP
3. Deploy client to Netlify (free)
4. Share the Netlify URL with friends
5. Have fun! 🎮

---

## 📞 Getting Help

If stuck:
1. Check logs: `pm2 logs mudden`
2. Restart: `pm2 restart mudden`
3. Check this guide again
4. Ask me! I'm here to help 😊

---

*You did it! Your MUD is live on the internet!* 🎉
