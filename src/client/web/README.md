# Mudden v2 Web Client

This is the web client implementation for Mudden v2. It connects to the WebSocket server to provide a browser-based interface for the MUD game.

## Architecture

- **Clean Separation**: The web client is completely separate from the server
- **ES Modules**: Uses modern JavaScript modules for better organization
- **Local Constants**: Contains local copies of shared constants (ErrorCodes, UpdateTypes, CommandTypes)
- **No Server Dependencies**: The client runs independently and connects via WebSocket

## File Structure

```
src/client/web/
├── index.html          # Main HTML file
├── styles.css          # All CSS styles
└── js/
    ├── client.js       # Main client application
    ├── ErrorCodes.js   # Error code constants
    ├── UpdateTypes.js  # Update type constants
    └── CommandTypes.js # Command type constants
```

## Development Setup

### 1. Start the Server
```bash
# From the project root
node src/server/index.js
```
The server will run on `http://localhost:3000` (WebSocket only, no file serving)

### 2. Serve the Web Client
Use VS Code Live Server extension:
1. Open `src/client/web/index.html` in VS Code
2. Right-click and select "Open with Live Server"
3. The client will open in your browser (typically `http://127.0.0.1:5500`)

The client will automatically connect to the WebSocket server at `localhost:3000`.

## Features

- **Real-time Communication**: WebSocket connection to game server
- **Clean UI**: Modern, responsive interface with dark theme
- **Command System**: Full command parsing and execution
- **Game State Management**: Local state management for smooth UX
- **Error Handling**: Structured error handling with user-friendly messages

## Commands

- **Movement**: `north`, `south`, `east`, `west` (or `n`, `s`, `e`, `w`)
- **Looking**: `look` or `l`
- **Items**: `take [item]`, `drop [item]`, `inventory` or `i`
- **Equipment**: `equip [item]`
- **Social**: `say [message]`, `tell [player] [message]`, `emote [action]`

## Configuration

The client connects to `http://localhost:3000` by default. To change the server URL, edit the socket connection in `js/client.js`:

```javascript
this.socket = io('http://your-server-url:port');
```

## Future Client Implementations

This web client is designed to coexist with other client implementations:
- `src/client/web/` - Browser-based client
- `src/client/desktop/` - Future desktop client
- `src/client/mobile/` - Future mobile client
- `src/client/terminal/` - Future terminal client

Each client implementation maintains its own copy of the shared constants to avoid server dependencies.