-- PostgreSQL Schema for Livestream Analytics
-- ==========================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'viewer', -- viewer, streamer, admin, moderator
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- Streamers table
CREATE TABLE IF NOT EXISTS streamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    bio TEXT,
    category VARCHAR(100),
    tags TEXT[],
    social_links JSONB,
    verification_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, rejected
    total_followers BIGINT DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    is_partner BOOLEAN DEFAULT false,
    partner_since TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_streamers_user_id ON streamers(user_id);
CREATE INDEX idx_streamers_category ON streamers(category);
CREATE INDEX idx_streamers_verification ON streamers(verification_status);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID REFERENCES streamers(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[],
    thumbnail_url TEXT,
    hls_url TEXT,
    dash_url TEXT,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, live, ended, archived, cancelled
    is_mature BOOLEAN DEFAULT false,
    language VARCHAR(10) DEFAULT 'vi',
    scheduled_start TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    max_concurrent_viewers INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    total_watch_time_seconds BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_streams_streamer_id ON streams(streamer_id);
CREATE INDEX idx_streams_status ON streams(status);
CREATE INDEX idx_streams_category ON streams(category);
CREATE INDEX idx_streams_scheduled_start ON streams(scheduled_start);

-- Stream analytics snapshots (hourly)
CREATE TABLE IF NOT EXISTS stream_analytics_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    avg_concurrent_viewers DECIMAL(10,2),
    max_concurrent_viewers INTEGER,
    unique_viewers INTEGER,
    total_watch_time_seconds BIGINT,
    avg_session_duration_seconds DECIMAL(10,2),
    total_likes BIGINT DEFAULT 0,
    total_shares BIGINT DEFAULT 0,
    total_comments BIGINT DEFAULT 0,
    total_chat_messages BIGINT DEFAULT 0,
    engagement_rate DECIMAL(5,4),
    avg_bitrate INTEGER,
    p50_bitrate INTEGER,
    p95_bitrate INTEGER,
    avg_buffer_health DECIMAL(5,4),
    buffer_incidents INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    error_rate DECIMAL(5,4),
    viewers_by_country JSONB,
    viewers_by_platform JSONB,
    viewers_by_device JSONB,
    viewers_by_os JSONB,
    viewer_retention_5min DECIMAL(5,4),
    viewer_retention_15min DECIMAL(5,4),
    viewer_retention_30min DECIMAL(5,4),
    viewer_retention_60min DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stream_id, hour_bucket)
);

CREATE INDEX idx_stream_analytics_stream_id ON stream_analytics_hourly(stream_id);
CREATE INDEX idx_stream_analytics_hour_bucket ON stream_analytics_hourly(hour_bucket);

-- Viewer profiles
CREATE TABLE IF NOT EXISTS viewer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    anonymous_id VARCHAR(255), -- for non-logged-in viewers
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_sessions INTEGER DEFAULT 0,
    total_watch_time_seconds BIGINT DEFAULT 0,
    avg_session_duration_seconds DECIMAL(10,2),
    favorite_streamers UUID[],
    favorite_categories TEXT[],
    preferred_quality VARCHAR(20),
    preferred_platform VARCHAR(50),
    preferred_device VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    timezone VARCHAR(50),
    language VARCHAR(10),
    is_high_engagement BOOLEAN DEFAULT false,
    is_frequent_viewer BOOLEAN DEFAULT false,
    is_mobile_viewer BOOLEAN DEFAULT false,
    is_binge_watcher BOOLEAN DEFAULT false,
    churn_risk_score DECIMAL(5,4) DEFAULT 0,
    lifetime_value DECIMAL(12,2) DEFAULT 0,
    segment VARCHAR(50), -- new, casual, regular, loyal, at_risk, churned
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_viewer_profiles_user_id ON viewer_profiles(user_id);
CREATE INDEX idx_viewer_profiles_anonymous_id ON viewer_profiles(anonymous_id);
CREATE INDEX idx_viewer_profiles_segment ON viewer_profiles(segment);
CREATE INDEX idx_viewer_profiles_last_seen ON viewer_profiles(last_seen);

-- Viewer sessions
CREATE TABLE IF NOT EXISTS viewer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_profile_id UUID REFERENCES viewer_profiles(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50),
    device_type VARCHAR(50),
    os VARCHAR(50),
    browser VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    ip_address INET,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    total_watch_time_seconds INTEGER,
    peak_concurrent_viewers INTEGER,
    avg_bitrate INTEGER,
    max_bitrate INTEGER,
    min_bitrate INTEGER,
    quality_changes INTEGER DEFAULT 0,
    buffer_events INTEGER DEFAULT 0,
    total_buffer_time_seconds DECIMAL(10,2),
    errors_count INTEGER DEFAULT 0,
    interactions_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_viewer_sessions_viewer_profile_id ON viewer_sessions(viewer_profile_id);
CREATE INDEX idx_viewer_sessions_stream_id ON viewer_sessions(stream_id);
CREATE INDEX idx_viewer_sessions_session_id ON viewer_sessions(session_id);
CREATE INDEX idx_viewer_sessions_started_at ON viewer_sessions(started_at);

-- Events (for detailed event store)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
    viewer_profile_id UUID REFERENCES viewer_profiles(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    platform VARCHAR(50),
    device_type VARCHAR(50),
    os VARCHAR(50),
    browser VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    video_time DECIMAL(10,3),
    video_duration DECIMAL(10,3),
    quality VARCHAR(50),
    bitrate INTEGER,
    buffer_health DECIMAL(5,4),
    action VARCHAR(100),
    error_code VARCHAR(100),
    error_message TEXT,
    properties JSONB,
    kafka_partition INTEGER,
    kafka_offset BIGINT,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_stream_id ON events(stream_id);
CREATE INDEX idx_events_viewer_profile_id ON events(viewer_profile_id);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_ingested_at ON events(ingested_at);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL, -- low_viewers, high_buffer, high_errors, quality_drop, etc.
    severity VARCHAR(20) NOT NULL, -- info, warning, critical
    title VARCHAR(500) NOT NULL,
    message TEXT,
    metadata JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_stream_id ON alerts(stream_id);
CREATE INDEX idx_alerts_is_resolved ON alerts(is_resolved);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- Dashboard configurations
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dashboards_user_id ON dashboards(user_id);

-- Dashboard widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
    widget_type VARCHAR(100) NOT NULL, -- line_chart, bar_chart, pie_chart, metric_card, table, heatmap, etc.
    title VARCHAR(255),
    config JSONB NOT NULL,
    position JSONB NOT NULL, -- {x, y, w, h}
    data_source VARCHAR(100), -- api endpoint or query
    refresh_interval INTEGER DEFAULT 60, -- seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dashboard_widgets_dashboard_id ON dashboard_widgets(dashboard_id);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    stream_start BOOLEAN DEFAULT true,
    stream_end BOOLEAN DEFAULT false,
    new_follower BOOLEAN DEFAULT true,
    new_comment BOOLEAN DEFAULT false,
    mentions BOOLEAN DEFAULT true,
    alerts BOOLEAN DEFAULT true,
    weekly_report BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- API keys for external integrations
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    permissions TEXT[], -- read:streams, write:events, read:analytics, etc.
    rate_limit INTEGER DEFAULT 1000, -- requests per hour
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_streamers_updated_at BEFORE UPDATE ON streamers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_streams_updated_at BEFORE UPDATE ON streams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_viewer_profiles_updated_at BEFORE UPDATE ON viewer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_viewer_sessions_updated_at BEFORE UPDATE ON viewer_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Default admin user (password: admin123 - change in production!)
INSERT INTO users (email, username, password_hash, full_name, role, email_verified)
VALUES ('admin@livestream.com', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PZvO.S', 'System Administrator', 'admin', true)
ON CONFLICT (email) DO NOTHING;