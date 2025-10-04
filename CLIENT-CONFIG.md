# Client Configuration Guide

The Mudden client is fully configurable through the `client/config.json` file. This allows you to customize the appearance, connection settings, and message colors without touching any code.

## Configuration File Location

```
client/config.json
```

## Configuration Structure

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

---

## Connection Settings

### `connection.host`
- **Type:** String
- **Default:** `"localhost"`
- **Description:** The hostname or IP address of the Mudden server
- **Examples:**
  - `"localhost"` - Local development
  - `"192.168.1.100"` - LAN server
  - `"mudserver.example.com"` - Remote server

### `connection.port`
- **Type:** Number
- **Default:** `3000`
- **Description:** The port number the Mudden server is listening on

### `connection.protocol`
- **Type:** String
- **Default:** `"http"`
- **Description:** Protocol to use for connection
- **Options:** `"http"` or `"https"`
- **Note:** Must match your server configuration

---

## UI Settings

### `ui.titleBar`
- **Type:** String
- **Default:** `"Mudden Terminal"`
- **Description:** Text displayed in the top title bar
- **Example:** `"My Custom MUD"`

### `ui.loginTitle`
- **Type:** String
- **Default:** `"Connect to Mudden"`
- **Description:** Text displayed on the login screen
- **Example:** `"Enter the Realm"`

### `ui.primaryColor`
- **Type:** Color (Hex)
- **Default:** `"#6bcf7f"` (Green)
- **Description:** Primary accent color used throughout the UI
- **Used for:**
  - Borders
  - Text highlights
  - Input prompt
  - Button text
  - Header text
- **Example:** `"#00ff00"` (Bright green)

### `ui.backgroundColor`
- **Type:** Color (Hex)
- **Default:** `"#1a1a1a"` (Dark gray)
- **Description:** Main background color for the terminal
- **Example:** `"#000000"` (Pure black)

### `ui.headerBackground`
- **Type:** Color (Hex)
- **Default:** `"#2a2a2a"` (Medium gray)
- **Description:** Background color for the header bar and login form
- **Example:** `"#1c1c1c"`

### `ui.inputBackground`
- **Type:** Color (Hex)
- **Default:** `"#2a2a2a"` (Medium gray)
- **Description:** Background color for the command input area
- **Example:** `"#1c1c1c"`

---

## Message Colors

Each message type can have its own color. These correspond to the message types sent by the server.

### `messageColors.echo`
- **Type:** Color (Hex)
- **Default:** `"#9d9d9d"` (Gray)
- **Description:** Color for echoed commands (your own input)

### `messageColors.info`
- **Type:** Color (Hex)
- **Default:** `"#aaa"` (Light gray)
- **Description:** General information messages (look, inventory, help)

### `messageColors.success`
- **Type:** Color (Hex)
- **Default:** `"#0f0"` (Green)
- **Description:** Positive action messages (bought item, quest complete, level up)

### `messageColors.error`
- **Type:** Color (Hex)
- **Default:** `"#f00"` (Red)
- **Description:** Failed action messages (can't afford, inventory full)

### `messageColors.combat`
- **Type:** Color (Hex)
- **Default:** `"#ff0"` (Yellow)
- **Description:** Combat messages (damage dealt/taken)

### `messageColors.say`
- **Type:** Color (Hex)
- **Default:** `"#0ff"` (Cyan)
- **Description:** Public chat messages (say command)

### `messageColors.whisper`
- **Type:** Color (Hex)
- **Default:** `"#f0f"` (Magenta)
- **Description:** Private messages (whisper/reply)

### `messageColors.npc`
- **Type:** Color (Hex)
- **Default:** `"#fff"` (White)
- **Description:** NPC dialogue messages

### `messageColors.system`
- **Type:** Color (Hex)
- **Default:** `"#888"` (Dark gray)
- **Description:** Server announcements (player joined/left, movement)

### `messageColors.loot`
- **Type:** Color (Hex)
- **Default:** `"#fa0"` (Orange/Gold)
- **Description:** Rewards and loot (gold/xp gained, item found)

---

## Example Themes

### Classic Green Terminal
```json
{
  "ui": {
    "primaryColor": "#00ff00",
    "backgroundColor": "#000000",
    "headerBackground": "#001100",
    "inputBackground": "#001100"
  }
}
```

### Amber Monochrome
```json
{
  "ui": {
    "primaryColor": "#ffb000",
    "backgroundColor": "#1a0f00",
    "headerBackground": "#2a1800",
    "inputBackground": "#2a1800"
  },
  "messageColors": {
    "echo": "#805800",
    "info": "#ffb000",
    "success": "#ffd700",
    "error": "#ff6600",
    "combat": "#ff8800",
    "say": "#ffcc00",
    "whisper": "#ffa500",
    "npc": "#ffffff",
    "system": "#996600",
    "loot": "#ffff00"
  }
}
```

### Blue Cyber
```json
{
  "ui": {
    "primaryColor": "#00d4ff",
    "backgroundColor": "#000a0f",
    "headerBackground": "#001a2a",
    "inputBackground": "#001a2a"
  },
  "messageColors": {
    "echo": "#0088aa",
    "info": "#00aaff",
    "success": "#00ff88",
    "error": "#ff0044",
    "combat": "#ffaa00",
    "say": "#00ffff",
    "whisper": "#aa00ff",
    "npc": "#ffffff",
    "system": "#0066aa",
    "loot": "#ffcc00"
  }
}
```

### Matrix Style
```json
{
  "ui": {
    "titleBar": "MATRIX TERMINAL",
    "loginTitle": "ENTER THE MATRIX",
    "primaryColor": "#00ff41",
    "backgroundColor": "#000000",
    "headerBackground": "#001100",
    "inputBackground": "#001100"
  },
  "messageColors": {
    "echo": "#008f11",
    "info": "#00ff41",
    "success": "#39ff14",
    "error": "#ff0000",
    "combat": "#ffff00",
    "say": "#00ff41",
    "whisper": "#00cc33",
    "npc": "#ffffff",
    "system": "#006611",
    "loot": "#ffcc00"
  }
}
```

### Dark Purple
```json
{
  "ui": {
    "primaryColor": "#b19cd9",
    "backgroundColor": "#0f0818",
    "headerBackground": "#1a0f28",
    "inputBackground": "#1a0f28"
  },
  "messageColors": {
    "echo": "#6a5a7a",
    "info": "#b19cd9",
    "success": "#90ee90",
    "error": "#ff6b6b",
    "combat": "#ffb347",
    "say": "#87ceeb",
    "whisper": "#dda0dd",
    "npc": "#ffffff",
    "system": "#8a7ba8",
    "loot": "#ffd700"
  }
}
```

---

## Deployment Configurations

### Local Development
```json
{
  "connection": {
    "host": "localhost",
    "port": 3000,
    "protocol": "http"
  }
}
```

### LAN Server
```json
{
  "connection": {
    "host": "192.168.1.100",
    "port": 3000,
    "protocol": "http"
  }
}
```

### Production Server (HTTPS)
```json
{
  "connection": {
    "host": "mudserver.example.com",
    "port": 443,
    "protocol": "https"
  }
}
```

### Custom Port
```json
{
  "connection": {
    "host": "localhost",
    "port": 8080,
    "protocol": "http"
  }
}
```

---

## How to Apply Configuration Changes

1. Edit `client/config.json`
2. Save the file
3. Refresh the browser (no server restart needed)
4. The new configuration is applied immediately

**Note:** The client loads `config.json` on page load, so changes require a browser refresh.

---

## Color Format

All colors must be in hexadecimal format:
- **3-digit hex:** `"#fff"` (shorthand)
- **6-digit hex:** `"#ffffff"` (full)
- **Invalid:** `"white"`, `"rgb(255,255,255)"`, `"#ffffffff"`

**Examples:**
- `"#000000"` - Black
- `"#ffffff"` - White
- `"#ff0000"` - Red
- `"#00ff00"` - Green
- `"#0000ff"` - Blue
- `"#6bcf7f"` - Default Mudden green

---

## Troubleshooting

### Client won't connect
- Check `connection.host` and `connection.port` match your server
- Verify server is running
- Check browser console for errors

### Colors don't apply
- Ensure colors are in hex format (`#rrggbb`)
- Check for typos in color property names
- Refresh the browser to reload config

### Text doesn't change
- Verify `ui.titleBar` and `ui.loginTitle` are strings
- Check for JSON syntax errors
- Refresh the browser

### Config not loading
- Verify `config.json` is in the `client/` directory
- Check JSON is valid (use a JSON validator)
- Look at browser console for error messages

---

## Best Practices

1. **Keep it readable:** Choose colors with good contrast
2. **Test before deployment:** Try different themes to ensure readability
3. **Back up your config:** Save custom configurations before updating
4. **Use hex colors:** Stick to hexadecimal color format for consistency
5. **Consistent naming:** Update `titleBar` and `loginTitle` to match your MUD's branding

---

*This configuration system allows you to completely customize the client appearance without touching any HTML, CSS, or JavaScript code!*
