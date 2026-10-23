export interface User {
  id: string
  email: string
  username: string
  full_name: string
  avatar_url?: string
  role: 'viewer' | 'streamer' | 'admin' | 'moderator'
  is_active: boolean
  email_verified: boolean
  last_login?: string
  created_at: string
  updated_at: string
}

export interface Stream {
  id: string
  streamer_id: string
  title: string
  description?: string
  category?: string
  tags: string[]
  thumbnail_url?: string
  hls_url?: string
  dash_url?: string
  status: 'scheduled' | 'live' | 'ended' | 'archived' | 'cancelled'
  is_mature: boolean
  language: string
  scheduled_start?: string
  actual_start?: string
  ended_at?: string
  max_concurrent_viewers: number
  total_views: number
  total_watch_time_seconds: number
  created_at: string
  updated_at: string
  streamer?: Streamer
}

export interface Streamer {
  id: string
  user_id: string
  display_name: string
  bio?: string
  category?: string
  tags: string[]
  verification_status: 'pending' | 'verified' | 'rejected'
  total_followers: number
  total_views: number
  is_partner: boolean
}

export interface StreamStats {
  stream_id: string
  current_viewers: number
  peak_viewers: number
  total_views: number
  avg_watch_time_seconds: number
  engagement_rate: number
  avg_bitrate: number
  buffer_ratio: number
  error_rate: number
}

export interface RealtimeMetrics {
  stream_id: string
  timestamp: string
  concurrent_viewers: number
  unique_viewers: number
  avg_watch_time_seconds: number
  engagement_rate: number
  avg_bitrate: number
  quality_distribution: Record<string, number>
  buffer_ratio: number
  avg_buffer_health: number
  error_rate: number
  error_count: number
  likes_count: number
  shares_count: number
  comments_count: number
  reactions_count?: number
  chat_messages_count?: number
  top_countries: Record<string, number>
  platform_distribution: Record<string, number>
}

export interface HistoricalDataPoint {
  stream_id: string
  period_start: string
  avg_concurrent_viewers?: number
  max_concurrent_viewers?: number
  avg_unique_viewers?: number
  total_unique_viewers?: number
  avg_engagement_rate?: number
  total_likes?: number
  total_shares?: number
  total_comments?: number
  avg_bitrate?: number
  max_bitrate?: number
  avg_buffer_health?: number
  avg_buffer_ratio?: number
  avg_error_rate?: number
  total_errors?: number
}

export interface ViewerProfile {
  id: string
  user_id?: string
  anonymous_id?: string
  first_seen: string
  last_seen: string
  total_sessions: number
  total_watch_time_seconds: number
  avg_session_duration_seconds: number
  favorite_streamers: string[]
  favorite_categories: string[]
  preferred_quality?: string
  preferred_platform?: string
  preferred_device?: string
  country?: string
  city?: string
  is_high_engagement: boolean
  is_frequent_viewer: boolean
  is_mobile_viewer: boolean
  is_binge_watcher: boolean
  churn_risk_score: number
  lifetime_value: number
  segment: string
  created_at: string
  updated_at: string
}

export interface ViewerSession {
  id: string
  viewer_profile_id: string
  stream_id: string
  session_id: string
  platform?: string
  device_type?: string
  os?: string
  browser?: string
  country?: string
  city?: string
  started_at: string
  ended_at?: string
  duration_seconds?: number
  total_watch_time_seconds?: number
  quality_changes: number
  buffer_events: number
  total_buffer_time_seconds: number
  errors_count: number
  interactions_count: number
  likes_count: number
  shares_count: number
  comments_count: number
  is_active: boolean
}

export type AlertType = 'low_viewers' | 'high_buffer' | 'high_errors' | 'quality_drop' | 'viewer_drop' | 'stream_offline' | 'high_latency' | 'cdn_issue'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface Alert {
  id: string
  stream_id: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  metadata: Record<string, any>
  is_resolved: boolean
  resolved_at?: string
  resolved_by?: string
  created_at: string
}

export interface AlertRule {
  id: string
  name: string
  description?: string
  alert_type: AlertType
  severity: AlertSeverity
  condition: Record<string, any>
  threshold: number
  window_minutes: number
  is_enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface Dashboard {
  id: string
  user_id: string
  name: string
  description?: string
  layout: DashboardWidget[]
  is_default: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface DashboardWidget {
  id: string
  dashboard_id: string
  widget_type: string
  title: string
  config: WidgetConfig
  position: WidgetPosition
  data_source: string
  refresh_interval: number
  created_at: string
  updated_at: string
}

export interface WidgetConfig {
  type: 'line_chart' | 'bar_chart' | 'pie_chart' | 'metric_card' | 'table' | 'heatmap' | 'gauge'
  title: string
  data_source: string
  query_params: Record<string, any>
  refresh_interval: number
  visualization: Record<string, any>
}

export interface WidgetPosition {
  x: number
  y: number
  w: number
  h: number
}

export interface SegmentStats {
  segment: string
  count: number
  percentage: number
  avg_watch_time: number
  avg_sessions: number
  churn_risk: number
}

export type SegmentStatsResponse = SegmentStats[]

export interface CohortData {
  cohort_month: string
  viewers: number
  retention: number[]
}

export type CohortAnalysisResponse = CohortData[]

export interface TimeRange {
  label: string
  value: string
}

export const TIME_RANGES: TimeRange[] = [
  { label: '5 phút gần nhất', value: '5m' },
  { label: '15 phút gần nhất', value: '15m' },
  { label: '30 phút gần nhất', value: '30m' },
  { label: '1 giờ gần nhất', value: '1h' },
  { label: '6 giờ gần nhất', value: '6h' },
  { label: '24 giờ gần nhất', value: '24h' },
  { label: '7 ngày gần nhất', value: '7d' },
  { label: '30 ngày gần nhất', value: '30d' },
]