# PM2 Quick Guide ⚡

**PM2** = Production Process Manager for Node.js

## 🚀 Installation

```bash
npm install -g pm2
```

---

## 📋 Essential Commands

### Start & Manage

```bash
# Start a process
pm2 start server.js --name my-app

# Start with TypeScript (using ts-node)
pm2 start src/server.ts --name my-app

# Start built JavaScript
pm2 start dist/server.js --name my-app

# List all processes
pm2 list
# or
pm2 status

# Stop a process
pm2 stop my-app

# Restart a process
pm2 restart my-app

# Delete a process from PM2
pm2 delete my-app

# Stop all processes
pm2 stop all

# Restart all processes
pm2 restart all

# Delete all processes
pm2 delete all
```

### Logs & Monitoring

```bash
# View logs (real-time)
pm2 logs my-app

# View last 50 lines
pm2 logs my-app --lines 50

# View all logs
pm2 logs

# Clear logs
pm2 flush

# Monitor CPU/RAM usage
pm2 monit

# Show detailed info
pm2 show my-app
```

### Auto-Start on Reboot

```bash
# Step 1: Enable PM2 to start on boot
pm2 startup

# Step 2: Run the command it shows (copy-paste)
# Example: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Step 3: Start your processes
pm2 start dist/server.js --name my-app

# Step 4: Save the process list
pm2 save

# Now PM2 will auto-start "my-app" on server reboot!
```

### Disable Auto-Start

```bash
pm2 unstartup
```

---

## 🎯 Common Workflows

### First Time Setup

```bash
pm2 start dist/server.js --name mudden
pm2 save
pm2 startup
# Run the command it shows
```

### After Code Update

```bash
# Rebuild your code
npm run build

# Restart PM2 process
pm2 restart mudden

# Or reload (zero-downtime for cluster mode)
pm2 reload mudden
```

### Check if Server is Running

```bash
pm2 status
# Look for "online" status
```

### Debug Server Issues

```bash
# View logs
pm2 logs mudden --lines 100

# Check process info
pm2 show mudden

# Check resource usage
pm2 monit
```

---

## 📊 Understanding PM2 Status

```bash
pm2 status
```

Output:
```
┌────┬──────┬─────┬──┬────────┬─────┬────────┐
│ id │ name │ ... │↺ │ status │ cpu │ memory │
├────┼──────┼─────┼──┼────────┼─────┼────────┤
│ 0  │ app  │ ... │0 │ online │ 0%  │ 45mb   │
└────┴──────┴─────┴──┴────────┴─────┴────────┘
```

**Status meanings:**
- `online` ✅ - Running perfectly
- `stopped` ⏸️ - Manually stopped
- `errored` ❌ - Crashed, check logs
- `launching` ⏳ - Starting up

**Restarts (↺):**
- `0` - Never restarted (stable)
- `5` - Restarted 5 times (check for crashes)

---

## 🔧 Advanced Options

### Start with Environment Variables

```bash
pm2 start server.js --name my-app --env production
```

### Start in Cluster Mode (Multiple CPUs)

```bash
pm2 start server.js -i max --name my-app
# -i max = use all CPU cores
```

### Set Memory Limit (Auto-Restart if Exceeded)

```bash
pm2 start server.js --name my-app --max-memory-restart 500M
```

### Watch for File Changes (Development)

```bash
pm2 start server.js --name my-app --watch
# Auto-restarts when files change
```

---

## 🆘 Troubleshooting

### Process Keeps Restarting

```bash
# Check logs for errors
pm2 logs my-app --err

# Check why it's crashing
pm2 show my-app
```

### Can't Connect After Reboot

```bash
# Check if PM2 is running
pm2 status

# If empty, PM2 didn't resurrect
# Make sure you ran: pm2 save
pm2 resurrect

# Re-enable startup
pm2 startup
pm2 save
```

### High Memory Usage

```bash
# Monitor in real-time
pm2 monit

# Restart if needed
pm2 restart my-app
```

### Process Not Stopping

```bash
# Force kill
pm2 delete my-app --force

# Or use system kill
pm2 show my-app  # Get PID
kill -9 <PID>
```

---

## 📁 Important Files

```
~/.pm2/
├── dump.pm2           # Saved process list (from pm2 save)
├── pm2.log            # PM2 internal logs
└── logs/
    ├── my-app-out.log # Your app's stdout
    └── my-app-err.log # Your app's stderr
```

---

## ✅ Production Checklist

Before deploying:

- [ ] Install PM2 globally: `npm install -g pm2`
- [ ] Start your app: `pm2 start dist/server.js --name my-app`
- [ ] Save process list: `pm2 save`
- [ ] Enable auto-start: `pm2 startup` (then run the command it shows)
- [ ] Test logs: `pm2 logs my-app`
- [ ] Test restart: `pm2 restart my-app`
- [ ] Test reboot: `sudo reboot` (wait, then check `pm2 status`)

---

## 🔗 Useful Links

- **Official Docs**: https://pm2.keymetrics.io/
- **GitHub**: https://github.com/Unitech/pm2
- **Quick Start**: https://pm2.keymetrics.io/docs/usage/quick-start/

---

## 💡 Pro Tips

1. **Always use `--name`** - Makes managing processes easier
2. **Always `pm2 save`** - After starting/stopping processes
3. **Check logs first** - Most issues show up in `pm2 logs`
4. **Use `pm2 monit`** - See real-time CPU/RAM usage
5. **Don't run as root** - Use a dedicated user for security (except for learning)

---

## 🎯 TL;DR - Most Used Commands

```bash
pm2 start dist/server.js --name mudden  # Start
pm2 status                              # Check status
pm2 logs mudden                         # View logs
pm2 restart mudden                      # Restart
pm2 stop mudden                         # Stop
pm2 save                                # Save process list
pm2 startup                             # Enable auto-start
```

**That's 90% of what you need!** 🚀
