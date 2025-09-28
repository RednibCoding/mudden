-- MUDDEN Game Database Initial Schema
-- This script is safe to run multiple times on the same database
-- It uses CREATE TABLE IF NOT EXISTS and other safe operations

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    character_name TEXT NOT NULL,
    level INTEGER DEFAULT 1 CHECK (level > 0),
    experience INTEGER DEFAULT 0 CHECK (experience >= 0),
    health INTEGER DEFAULT 100 CHECK (health >= 0),
    max_health INTEGER DEFAULT 100 CHECK (max_health > 0),
    gold INTEGER DEFAULT 50 CHECK (gold >= 0),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token TEXT,
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player inventory table
CREATE TABLE IF NOT EXISTS player_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    equipped BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, item_id)
);

-- Game actions/logs table for tracking player activities
CREATE TABLE IF NOT EXISTS game_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_data JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Sessions are handled via JWT tokens in HTTP-only cookies
-- No database session storage needed - JWT handles expiration and validation

-- Player locations table for efficient room/area queries and multiplayer features
-- This allows us to quickly find all players in a room, handle real-time updates, etc.
CREATE TABLE IF NOT EXISTS player_locations (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    current_room TEXT NOT NULL,
    current_area TEXT NOT NULL,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    last_moved TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_verification_token ON players(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_players_verified ON players(email_verified);
-- Player location indexes for efficient room/area queries
CREATE INDEX IF NOT EXISTS idx_player_locations_room ON player_locations(current_room);
CREATE INDEX IF NOT EXISTS idx_player_locations_area ON player_locations(current_area);
CREATE INDEX IF NOT EXISTS idx_player_locations_online ON player_locations(is_online);
CREATE INDEX IF NOT EXISTS idx_player_locations_position ON player_locations(current_area, position_x, position_y);
CREATE INDEX IF NOT EXISTS idx_player_inventory_player_id ON player_inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_item_id ON player_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_game_actions_player_id ON game_actions(player_id);
CREATE INDEX IF NOT EXISTS idx_game_actions_action_type ON game_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_game_actions_created_at ON game_actions(created_at);
-- Session indexes not needed - using JWT cookies for session management

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_player_locations_updated_at ON player_locations;
CREATE TRIGGER update_player_locations_updated_at
    BEFORE UPDATE ON player_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Room items taken tracking table
-- Tracks which items have been taken from which rooms by which players
CREATE TABLE IF NOT EXISTS room_items_taken (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent the same player from taking the same item from the same room multiple times
    UNIQUE(player_id, room_id, item_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_room_items_taken_player_room ON room_items_taken(player_id, room_id);
CREATE INDEX IF NOT EXISTS idx_room_items_taken_room_item ON room_items_taken(room_id, item_id);

-- Updated at trigger for room_items_taken
DROP TRIGGER IF EXISTS update_room_items_taken_updated_at ON room_items_taken;
CREATE TRIGGER update_room_items_taken_updated_at
    BEFORE UPDATE ON room_items_taken
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Player quest tracking table
-- Tracks the state of quests for each player
CREATE TABLE IF NOT EXISTS player_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'active', 'completed')),
    progress JSONB DEFAULT '{}', -- Store quest progress data (kills, items gathered, etc.)
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Allow multiple completions of the same quest (for repeatable quests)
    -- But only one active instance at a time
    UNIQUE(player_id, quest_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Quest completion history table
-- Tracks all quest completions for statistics and rewards
CREATE TABLE IF NOT EXISTS quest_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rewards_given JSONB, -- Track what rewards were actually given
    completion_count INTEGER DEFAULT 1, -- How many times this quest has been completed by this player
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient quest lookups
CREATE INDEX IF NOT EXISTS idx_player_quests_player_status ON player_quests(player_id, status);
CREATE INDEX IF NOT EXISTS idx_player_quests_quest_id ON player_quests(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_completions_player ON quest_completions(player_id);
CREATE INDEX IF NOT EXISTS idx_quest_completions_quest ON quest_completions(quest_id);

-- Updated at trigger for player_quests
DROP TRIGGER IF EXISTS update_player_quests_updated_at ON player_quests;
CREATE TRIGGER update_player_quests_updated_at
    BEFORE UPDATE ON player_quests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) is DISABLED for Service Role authentication
-- Authorization is handled at the API level in Nuxt server routes
-- This provides better control and simpler debugging

-- Note: If you want to enable RLS in the future, you can run:
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;
-- And create appropriate policies