# Rate Limiting Anti-Spam System

## Overview

The Mudden server now includes a comprehensive rate limiting system to prevent spam character creation and brute-force login attempts. This system is **IP-based** and operates entirely in-memory (no database required).

## Features

### 1. Account Creation Limits
- **Max Accounts Per IP**: Limits how many accounts can be created from a single IP address
- **Account Creation Cooldown**: Enforces a waiting period between consecutive account registrations from the same IP

### 2. Login Attempt Protection
- **Failed Login Tracking**: Monitors failed login attempts within a time window
- **Temporary IP Blocking**: Automatically blocks IPs that exceed the max failed login attempts
- **Auto-Unblock**: Blocks expire after the configured time window

## Configuration

All rate limiting settings are in `data/config.json` under `server.rateLimit`:

```json
{
  "server": {
    "rateLimit": {
      "enabled": true,
      "maxAccountsPerIP": 3,
      "accountCreationCooldown": 300,
      "loginAttemptWindow": 300,
      "maxLoginAttempts": 5
    }
  }
}
```

### Settings Explained

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch for rate limiting |
| `maxAccountsPerIP` | number | `3` | Maximum accounts that can be created from one IP |
| `accountCreationCooldown` | number | `300` | Seconds to wait between account creations (5 min) |
| `loginAttemptWindow` | number | `300` | Time window in seconds for tracking failed logins (5 min) |
| `maxLoginAttempts` | number | `5` | Max failed login attempts before blocking |

## How It Works

### Account Creation Flow

1. Player attempts to register a new account
2. Server checks if rate limiting is enabled
3. Server retrieves IP registration data:
   - **Count**: Total accounts created from this IP
   - **Timestamps**: When each account was created
4. Server validates:
   - **Cooldown check**: Has enough time passed since last registration?
   - **Max accounts check**: Has this IP reached the account limit?
5. If validation passes, account is created and tracking is updated
6. If validation fails, player receives specific error message

### Login Protection Flow

1. Player attempts to login with credentials
2. Server checks if IP is currently blocked
3. If credentials are invalid:
   - Failed attempt is recorded with timestamp
   - Old attempts outside the time window are removed
   - If total attempts >= `maxLoginAttempts`, IP is blocked
4. If credentials are valid:
   - All failed attempt tracking for this IP is cleared
   - Player logs in successfully

## Error Messages

Players will see user-friendly error messages:

- **Account creation cooldown**: `"Please wait X seconds before creating another account."`
- **Max accounts reached**: `"Maximum number of accounts (3) reached for this connection."`
- **Login attempts blocked**: `"Too many failed login attempts. Try again in X seconds."`

## Server Logging

The server logs rate limiting events:

```
✓ username registered (IP: 192.168.1.100, total accounts: 1)
⚠ IP 192.168.1.100 blocked (max accounts reached: 3)
⚠ IP 192.168.1.100 blocked for 300s (too many failed logins)
```

## IP Address Detection

The server detects client IP addresses in this order:
1. `X-Forwarded-For` header (for proxies/load balancers)
2. Socket handshake address
3. Falls back to `'unknown'` if neither is available

This ensures rate limiting works correctly even behind reverse proxies.

## Memory Management

All rate limiting data is stored in-memory using JavaScript Maps:

- `ipRegistrations`: Map<IP, { count, timestamps[] }>
- `ipLoginAttempts`: Map<IP, { failedAttempts[], blockedUntil? }>

**Note**: This data is cleared when the server restarts. For persistent tracking across server restarts, you would need to persist this data to disk (not implemented to keep the system simple).

## Customization Examples

### Stricter Limits (Production)
```json
{
  "enabled": true,
  "maxAccountsPerIP": 2,
  "accountCreationCooldown": 600,
  "loginAttemptWindow": 600,
  "maxLoginAttempts": 3
}
```

### Development Mode (Lenient)
```json
{
  "enabled": true,
  "maxAccountsPerIP": 10,
  "accountCreationCooldown": 10,
  "loginAttemptWindow": 60,
  "maxLoginAttempts": 10
}
```

### Completely Disabled
```json
{
  "enabled": false,
  "maxAccountsPerIP": 3,
  "accountCreationCooldown": 300,
  "loginAttemptWindow": 300,
  "maxLoginAttempts": 5
}
```

## Design Philosophy

This rate limiting system follows Mudden's core philosophy:

- ✅ **Simple**: No external dependencies or databases
- ✅ **Traditional**: Server-side validation, client can't bypass
- ✅ **User-Friendly**: No email verification hassle
- ✅ **Configurable**: Easy to tune for different environments
- ✅ **Transparent**: Clear error messages tell players what's happening

## Limitations

- **In-Memory Only**: Rate limit data is lost on server restart
- **IP-Based**: Users behind NAT/VPN share the same IP address
- **No Persistent Ban List**: No permanent IP bans (by design - keeps it simple)

## Future Enhancements

If needed, you could extend this system with:

- Persistent storage (save IP data to JSON files)
- Account verification tokens (optional email or SMS)
- Captcha integration for suspicious IPs
- Whitelist/blacklist for specific IP addresses
- Configurable ban durations

However, the current implementation is intentionally minimal to match Mudden's ~2,000 line goal.
