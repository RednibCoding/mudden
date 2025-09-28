# MUDDEN - Supabase Setup Guide

## Database Migration to Supabase

This project has been migrated from SQLite to Supabase for better scalability, online management, and real-time features.

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [Supabase](https://app.supabase.com)
2. Create a new project
3. Choose a name, database password, and region
4. Wait for the project to be provisioned

### 2. Run the Initial Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the sidebar
3. Copy the contents of `database/initial_schema.sql`
4. Paste it into the SQL editor and run it
5. You should see success messages confirming the database setup

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials in `.env`:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Get these values from your Supabase project dashboard:
   - Go to **Settings** → **API**
   - Copy the **Project URL** and **anon/public key**

### 4. Database Schema Overview

The database includes these tables:

- **`players`** - Player accounts and game state
- **`player_inventory`** - Player items and quantities  
- **`game_actions`** - Action logging for analytics
- **`player_sessions`** - Session management
- **`game_areas`** - Dynamic area data (optional)

### 5. Features Included

- ✅ **Row Level Security (RLS)** - Players can only access their own data
- ✅ **Automatic timestamps** - Created/updated timestamps with triggers
- ✅ **UUID primary keys** - Better for distributed systems
- ✅ **Indexes** - Optimized query performance
- ✅ **Safe migrations** - Schema can be run multiple times safely
- ✅ **Test data** - Includes a test player account

### 6. API Endpoints

The following API endpoints are available:

- `GET /api/health` - Database health check
- `GET /api/players/[playerId]` - Get player with inventory
- `GET /api/maps/[areaId]` - Get area map data

### 7. Development

Start the development server:

```bash
npm run dev
```

The server will connect to Supabase automatically using your environment variables.

### 8. Supabase Dashboard Features

You can manage your database through the Supabase web interface:

- **Table Editor** - View and edit data directly
- **SQL Editor** - Run custom queries
- **Auth** - User authentication (for future features)
- **Storage** - File uploads (for future features)
- **Edge Functions** - Serverless functions (for game logic)
- **Real-time** - Live data updates (for multiplayer features)

### 9. Benefits of Supabase

- 🌐 **Online Management** - No local database files
- 🔒 **Built-in Security** - Row Level Security and authentication
- 📊 **Analytics** - Built-in database analytics
- 🚀 **Scalability** - Handles many concurrent players
- 🔄 **Real-time** - Perfect for multiplayer features
- 🛠️ **Developer Tools** - Excellent web-based management interface

### 10. Troubleshooting

**Database connection issues:**
- Check your environment variables are correct
- Verify your Supabase project is active
- Check the Supabase dashboard for any issues

**Schema issues:**
- The initial schema is safe to run multiple times
- Check the SQL Editor logs for any error messages
- Ensure you have the correct permissions

**API errors:**
- Check the browser console and server logs
- Verify your API key has the correct permissions
- Test the `/api/health` endpoint first