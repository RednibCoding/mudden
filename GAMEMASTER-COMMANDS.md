# Gamemaster Commands

This document describes the administrative commands available to gamemasters (GMs) in Mudden MUD.

## 🔐 Becoming a Gamemaster

**CRITICAL:** There is NO in-game command to grant GM privileges. This is a security feature.

To make a player a gamemaster:

1. Locate the player's JSON file in `persist/players/<username>.json`
2. Manually edit the file
3. Add `"isGm": true` after the `passwordHash` field
4. Save the file

**Example:**
```json
{
  "id": "d13249d0-ece3-4982-b0a6-587603de8915",
  "username": "admin",
  "displayName": "Admin",
  "passwordHash": "$2b$10$...",
  "isGm": true,          ← Add this line
  "location": "northshire_abbey",
  ...
}
```

When the player logs in, their display name will automatically be prefixed with `<GM>`.

**Display Example:**
- Original: `Admin`
- After login: `<GM> Admin`

This prefix appears in:
- Chat messages (`<GM> Admin says: "Welcome!"`)
- Who list
- Combat messages
- All player displays

---

## 📋 GM Commands

GMs have access to three moderation commands:

### 1. **ban** - Temporarily ban a player

**Syntax:**
```
ban <playername> <hours>
```

**Examples:**
```
ban PlayerName 24        (ban for 24 hours)
ban PlayerName 0.5       (ban for 30 minutes)
ban PlayerName 168       (ban for 1 week)
```

**Behavior:**
- Hours can be decimal (0.5 = 30 minutes, 0.25 = 15 minutes)
- Player is immediately kicked from the game
- Ban is saved to the player's JSON file as `bannedUntil` timestamp
- Player cannot login until ban expires
- Attempting to login shows: "Your account is banned. Time remaining: X hours and Y minutes"
- Ban automatically expires when the time is up

**Restrictions:**
- ❌ Cannot ban other GMs
- ✅ Can ban any regular player (online or offline)

**What happens:**
1. GM executes: `ban BadPlayer 24`
2. Server sets `BadPlayer.bannedUntil = Date.now() + (24 * 60 * 60 * 1000)`
3. Server saves `BadPlayer` to disk
4. If `BadPlayer` is online, they are kicked
5. `BadPlayer` sees: "You have been banned by a gamemaster for 24 hours."
6. `BadPlayer` cannot login for 24 hours

---

### 2. **kick** - Force disconnect a player

**Syntax:**
```
kick <playername>
```

**Examples:**
```
kick PlayerName
```

**Behavior:**
- Player is immediately disconnected from the game
- No ban applied (player can reconnect)
- Used for quick removals (spamming, testing, etc.)
- Does NOT prevent re-login

**Restrictions:**
- ❌ Cannot kick other GMs
- ❌ Cannot kick offline players
- ✅ Can kick any online regular player

**What happens:**
1. GM executes: `kick AnnoyingPlayer`
2. Server sends disconnect message to `AnnoyingPlayer`
3. `AnnoyingPlayer` sees: "You have been kicked by a gamemaster."
4. `AnnoyingPlayer`'s socket disconnects after 1 second
5. `AnnoyingPlayer` can immediately reconnect if desired

---

### 3. **teleport** - Move a player to any location

**Syntax:**
```
teleport <playername> <locationid>
```

**Examples:**
```
teleport PlayerName goldshire_inn
teleport PlayerName stormwind_keep
teleport self northshire_abbey     (teleport yourself)
```

**Behavior:**
- Instantly moves player to the specified location
- Works on ANY player, including the GM themselves
- Validates that the location ID exists
- Target player sees: "A gamemaster has teleported you to [Location Name]."
- Automatically triggers `look` command for target
- Used for: rescuing stuck players, testing, moving to events, etc.

**Restrictions:**
- ✅ Works on self (GM can teleport themselves)
- ✅ Works on any player (online or offline)
- ✅ No cooldowns or costs

**What happens:**
1. GM executes: `teleport StuckPlayer elwynn_forest`
2. Server validates `elwynn_forest` exists
3. Server sets `StuckPlayer.location = "elwynn_forest"`
4. Server saves `StuckPlayer` to disk
5. If `StuckPlayer` is online, they see the location description
6. GM sees: "StuckPlayer has been teleported to Elwynn Forest."

---

## 🛡️ GM Protections

GMs have special protections to prevent abuse:

- **Cannot moderate other GMs**
  - GMs cannot ban other GMs
  - GMs cannot kick other GMs
  - GMs can teleport themselves (but not other GMs without their cooperation)

- **No accidental self-moderation**
  - Kicking yourself: Not possible (command checks)
  - Banning yourself: Not possible (command checks)
  - Teleporting yourself: Allowed (useful for testing/travel)

---

## 🎯 GM Help Command

When a GM types `help`, they see an additional section:

```
=== Gamemaster Commands ===
  ban <playername> <hours>        - Ban a player (hours can be decimal, e.g., 0.5)
  kick <playername>               - Kick a player from the game
  teleport <playername> <location> - Teleport a player to a location
```

Regular players do NOT see this section.

---

## 📊 Ban System Details

**How bans are stored:**
```json
{
  "username": "bannedplayer",
  "bannedUntil": 1728123456789,  ← Unix timestamp in milliseconds
  ...
}
```

**Ban expiration:**
- Server checks `bannedUntil` on every login attempt
- If `bannedUntil > Date.now()` → Login rejected
- If `bannedUntil <= Date.now()` → Ban expired, field cleared, login allowed

**Manual ban removal:**
1. Edit player's JSON file
2. Remove the `"bannedUntil"` field
3. Save the file
4. Player can now login

---

## ⚠️ Best Practices

### When to use each command:

**ban** - For serious violations
- Repeated harassment
- Exploiting bugs
- Offensive behavior
- Length based on severity

**kick** - For quick interventions
- Spamming chat
- Testing purposes
- Temporary timeouts
- No permanent record needed

**teleport** - For assistance
- Stuck players (fell through map, etc.)
- Event coordination
- Testing new areas
- Moving players to safe locations

### Recommended ban durations:

- **First offense:** 0.5 - 2 hours
- **Minor repeat:** 24 hours
- **Major violation:** 72 hours (3 days)
- **Severe/repeated:** 168 hours (1 week)

---

## 🔍 Logging

All GM actions are logged to the console:

```
⚔ GM admin banned badplayer for 24 hours
⚔ GM admin kicked spammer
⚔ GM admin teleported stuckplayer from void to northshire_abbey
```

This creates an audit trail for server administrators.

---

## 🚫 What GMs CANNOT Do

For security and game balance, GMs cannot:

- Grant items to players (no spawn command)
- Give gold to players (no economy manipulation)
- Change player levels or XP (no power leveling)
- Create new locations/NPCs/items (data-driven, file-based only)
- See player passwords (bcrypt hashed)
- Elevate other players to GM status (manual file edit only)

This keeps the game fair and prevents abuse of power.

---

## 📝 Examples in Practice

### Example 1: Handling a Spammer
```
Player "Spammer" is flooding chat with gibberish.

GM action:
> kick Spammer

Result: Spammer is disconnected but can reconnect.
If they continue spamming:

> ban Spammer 2

Result: Spammer is banned for 2 hours.
```

### Example 2: Rescuing a Stuck Player
```
Player "StuckPlayer" reports they fell through the map.

GM action:
> teleport StuckPlayer northshire_abbey

Result: StuckPlayer is moved to Northshire Abbey, a safe starting location.
```

### Example 3: GM Self-Teleportation
```
GM wants to quickly travel to Stormwind Keep to meet a player.

GM action:
> teleport self stormwind_keep

Result: GM is instantly teleported.
```

### Example 4: Attempting to Ban Another GM
```
GM "Admin1" tries to ban GM "Admin2".

Admin1 action:
> ban Admin2 24

Result:
"You cannot ban another gamemaster."

The command is blocked for protection.
```

---

## 🔧 Technical Implementation

**Player Interface:**
```typescript
interface Player {
  isGm: boolean;              // Manually set in JSON
  bannedUntil?: number;       // Unix timestamp (undefined = not banned)
  displayName: string;        // Auto-prefixed with "<GM>" if isGm = true
  ...
}
```

**Login Flow:**
1. Player attempts login
2. `authenticatePlayer()` loads player data
3. Check if `player.bannedUntil` exists and `> Date.now()`
4. If banned, reject login with time remaining
5. If expired, clear `bannedUntil` and allow login
6. If `isGm = true`, prefix `displayName` with `<GM>`

**Command Security:**
```typescript
if (!player.isGm) {
  send(player, 'Unknown command. Type "help" for a list of commands.', 'error');
  return;
}
```

This makes GM commands invisible to regular players (not even shown as invalid).

---

## 🎮 For Server Administrators

**Initial GM Setup:**
1. Create a regular account in-game
2. Stop the server
3. Edit `persist/players/<username>.json`
4. Add `"isGm": true`
5. Restart server
6. Login - you'll see `<GM>` prefix

**Revoking GM Status:**
1. Stop the server
2. Edit `persist/players/<username>.json`
3. Change `"isGm": true` to `"isGm": false`
4. Remove `<GM>` prefix from `displayName`
5. Restart server

**Important:** Always make file edits while the server is stopped to avoid data conflicts.

---

*This GM system follows the principle of "maximum security through minimal exposure" - no in-game elevation means no in-game exploits.*
