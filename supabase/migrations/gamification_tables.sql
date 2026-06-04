-- Gamification Tables for Immersive Adventure Platform
-- Run these migrations in Supabase SQL Editor

-- ========== USER GAMIFICATION STATE ==========
CREATE TABLE IF NOT EXISTS user_gamification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  current_xp integer DEFAULT 0,
  total_xp integer DEFAULT 0,
  level integer DEFAULT 1,
  current_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  last_check_in timestamp,
  adventure_title text, -- e.g., "Cloud Hunter", "Summit Master"
  next_adventure_title text,
  xp_to_next_level integer DEFAULT 1000,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id)
);

-- ========== ACHIEVEMENTS & BADGES ==========
CREATE TABLE IF NOT EXISTS achievement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text, -- emoji or icon code
  xp_reward integer DEFAULT 100,
  badge_color text DEFAULT 'amber',
  category text, -- 'adventure', 'social', 'streak', 'exploration'
  unlock_condition text, -- JSON description of how to unlock
  rarity text DEFAULT 'common', -- common, rare, epic, legendary
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id uuid REFERENCES achievement_templates(id) ON DELETE CASCADE,
  unlocked_at timestamp DEFAULT now(),
  seen boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- ========== DAILY CHALLENGES & STREAKS ==========
CREATE TABLE IF NOT EXISTS daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  challenge_type text NOT NULL, -- 'check_in', 'explore', 'social', 'elevation'
  description text,
  xp_reward integer DEFAULT 50,
  image_url text,
  created_at timestamp DEFAULT now(),
  UNIQUE(date, challenge_type)
);

CREATE TABLE IF NOT EXISTS user_daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES daily_challenges(id) ON DELETE CASCADE,
  completed_at timestamp,
  progress_percent integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS check_in_streak (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  streak_count integer DEFAULT 0,
  last_check_in date,
  best_streak integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id)
);

-- ========== SEASONAL EVENTS & MISSIONS ==========
CREATE TABLE IF NOT EXISTS seasonal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  season text, -- 'spring', 'summer', 'fall', 'winter'
  start_date date NOT NULL,
  end_date date NOT NULL,
  rewards_xp integer DEFAULT 500,
  banner_image text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES seasonal_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  mission_type text, -- 'climb', 'explore', 'social'
  target_count integer,
  xp_reward integer,
  position integer, -- order in event
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_event_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES seasonal_events(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES event_missions(id) ON DELETE CASCADE,
  progress_count integer DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  UNIQUE(user_id, mission_id)
);

-- ========== TRAVEL JOURNAL & MEMORIES ==========
CREATE TABLE IF NOT EXISTS adventure_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  mountain_name text NOT NULL,
  date_climbed date,
  journal_text text,
  mood text, -- 'excited', 'peaceful', 'challenging', 'triumphant'
  weather text,
  elevation_gained integer,
  duration_hours decimal,
  difficulty text,
  image_urls text[], -- array of image URLs
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adventure_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  adventure_id uuid REFERENCES adventure_journals(id) ON DELETE CASCADE,
  memory_type text, -- 'photo', 'note', 'video'
  content text,
  image_url text,
  created_at timestamp DEFAULT now()
);

-- ========== SOCIAL ENGAGEMENT ==========
CREATE TABLE IF NOT EXISTS post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type text DEFAULT 'like', -- 'like', 'celebrate', 'inspire'
  created_at timestamp DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- ========== ADVENTURE FEED & ACTIVITY ==========
CREATE TABLE IF NOT EXISTS activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- 'mountain_conquered', 'achievement_unlocked', 'level_up', 'post_shared', 'joined_adventure'
  related_entity_id uuid,
  related_entity_type text, -- 'roadmap', 'mountain', 'achievement', 'post'
  title text,
  description text,
  icon text,
  image_url text,
  is_public boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- ========== GAMIFICATION MILESTONES ==========
CREATE TABLE IF NOT EXISTS adventure_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text,
  required_peaks integer,
  required_xp integer,
  required_level integer,
  unlock_message text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES adventure_milestones(id) ON DELETE CASCADE,
  unlocked_at timestamp,
  created_at timestamp DEFAULT now(),
  UNIQUE(user_id, milestone_id)
);

-- ========== LEADERBOARDS ==========
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  leaderboard_type text NOT NULL, -- 'xp', 'peaks', 'streaks', 'level'
  rank integer,
  score integer,
  period text DEFAULT 'all_time', -- 'weekly', 'monthly', 'all_time'
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, leaderboard_type, period)
);

-- ========== INDICES FOR PERFORMANCE ==========
CREATE INDEX idx_user_gamification ON user_gamification(user_id);
CREATE INDEX idx_user_achievements ON user_achievements(user_id);
CREATE INDEX idx_daily_progress ON user_daily_progress(user_id, created_at);
CREATE INDEX idx_activity_feed ON activity_feed(user_id, created_at);
CREATE INDEX idx_journals ON adventure_journals(user_id, date_climbed);
CREATE INDEX idx_follows ON user_follows(follower_id, following_id);
CREATE INDEX idx_leaderboard ON leaderboard_entries(leaderboard_type, period, rank);

-- ========== TRIGGERS FOR AUTO-UPDATE ==========
CREATE OR REPLACE FUNCTION update_user_gamification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gamification_timestamp
  BEFORE UPDATE ON user_gamification
  FOR EACH ROW
  EXECUTE FUNCTION update_user_gamification_timestamp();

-- ========== SEED INITIAL DATA ==========
-- Achievement Templates
INSERT INTO achievement_templates (name, description, icon, xp_reward, badge_color, category, rarity) VALUES
('First Peak', 'Conquer your first mountain', '🏔️', 100, 'blue', 'adventure', 'common'),
('Summit Collector', 'Climb 5 different mountains', '📍', 250, 'emerald', 'adventure', 'rare'),
('Sky Chaser', 'Reach 2000m elevation', '☁️', 300, 'cyan', 'adventure', 'rare'),
('Week Warrior', 'Check in 7 days straight', '🔥', 150, 'orange', 'streak', 'rare'),
('Social Butterfly', 'Earn 50 likes on your posts', '🦋', 200, 'pink', 'social', 'rare'),
('Trail Explorer', 'Explore 3 different regions', '🗺️', 200, 'amber', 'exploration', 'rare'),
('Legend Status', 'Reach level 10', '👑', 500, 'gold', 'adventure', 'legendary');
