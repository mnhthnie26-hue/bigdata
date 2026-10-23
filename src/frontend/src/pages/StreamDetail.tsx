import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  Video, 
  Users, 
  Clock, 
  Heart, 
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  BarChart3,
  LineChart,
  PieChart,
  MapPin,
  Settings,
  Share2,
  Download,
  MoreHorizontal,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { api } from '../lib/api'
import type { Stream, RealtimeMetrics } from '../types'
import { clsx } from 'clsx'
import { format } from 'date-fns'

const mockStream: Stream = {
  id: '1',
  streamer_id: '1',
  title: 'Gaming: Valorant Ranked - Climbing to Radiant!',
  description: 'Chào mọi người, hôm nay mình sẽ chơi Valorant ranked để leo rank lên Radiant. Mọi người ủng hộ nhé!',
  category: 'Gaming',
  tags: ['Valorant', 'FPS', 'Ranked', 'Gaming'],
  thumbnail_url: '',
  hls_url: 'https://example.com/stream.m3u8',
  dash_url: 'https://example.com/stream.mpd',
  status: 'live',
  is_mature: false,
  language: 'vi',
  scheduled_start: '',
  actual_start: '2024-01-15T10:00:00Z',
  max_concurrent_viewers: 1250,
  total_views: 5420,
  total_watch_time_seconds: 125000,
  created_at: '',
  updated_at: '',
  streamer: {
    id: '1',
    user_id: '1',
    display_name: 'ProGamerVN',
    bio: 'Professional Valorant player | Radiant rank | Streaming daily',
    category: 'Gaming',
    tags: ['Valorant', 'FPS'],
    verification_status: 'verified',
    total_followers: 50000,
    total_views: 500000,
    is_partner: true,
  }
}

export function StreamDetail() {
  const { streamId } = useParams()
  const navigate = useNavigate()
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [quality, setQuality] = useState('1080p')
  const [volume, setVolume] = useState(80)
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'viewers' | 'chat'>('overview')

  const { data: metrics } = useQuery({
    queryKey: ['stream-metrics', streamId],
    queryFn: async () => generateMockMetrics(),
    refetchInterval: 10000,
  })

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: Video },
    { id: 'analytics', label: 'Phân tích', icon: BarChart3 },
    { id: 'viewers', label: 'Người xem', icon: Users },
    { id: 'chat', label: 'Chat', icon: Heart },
  ]

  return (
    <div className="space-y-6 animate-in">
      {/* Video Player Section */}
      <div className="card overflow-hidden">
        <div className="relative aspect-video bg-black">
          {/* Video placeholder */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-900/50 via-primary-800/30 to-primary-900/50">
            <div className="text-center text-white">
              <Play className="w-16 h-16 mx-auto mb-4 opacity-80" />
              <p className="text-xl font-medium">Live Stream Placeholder</p>
              <p className="text-primary-200 mt-1">Video player sẽ được tích hợp ở đây (HLS/DASH)</p>
            </div>
          </div>

          {/* Live badge */}
          <div className="absolute top-4 left-4 z-10">
            <span className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm font-medium rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Viewer count */}
          <div className="absolute top-4 right-4 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-white text-sm font-medium">
              <Users className="w-4 h-4 text-red-400 animate-pulse" />
              <span>{metrics?.concurrent_viewers?.toLocaleString('vi-VN') || '1,234'}</span>
            </div>
          </div>

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center gap-4">
              <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <div className="flex-1 max-w-md">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={30}
                  className="w-full h-1 bg-white/20 rounded-full appearance-none accent-white"
                />
              </div>
              <span className="text-white text-sm font-mono">30:45 / 2:15:30</span>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20 h-1 bg-white/20 rounded-full appearance-none accent-white"
                />
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none"
                >
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                  <option value="360p">360p</option>
                  <option value="auto">Tự động</option>
                </select>
                <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" onClick={() => setIsFullscreen(!isFullscreen)}>
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stream Info */}
        <div className="p-6 border-t border-dark-200 dark:border-dark-700">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{mockStream.title}</h1>
                {mockStream.streamer?.verification_status === 'verified' && (
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-dark-500 dark:text-dark-400 mb-3">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {mockStream.total_views.toLocaleString('vi-VN')} lượt xem
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  {((metrics?.engagement_rate ?? 0) * 100).toFixed(1)}% tương tác
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Đã phát {formatDuration(Date.now() - new Date(mockStream.actual_start!).getTime())}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {mockStream.tags.map(tag => (
                  <span key={tag} className="badge-primary">{tag}</span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 lg:ml-auto">
              <button className="btn-secondary flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                Chia sẻ
              </button>
              <button className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                Tải về
              </button>
              <button className="btn-secondary p-2">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Streamer Info & Metrics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Streamer Info */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                <Video className="w-8 h-8 text-primary-700 dark:text-primary-300" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-dark-900 dark:text-white">
                    {mockStream.streamer?.display_name}
                  </h3>
                  {mockStream.streamer?.is_partner && (
                    <span className="badge-warning flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Partner
                    </span>
                  )}
                </div>
                <p className="text-dark-600 dark:text-dark-400 mb-3">{mockStream.streamer?.bio}</p>
                <div className="flex items-center gap-6 text-sm">
                  <span className="flex items-center gap-1 text-dark-500 dark:text-dark-400">
                    <Users className="w-4 h-4" />
                    {mockStream.streamer?.total_followers.toLocaleString('vi-VN')} followers
                  </span>
                  <span className="flex items-center gap-1 text-dark-500 dark:text-dark-400">
                    <Video className="w-4 h-4" />
                    {mockStream.streamer?.total_views.toLocaleString('vi-VN')} total views
                  </span>
                </div>
              </div>
              <button className="btn-primary flex-shrink-0">
                <Users className="w-4 h-4" />
                Theo dõi
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="card">
            <div className="border-b border-dark-200 dark:border-dark-700">
              <nav className="flex gap-1 px-4" aria-label="Tabs">
                {tabs.map((tab) => {
                  const TabIcon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors',
                        activeTab === tab.id
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-transparent text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 hover:bg-dark-50 dark:hover:bg-dark-800/50'
                      )}
                    >
                      <TabIcon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="card-body">
              {activeTab === 'overview' && <OverviewTab metrics={metrics} />}
              {activeTab === 'analytics' && <AnalyticsTab metrics={metrics} />}
              {activeTab === 'viewers' && <ViewersTab />}
              {activeTab === 'chat' && <ChatTab />}
            </div>
          </div>
        </div>

        {/* Right Column - Real-time Metrics */}
        <div className="space-y-6">
          {/* Real-time Metrics Cards */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              Chỉ số thời gian thực
            </h3>
            <div className="space-y-4">
              <MetricRow label="Người xem đồng thời" value={metrics?.concurrent_viewers?.toLocaleString('vi-VN') || '1,234'} trend={{ value: 12, positive: true }} />
              <MetricRow label="Người xem duy nhất" value={metrics?.unique_viewers?.toLocaleString('vi-VN') || '2,100'} trend={{ value: 8, positive: true }} />
              <MetricRow label="Thời gian xem TB" value={formatDuration(metrics?.avg_watch_time_seconds || 1200)} trend={{ value: 5, positive: true }} />
              <MetricRow label="Tỷ lệ tương tác" value={`${((metrics?.engagement_rate || 0.08) * 100).toFixed(1)}%`} trend={{ value: 3, positive: true }} />
              <MetricRow label="Bitrate trung bình" value={`${(metrics?.avg_bitrate || 2800).toLocaleString('vi-VN')} kbps`} />
              <MetricRow label="Buffer health" value={`${((metrics?.avg_buffer_health || 0.92) * 100).toFixed(0)}%`} />
              <MetricRow label="Tỷ lệ lỗi" value={`${((metrics?.error_rate || 0.002) * 100).toFixed(2)}%`} trend={{ value: 10, positive: false }} />
            </div>
          </div>

          {/* Quality Distribution */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary-600" />
              Chất lượng video
            </h3>
            <div className="space-y-3">
              {Object.entries(metrics?.quality_distribution || { '1080p': 45, '720p': 30, '480p': 15, '360p': 7, '240p': 3 }).map(([q, count]) => (
                <div key={q} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-medium text-dark-700 dark:text-dark-300">{q}</span>
                  <div className="flex-1 h-4 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${count}%` }} />
                  </div>
                  <span className="w-12 text-right text-sm text-dark-600 dark:text-dark-400">{count}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Countries */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary-600" />
              Top quốc gia
            </h3>
            <div className="space-y-3">
              {Object.entries(metrics?.top_countries || { 'VN': 45, 'US': 18, 'JP': 12, 'KR': 8, 'TH': 7 }).map(([country, count]) => (
                <div key={country} className="flex items-center justify-between">
                  <span className="text-sm text-dark-700 dark:text-dark-300">{country}</span>
                  <span className="font-medium text-dark-900 dark:text-white">{count}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== TAB COMPONENTS ====================

function OverviewTab({ metrics }: { metrics?: RealtimeMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Người xem hiện tại" value={metrics?.concurrent_viewers || 1234} icon={Users} color="blue" />
        <MetricCard title="Đỉnh người xem" value={1567} icon={TrendingUp} color="green" />
        <MetricCard title="Tổng lượt xem" value={5420} icon={Heart} color="red" />
        <MetricCard title="Thời gian xem TB" value={formatDuration(metrics?.avg_watch_time_seconds || 1200)} icon={Clock} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4">Mô tả livestream</h4>
          <p className="text-dark-600 dark:text-dark-400 whitespace-pre-wrap">{mockStream.description}</p>
        </div>
        <div className="card p-6">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4">Thông tin kỹ thuật</h4>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-dark-500 dark:text-dark-400">Trạng thái</dt><dd className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Đang phát</dd></div>
            <div className="flex justify-between"><dt className="text-dark-500 dark:text-dark-400">Danh mục</dt><dd className="font-medium text-dark-900 dark:text-white">{mockStream.category}</dd></div>
            <div className="flex justify-between"><dt className="text-dark-500 dark:text-dark-400">Ngôn ngữ</dt><dd className="font-medium text-dark-900 dark:text-white">{mockStream.language.toUpperCase()}</dd></div>
            <div className="flex justify-between"><dt className="text-dark-500 dark:text-dark-400">Bắt đầu lúc</dt><dd className="font-medium text-dark-900 dark:text-white">{format(new Date(mockStream.actual_start!), 'dd/MM/yyyy HH:mm')}</dd></div>
            <div className="flex justify-between"><dt className="text-dark-500 dark:text-dark-400">HLS URL</dt><dd className="font-mono text-xs text-dark-500 dark:text-dark-400 truncate max-w-xs">{mockStream.hls_url}</dd></div>
            <div className="flex justify-between"><dt className="text-dark-500 dark:text-dark-400">DASH URL</dt><dd className="font-mono text-xs text-dark-500 dark:text-dark-400 truncate max-w-xs">{mockStream.dash_url}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  )
}

function AnalyticsTab({ metrics }: { metrics?: RealtimeMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4">Tương tác</h4>
          <div className="space-y-3">
            <InteractionBar label="Thích" value={metrics?.likes_count || 120} total={200} color="#f43f5e" />
            <InteractionBar label="Chia sẻ" value={metrics?.shares_count || 45} total={200} color="#3b82f6" />
            <InteractionBar label="Bình luận" value={metrics?.comments_count || 32} total={200} color="#10b981" />
            <InteractionBar label="Reactions" value={metrics?.reactions_count || 28} total={200} color="#f59e0b" />
          </div>
        </div>
        <div className="card p-6">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4">Chất lượng trải nghiệm</h4>
          <div className="space-y-4">
            <QualityMetric label="Buffer health" value={((metrics?.avg_buffer_health || 0.92) * 100).toFixed(0)} threshold={80} />
            <QualityMetric label="Tỷ lệ buffer" value={((metrics?.buffer_ratio || 0.03) * 100).toFixed(1)} threshold={5} inverted />
            <QualityMetric label="Tỷ lệ lỗi" value={((metrics?.error_rate || 0.002) * 100).toFixed(2)} threshold={1} inverted />
          </div>
        </div>
      </div>
    </div>
  )
}

function ViewersTab() {
  return (
    <div className="card p-6">
      <h4 className="font-medium text-dark-900 dark:text-white mb-4">Người xem đang hoạt động</h4>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary-700 dark:text-primary-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-dark-900 dark:text-white truncate">Viewer_{String(i).padStart(4, '0')}</p>
              <p className="text-sm text-dark-500 dark:text-dark-400">Mobile • Chrome • VN</p>
            </div>
            <span className="badge-success">Đang xem</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatTab() {
  const [message, setMessage] = useState('')
  const messages = [
    { user: 'User_001', text: 'Chúc streamer may mắn nhé!', time: '10:30' },
    { user: 'User_002', text: 'Skill quá đỉnh!', time: '10:31' },
    { user: 'User_003', text: 'Rank gì vậy bác?', time: '10:32' },
  ]

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-primary-700 dark:text-primary-300" />
            </div>
            <div className="flex-1 bg-dark-100 dark:bg-dark-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-dark-900 dark:text-white">{msg.user}</span>
                <span className="text-xs text-dark-500 dark:text-dark-400">{msg.time}</span>
              </div>
              <p className="text-dark-700 dark:text-dark-300">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-dark-200 dark:border-dark-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 input"
          />
          <button className="btn-primary">Gửi</button>
        </div>
      </div>
    </div>
  )
}

// ==================== COMPONENTS ====================

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className={clsx('card p-4', colors[color as keyof typeof colors])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-dark-500 dark:text-dark-400">{title}</p>
          <p className="text-2xl font-bold text-dark-900 dark:text-white mt-1">{value}</p>
        </div>
        <Icon className="w-8 h-8" />
      </div>
    </div>
  )
}

function MetricRow({ label, value, trend }: { label: string; value: string; trend?: { value: number; positive: boolean } }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-dark-600 dark:text-dark-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium text-dark-900 dark:text-white">{value}</span>
        {trend && (
          <span className={clsx('text-xs font-medium', trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {trend.positive ? '↑' : '↓'}{trend.value}%
          </span>
        )}
      </div>
    </div>
  )
}

function InteractionBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = (value / total) * 100
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-sm text-dark-700 dark:text-dark-300">{label}</span>
      <div className="flex-1 h-3 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      <span className="w-16 text-right text-sm font-medium text-dark-900 dark:text-white">{value}</span>
    </div>
  )
}

function QualityMetric({ label, value, threshold, inverted }: { label: string; value: string; threshold: number; inverted?: boolean }) {
  const numValue = parseFloat(value)
  const isGood = inverted ? numValue <= threshold : numValue >= threshold
  return (
    <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
      <div className="flex items-center gap-2">
        <div className={clsx('w-2 h-2 rounded-full', isGood ? 'bg-green-500' : 'bg-red-500')} />
        <span className="text-sm text-dark-700 dark:text-dark-300">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium text-dark-900 dark:text-white">{value}%</span>
        {isGood ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
      </div>
    </div>
  )
}

// ==================== HELPERS ====================

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function generateMockMetrics(): RealtimeMetrics {
  return {
    stream_id: '1',
    timestamp: new Date().toISOString(),
    concurrent_viewers: 1234 + Math.floor(Math.random() * 100),
    unique_viewers: 2100 + Math.floor(Math.random() * 100),
    avg_watch_time_seconds: 1200 + Math.floor(Math.random() * 300),
    engagement_rate: 0.08 + Math.random() * 0.05,
    avg_bitrate: 2800 + Math.floor(Math.random() * 500),
    quality_distribution: { '1080p': 45, '720p': 30, '480p': 15, '360p': 7, '240p': 3 },
    buffer_ratio: 0.03 + Math.random() * 0.02,
    avg_buffer_health: 0.92 + Math.random() * 0.05,
    error_rate: 0.002 + Math.random() * 0.003,
    error_count: Math.floor(Math.random() * 3),
    likes_count: 120 + Math.floor(Math.random() * 30),
    shares_count: 45 + Math.floor(Math.random() * 15),
    comments_count: 32 + Math.floor(Math.random() * 10),
    reactions_count: 28 + Math.floor(Math.random() * 10),
    top_countries: { 'VN': 45, 'US': 18, 'JP': 12, 'KR': 8, 'TH': 7 },
    platform_distribution: { 'Mobile': 55, 'Desktop': 35, 'Tablet': 8, 'TV': 2 },
  }
}