# Mudden Web Client

A minimal, configurable terminal-style web client for Mudden MUD.

## Quick Start

### 1. Configure the client

Edit `config.json` to set your server connection and theme:

```json
{
  "connection": {
    "host": "localhost",
    "port": 3000,
    "protocol": "http"
  },
  "ui": {
    "titleBar": "Mudden Terminal",
    "loginTitle": "Connect to Mudden",
    "primaryColor": "#6bcf7f",
    "backgroundColor": "#1a1a1a",
    "headerBackground": "#2a2a2a",
    "inputBackground": "#2a2a2a"
  },
  "messageColors": {
    "echo": "#9d9d9d",
    "info": "#aaa",
    "success": "#0f0",
    "error": "#f00",
    "combat": "#ff0",
    "say": "#0ff",
    "whisper": "#f0f",
    "npc": "#fff",
    "system": "#888",
    "loot": "#fa0"
  }
}
```

### 2. Serve the client

You can use any static file server. Here are a few options:

**Python 3:**
```bash
python3 -m http.server 8080
```

**Node.js (http-server):**
```bash
npx http-server -p 8080
```

**PHP:**
```bash
php -S localhost:8080
```

### 3. Open in browser

Navigate to `http://localhost:8080` (or whatever port you chose)

---

## Configuration

See `CLIENT-CONFIG.md` for complete configuration documentation including:
- Connection settings
- UI customization
- Message color schemes
- Example themes
- Deployment configurations

---

## Features

✅ **Minimal & Fast** - Pure HTML/CSS/JS, no build process
✅ **Fully Configurable** - Change colors, text, and connection via config.json
✅ **Terminal Feel** - Classic MUD terminal experience
✅ **Command History** - Arrow up/down to navigate previous commands
✅ **Auto-reconnect** - Handles connection drops gracefully
✅ **Message Types** - Color-coded messages for better readability

---

## Files

- `index.html` - Main HTML structure
- `style.css` - Styles with CSS variables
- `client.js` - Client logic (WebSocket, UI, commands)
- `config.json` - Configuration file (editable)

---

## Keyboard Shortcuts

- **Enter** - Send command
- **Arrow Up** - Previous command in history
- **Arrow Down** - Next command in history
- **Click anywhere** - Focus command input (when logged in)

---

## Theming

Want to change the look? Edit `config.json` and refresh your browser!

**Example: Matrix Theme**
```json
{
  "ui": {
    "titleBar": "MATRIX TERMINAL",
    "loginTitle": "ENTER THE MATRIX",
    "primaryColor": "#00ff41",
    "backgroundColor": "#000000",
    "headerBackground": "#001100",
    "inputBackground": "#001100"
  }
}
```

See `CLIENT-CONFIG.md` for more theme examples!

---

## Production Deployment

### Static File Hosting

Deploy to any static file host:
- **GitHub Pages** - Free hosting
- **Netlify** - Free tier with custom domains
- **Vercel** - Free tier, instant deployment
- **AWS S3** - Static website hosting
- **Your own server** - Any web server (nginx, Apache, etc.)

### Configuration for Production

Update `config.json` before deployment:

```json
{
  "connection": {
    "host": "your-mud-server.com",
    "port": 443,
    "protocol": "https"
  }
}
```

---

## Browser Compatibility

Works in all modern browsers:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Opera (latest)

**Note:** Requires JavaScript enabled and WebSocket support.

---

## Development

No build process required! Just edit the files and refresh.

**Files you might customize:**
- `config.json` - All configuration
- `style.css` - Additional styles (beyond config)
- `client.js` - Client behavior

**Files you shouldn't need to edit:**
- `index.html` - Structure is minimal and complete

---

## Troubleshooting

### Can't connect to server
1. Check server is running
2. Verify `config.json` has correct host/port
3. Check browser console for errors

### Config changes don't apply
1. Ensure you saved `config.json`
2. Hard refresh browser (Ctrl+Shift+R)
3. Check JSON syntax is valid

### Theme looks wrong
1. Verify all colors are in hex format (`#rrggbb`)
2. Check for typos in property names
3. Look at browser console for CSS errors

---

*Simple, configurable, and minimal - just how a MUD client should be!*
