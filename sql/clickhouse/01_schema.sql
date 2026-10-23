-- ClickHouse Schema for Livestream Analytics
-- ==========================================

-- Create database
CREATE DATABASE IF NOT EXISTS livestream_analytics;

-- ==================== RAW EVENTS TABLE ====================
-- Stores raw events from Kafka for replay/debugging
CREATE TABLE IF NOT EXISTS livestream_analytics.raw_events
(
    event_id String,
    event_type String,
    timestamp DateTime64(3),
    stream_id String,
    viewer_id String,
    session_id String,
    platform String,
    device_type String,
    os String,
    browser String,
    country String,
    city String,
    ip String,
    user_agent String,
    -- Video events
    video_time Float32,
    video_duration Float32,
    quality String,
    bitrate UInt32,
    buffer_health Float32,
    -- Interaction events
    action String,
    -- Error events
    error_code String,
    error_message String,
    -- Custom properties
    properties Map(String, String),
    -- Ingestion metadata
    ingested_at DateTime DEFAULT now(),
    kafka_partition Int32,
    kafka_offset Int64
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (stream_id, event_type, timestamp, viewer_id)
TTL toDateTime(timestamp) + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- ==================== VIEWER SESSIONS TABLE ====================
-- Aggregated viewer sessions
CREATE TABLE IF NOT EXISTS livestream_analytics.viewer_sessions
(
    session_id String,
    viewer_id String,
    stream_id String,
    platform String,
    device_type String,
    os String,
    browser String,
    country String,
    city String,
    started_at DateTime,
    ended_at DateTime,
    duration_seconds UInt32,
    total_watch_time_seconds UInt32,
    peak_concurrent_viewers UInt16,
    avg_bitrate UInt32,
    max_bitrate UInt32,
    min_bitrate UInt32,
    quality_changes UInt16,
    buffer_events UInt16,
    total_buffer_time_seconds Float32,
    errors_count UInt16,
    interactions_count UInt16,
    likes_count UInt16,
    shares_count UInt16,
    comments_count UInt16,
    is_active UInt8,
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMMDD(started_at)
ORDER BY (stream_id, viewer_id, started_at)
SETTINGS index_granularity = 8192;

-- ==================== REALTIME METRICS TABLE ====================
-- Minute-level aggregated metrics for real-time dashboards
CREATE TABLE IF NOT EXISTS livestream_analytics.realtime_metrics
(
    stream_id String,
    window_start DateTime,
    window_end DateTime,
    -- Viewer metrics
    concurrent_viewers UInt32,
    unique_viewers UInt32,
    new_viewers UInt32,
    returning_viewers UInt32,
    peak_concurrent_viewers UInt32,
    -- Engagement metrics
    avg_watch_time_seconds Float32,
    median_watch_time_seconds Float32,
    total_watch_time_seconds UInt64,
    engagement_rate Float32,
    -- Quality metrics
    avg_bitrate UInt32,
    bitrate_distribution Map(String, UInt32),
    quality_distribution Map(String, UInt32),
    buffer_ratio Float32,
    avg_buffer_health Float32,
    -- Error metrics
    error_rate Float32,
    error_count UInt32,
    errors_by_code Map(String, UInt32),
    -- Interaction metrics
    likes_count UInt32,
    shares_count UInt32,
    comments_count UInt32,
    chat_messages_count UInt32,
    reactions_count UInt32,
    -- Geographic
    top_countries Map(String, UInt32),
    top_cities Map(String, UInt32),
    -- Device/Platform
    platform_distribution Map(String, UInt32),
    device_distribution Map(String, UInt32),
    os_distribution Map(String, UInt32),
    browser_distribution Map(String, UInt32),
    -- Metadata
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMMDD(window_start)
ORDER BY (stream_id, window_start)
TTL window_start + INTERVAL 7 DAY
SETTINGS index_granularity = 8192;

-- ==================== HOURLY AGGREGATIONS ====================
-- Hourly rollups for historical analysis
CREATE TABLE IF NOT EXISTS livestream_analytics.hourly_stream_stats
(
    stream_id String,
    hour DateTime,
    -- Viewer metrics
    avg_concurrent_viewers Float32,
    max_concurrent_viewers UInt32,
    total_unique_viewers UInt32,
    total_watch_hours Float32,
    avg_session_duration_seconds Float32,
    -- Engagement
    total_likes UInt32,
    total_shares UInt32,
    total_comments UInt32,
    total_chat_messages UInt32,
    engagement_rate Float32,
    -- Quality
    avg_bitrate UInt32,
    p50_bitrate UInt32,
    p95_bitrate UInt32,
    avg_buffer_health Float32,
    buffer_incidents UInt32,
    -- Errors
    total_errors UInt32,
    error_rate Float32,
    -- Geographic
    viewers_by_country Map(String, UInt32),
    viewers_by_city Map(String, UInt32),
    -- Device
    viewers_by_platform Map(String, UInt32),
    viewers_by_device Map(String, UInt32),
    viewers_by_os Map(String, UInt32),
    viewers_by_browser Map(String, UInt32),
    -- Retention
    viewer_retention_5min Float32,
    viewer_retention_15min Float32,
    viewer_retention_30min Float32,
    viewer_retention_60min Float32,
    -- Metadata
    created_at DateTime DEFAULT now()
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (stream_id, hour)
SETTINGS index_granularity = 8192;

-- ==================== VIEWER PROFILES ====================
-- Enriched viewer profiles for segmentation
CREATE TABLE IF NOT EXISTS livestream_analytics.viewer_profiles
(
    viewer_id String,
    first_seen DateTime,
    last_seen DateTime,
    total_sessions UInt32,
    total_watch_time_seconds UInt64,
    avg_session_duration_seconds Float32,
    favorite_streams Array(String),
    favorite_categories Array(String),
    preferred_quality String,
    preferred_platform String,
    preferred_device String,
    country String,
    city String,
    timezone String,
    language String,
    -- Behavioral tags
    is_high_engagement UInt8,
    is_frequent_viewer UInt8,
    is_mobile_viewer UInt8,
    is_binge_watcher UInt8,
    churn_risk_score Float32,
    lifetime_value Float32,
    -- Segmentation
    segment String,
    -- Metadata
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY viewer_id
SETTINGS index_granularity = 8192;

-- ==================== STREAM CATALOG ====================
-- Stream metadata
CREATE TABLE IF NOT EXISTS livestream_analytics.streams
(
    stream_id String,
    title String,
    description String,
    category String,
    tags Array(String),
    streamer_id String,
    streamer_name String,
    scheduled_start DateTime,
    actual_start DateTime,
    ended_at DateTime,
    status String, -- scheduled, live, ended, archived
    is_mature UInt8,
    language String,
    thumbnail_url String,
    hls_url String,
    dash_url String,
    -- Analytics (updated periodically)
    total_views UInt64,
    peak_concurrent_viewers UInt32,
    avg_concurrent_viewers Float32,
    total_watch_time_hours Float32,
    avg_watch_time_seconds Float32,
    engagement_rate Float32,
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY stream_id
SETTINGS index_granularity = 8192;

-- ==================== MATERIALIZED VIEWS ====================

-- Real-time concurrent viewers per stream (1-minute windows)
CREATE MATERIALIZED VIEW IF NOT EXISTS livestream_analytics.mv_concurrent_viewers_1m
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMMDD(window_start)
ORDER BY (stream_id, window_start)
AS SELECT
    stream_id,
    toStartOfMinute(timestamp) as window_start,
    count(DISTINCT viewer_id) as concurrent_viewers,
    count() as total_events
FROM livestream_analytics.raw_events
WHERE event_type IN ('view_start', 'heartbeat', 'quality_change', 'buffer_start', 'buffer_end')
GROUP BY stream_id, window_start;

-- Viewer session aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS livestream_analytics.mv_viewer_sessions
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMMDD(started_at)
ORDER BY (stream_id, viewer_id, started_at)
AS SELECT
    session_id,
    viewer_id,
    stream_id,
    platform,
    device_type,
    os,
    browser,
    country,
    city,
    min(timestamp) as started_at,
    max(timestamp) as ended_at,
    dateDiff('second', min(timestamp), max(timestamp)) as duration_seconds,
    sumIf(video_duration - video_time, event_type = 'view_end') as total_watch_time_seconds,
    countIf(event_type = 'quality_change') as quality_changes,
    countIf(event_type = 'buffer_start') as buffer_events,
    sumIf(video_time, event_type = 'buffer_end') - sumIf(video_time, event_type = 'buffer_start') as total_buffer_time_seconds,
    countIf(event_type = 'error') as errors_count,
    countIf(event_type IN ('like', 'share', 'comment', 'chat', 'reaction')) as interactions_count,
    countIf(event_type = 'like') as likes_count,
    countIf(event_type = 'share') as shares_count,
    countIf(event_type = 'comment') as comments_count,
    1 as is_active,
    now() as created_at,
    now() as updated_at
FROM livestream_analytics.raw_events
WHERE session_id != ''
GROUP BY session_id, viewer_id, stream_id, platform, device_type, os, browser, country, city;

-- ==================== INDEXES FOR PERFORMANCE ====================
-- Add secondary indexes for common query patterns
ALTER TABLE livestream_analytics.raw_events
ADD INDEX IF NOT EXISTS idx_viewer_id viewer_id TYPE bloom_filter GRANULARITY 4;

ALTER TABLE livestream_analytics.raw_events
ADD INDEX IF NOT EXISTS idx_session_id session_id TYPE bloom_filter GRANULARITY 4;

ALTER TABLE livestream_analytics.raw_events
ADD INDEX IF NOT EXISTS idx_event_type event_type TYPE set(100) GRANULARITY 4;

ALTER TABLE livestream_analytics.realtime_metrics
ADD INDEX IF NOT EXISTS idx_stream_window stream_id, window_start TYPE minmax GRANULARITY 1;

-- ==================== USERS AND PERMISSIONS ====================
CREATE USER IF NOT EXISTS analytics IDENTIFIED BY 'analytics_password';
GRANT ALL ON livestream_analytics.* TO analytics;

-- Read-only user for dashboards
CREATE USER IF NOT EXISTS dashboard IDENTIFIED BY 'dashboard_password';
GRANT SELECT ON livestream_analytics.* TO dashboard;

-- ==================== TTL POLICIES ====================
-- Raw events: 30 days
-- Realtime metrics: 7 days
-- Hourly stats: 2 years (via partition)
-- Viewer profiles: No TTL (updated regularly)
-- Streams: No TTL