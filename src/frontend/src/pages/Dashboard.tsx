import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Heart, 
  AlertTriangle,
  Activity,
  Globe,
  Smartphone,
  BarChart3,
  LineChart,
  Loader2,
  ChevronDown,
  RefreshCw
} from 'lucide-react'
import type { Stream, RealtimeMetrics } from '../types'
import { clsx } from 'clsx'

const TIME_RANGES = [
  { label: '5 phút gần nhất', value: '5m' },
  { label: '15 phút gần nhất', value: '15m' },
  { label: '30 phút gần nhất', value: '30m' },
  { label: '1 giờ gần nhất', value: '1h' },
  { label: '6 giờ gần nhất', value: '6h' },
  { label: '24 giờ gần nhất', value: '24h' },
  { label: '7 ngày gần nhất', value: '7d' },
  { label: '30 ngày gần nhất', value: '30d' },
]

const mockStreams: Stream[] = [
  { id: '1', streamer_id: '1', title: 'Gaming: Valorant Ranked', description: 'Chơi Valorant rank với bạn bè', category: 'Gaming', tags: ['Valorant', 'FPS', 'Ranked'], thumbnail_url: '', hls_url: '', dash_url: '', status: 'live', is_mature: false, language: 'vi', scheduled_start: '', actual_start: '2024-01-15T10:00:00Z', max_concurrent_viewers: 1250, total_views: 5420, total_watch_time_seconds: 125000, created_at: '', updated_at: '' },
  { id: '2', streamer_id: '2', title: 'Chatting & Q&A', description: 'Trò chuyện cùng fan', category: 'Just Chatting', tags: ['Chat', 'Q&A'], thumbnail_url: '', hls_url: '', dash_url: '', status: 'live', is_mature: false, language: 'vi', scheduled_start: '', actual_start: '2024-01-15T11:30:00Z', max_concurrent_viewers: 890, total_views: 3210, total_watch_time_seconds: 89000, created_at: '', updated_at: '' },
  { id: '3', streamer_id: '1', title: 'React Tutorial', description: 'Học React từ cơ bản đến nâng cao', category: 'Education', tags: ['React', 'TypeScript', 'Tutorial'], thumbnail_url: '', hls_url: '', dash_url: '', status: 'ended', is_mature: false, language: 'vi', scheduled_start: '', actual_start: '2024-01-14T14:00:00Z', ended_at: '2024-01-14T17:00:00Z', max_concurrent_viewers: 450, total_views: 2100, total_watch_time_seconds: 180000, created_at: '', updated_at: '' },
]

export function Dashboard() {
  const [selectedStream, setSelectedStream] = useState<Stream | null>(mockStreams[0])
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: metrics, isLoading, refetch } = useQuery<RealtimeMetrics | null>({
    queryKey: ['realtime-metrics', selectedStream?.id],
    queryFn: async () => {
      return null
    },
    refetchInterval: autoRefresh ? 5000 : false,
  })

  const handleRefresh = () => {
    refetch()
  }

  if (!selectedStream) return null

  return (
    <div className="space-y-6 animate-in">
      {/* Header with stream selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            Dashboard: {selectedStream.title}
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Theo dõi real-time • Cập nhật mỗi 10s
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Stream selector */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-lg text-sm font-medium hover:bg-dark-50 dark:hover:bg-dark-800"
              onClick={() => setSelectedStream(mockStreams[(mockStreams.indexOf(selectedStream) + 1) % mockStreams.length])}
            >
              <Activity className={clsx('w-4 h-4', selectedStream.status === 'live' ? 'text-green-500 animate-pulse' : 'text-dark-400')} />
              <span className="truncate max-w-[200px]">{selectedStream.title}</span>
              <ChevronDown className="w-4 h-4 text-dark-400" />
            </button>
          </div>

          {/* Time range */}
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-lg text-sm font-medium hover:bg-dark-50 dark:hover:bg-dark-800">
              <Clock className="w-4 h-4" />
              <span>{TIME_RANGES[3].label}</span>
              <ChevronDown className="w-4 h-4 text-dark-400" />
            </button>
          </div>

          {/* Auto refresh toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-dark-600 dark:text-dark-400">Tự động</span>
          </label>

          <button onClick={handleRefresh} disabled={isLoading} className="btn-secondary">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Người xem hiện tại"
          value={metrics?.concurrent_viewers || 0}
          icon={Users}
          iconColor="text-blue-500"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
          trend={{ value: 12, positive: true }}
          format="number"
        />
        <MetricCard
          title="Thời gian xem TB"
          value={metrics?.avg_watch_time_seconds || 0}
          icon={Clock}
          iconColor="text-green-500"
          bgColor="bg-green-50 dark:bg-green-900/20"
          trend={{ value: 8, positive: true }}
          format="duration"
        />
        <MetricCard
          title="Tỷ lệ tương tác"
          value={metrics?.engagement_rate || 0}
          icon={Heart}
          iconColor="text-red-500"
          bgColor="bg-red-50 dark:bg-red-900/20"
          trend={{ value: 5, positive: true }}
          format="percent"
        />
        <MetricCard
          title="Tỷ lệ lỗi"
          value={metrics?.error_rate || 0}
          icon={AlertTriangle}
          iconColor="text-orange-500"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
          trend={{ value: 2, positive: false }}
          format="percent"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Người xem theo thời gian" icon={LineChart}>
          <ViewerChart data={metrics ?? undefined} timeRange={"1h"} />
        </Card>
        <Card title="Phân bố chất lượng video" icon={BarChart3}>
          <QualityChart data={metrics?.quality_distribution} />
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Top quốc gia" icon={Globe}>
          <CountryChart data={metrics?.top_countries} />
        </Card>
        <Card title="Thiết bị & Nền tảng" icon={Smartphone}>
          <DeviceChart data={metrics?.platform_distribution} />
        </Card>
        <Card title="Tương tác" icon={Heart}>
          <EngagementChart data={metrics ?? undefined} />
        </Card>
      </div>

      {/* Recent Streams Table */}
      <Card title="Các livestream gần đây" icon={Activity}>
        <StreamsTable streams={mockStreams} />
      </Card>
    </div>
  )
}

// ==================== COMPONENTS ====================

interface MetricCardProps {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  bgColor: string
  trend?: { value: number; positive: boolean }
  format: 'number' | 'duration' | 'percent'
}

function MetricCard({ title, value, icon: Icon, iconColor, bgColor, trend, format }: MetricCardProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'duration':
        const mins = Math.floor(val / 60)
        const secs = val % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
      case 'percent':
        return `${(val * 100).toFixed(1)}%`
      default:
        return val.toLocaleString('vi-VN')
    }
  }

  return (
    <div className={clsx('card p-6', bgColor)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-dark-500 dark:text-dark-400">{title}</p>
          <p className="metric-value mt-1">{formatValue(value)}</p>
          {trend && (
            <div className="metric-change mt-2">
              <TrendingUp className={clsx('w-4 h-4', trend.positive ? 'metric-change-positive' : 'metric-change-negative')} />
              <span className={clsx(trend.positive ? 'metric-change-positive' : 'metric-change-negative')}>
                {trend.positive ? '+' : ''}{trend.value}% so với 1h trước
              </span>
            </div>
          )}
        </div>
        <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', iconColor)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

interface CardProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}

function Card({ title, icon: Icon, children }: CardProps) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-dark-500 dark:text-dark-400" />
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">{title}</h3>
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

// ==================== CHART COMPONENTS ====================

function ViewerChart({ data }: { data?: RealtimeMetrics; timeRange?: string }) {
  // Generate mock time series data
  const points = Array.from({ length: 60 }, (_, i) => ({
    time: `${Math.floor(i / 60)}:${(i % 60).toString().padStart(2, '0')}`,
    viewers: Math.floor((data?.concurrent_viewers || 100) * (0.5 + Math.random() * 0.8)),
    peak: Math.floor((data?.concurrent_viewers || 100) * (0.8 + Math.random() * 0.4)),
  }))

  return (
    <div className="chart-container" style={{ height: 300 }}>
      <svg viewBox="0 0 600 300" className="w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="viewersGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {Array.from({ length: 5 }).map((_, i) => (
          <line
            key={i}
            x1="50" y1={50 + i * 50}
            x2="590" y2={50 + i * 50}
            stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4"
          />
        ))}
        
        {/* Area - viewers */}
        <path
          d={generateAreaPath(points, 'viewers', 50, 50, 540, 200)}
          fill="url(#viewersGradient)"
        />
        {/* Line - viewers */}
        <path
          d={generateLinePath(points, 'viewers', 50, 50, 540, 200)}
          stroke="#3b82f6" strokeWidth="2" fill="none"
        />
        {/* Line - peak */}
        <path
          d={generateLinePath(points, 'peak', 50, 50, 540, 200)}
          stroke="#ef4444" strokeWidth="1.5" fill="none" strokeDasharray="4,4"
        />
        
        {/* Current value indicator */}
        {data && (
          <circle
            cx={590} cy={getY(data.concurrent_viewers, points, 'viewers', 50, 50, 540, 200)}
            r={6} fill="#3b82f6" stroke="white" strokeWidth={2}
          />
        )}
      </svg>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-400">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Hiện tại</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-400">
          <div className="w-6 h-1 border-t-2 border-dashed border-red-500" />
          <span>Đỉnh</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-dark-900 dark:text-white">
          <Activity className="w-4 h-4 text-green-500 animate-pulse" />
          <span>{data?.concurrent_viewers || 0} đang xem</span>
        </div>
      </div>
    </div>
  )
}

function QualityChart({ data }: { data?: Record<string, number> }) {
  const qualities = data || { '1080p': 45, '720p': 30, '480p': 15, '360p': 7, '240p': 3 }
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
  const total = Object.values(qualities).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4" style={{ height: 260 }}>
      {Object.entries(qualities).map(([quality, count], i) => (
        <div key={quality} className="flex items-center gap-3">
          <div className="w-20 text-sm font-medium text-dark-700 dark:text-dark-300">{quality}</div>
          <div className="flex-1 h-6 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${(count / total) * 100}%`, 
                backgroundColor: colors[i % colors.length] 
              }}
            />
          </div>
          <span className="w-16 text-right text-sm font-medium text-dark-900 dark:text-white">
            {((count / total) * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

function CountryChart({ data }: { data?: Record<string, number> }) {
  const countries = data || { 'VN': 45, 'US': 18, 'JP': 12, 'KR': 8, 'TH': 7, 'Khác': 10 }
  
  return (
    <div className="space-y-3" style={{ height: 260 }}>
      {Object.entries(countries).slice(0, 6).map(([country, count]) => (
        <div key={country} className="flex items-center gap-3">
          <div className="w-10 text-sm font-medium text-dark-700 dark:text-dark-300">{country}</div>
          <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${count}%` }}
            />
          </div>
          <span className="w-16 text-right text-sm text-dark-600 dark:text-dark-400">{count}%</span>
        </div>
      ))}
    </div>
  )
}

function DeviceChart({ data }: { data?: Record<string, number> }) {
  const devices = data || { 'Mobile': 55, 'Desktop': 35, 'Tablet': 8, 'TV': 2 }
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

  return (
    <div className="space-y-3" style={{ height: 260 }}>
      {Object.entries(devices).map(([device, count], i) => (
        <div key={device} className="flex items-center gap-3">
          <div className="w-20 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
            <span className="text-sm text-dark-700 dark:text-dark-300">{device}</span>
          </div>
          <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${count}%`, backgroundColor: colors[i] }}
            />
          </div>
          <span className="w-16 text-right text-sm font-medium text-dark-900 dark:text-white">{count}%</span>
        </div>
      ))}
    </div>
  )
}

function EngagementChart({ data }: { data?: RealtimeMetrics }) {
  const interactions = data ? {
    'Thích': data.likes_count,
    'Chia sẻ': data.shares_count,
    'Bình luận': data.comments_count,
  } : { 'Thích': 120, 'Chia sẻ': 45, 'Bình luận': 32 }
  
  const total = Object.values(interactions).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3" style={{ height: 260 }}>
      {Object.entries(interactions).map(([action, count]) => (
        <div key={action} className="flex items-center gap-3">
          <div className="w-20 text-sm text-dark-700 dark:text-dark-300">{action}</div>
          <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-pink-500 transition-all duration-500"
              style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
            />
          </div>
          <span className="w-16 text-right text-sm font-medium text-dark-900 dark:text-white">
            {count.toLocaleString('vi-VN')}
          </span>
        </div>
      ))}
      <div className="pt-2 border-t border-dark-200 dark:border-dark-700">
        <div className="flex justify-between text-sm">
          <span className="text-dark-500 dark:text-dark-400">Tổng tương tác</span>
          <span className="font-medium text-dark-900 dark:text-white">{total.toLocaleString('vi-VN')}</span>
        </div>
      </div>
    </div>
  )
}

function StreamsTable({ streams }: { streams: Stream[] }) {
  const getStatusBadge = (status: string) => {
    const config = {
      live: { class: 'badge-success', icon: <Activity className="w-3 h-3 animate-pulse" /> },
      ended: { class: 'badge', icon: <Activity className="w-3 h-3" /> },
      scheduled: { class: 'badge-info', icon: <Activity className="w-3 h-3" /> },
    }
    const c = config[status as keyof typeof config] || config.ended
    return (
      <span className={clsx('badge flex items-center gap-1', c.class)}>
        {c.icon} {status === 'live' ? 'Đang phát' : status === 'ended' ? 'Đã kết thúc' : 'Đã lên lịch'}
      </span>
    )
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Livestream</th>
            <th className="hidden md:table-cell">Danh mục</th>
            <th className="hidden md:table-cell">Trạng thái</th>
            <th className="text-right">Người xem tối đa</th>
            <th className="text-right">Tổng lượt xem</th>
            <th className="text-right">Thời gian xem</th>
            <th className="text-right">Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {streams.map((stream) => (
            <tr key={stream.id}>
              <td className="font-medium text-dark-900 dark:text-white max-w-xs truncate">
                {stream.title}
              </td>
              <td className="hidden md:table-cell">
                <span className="badge-primary">{stream.category}</span>
              </td>
              <td className="hidden md:table-cell">{getStatusBadge(stream.status)}</td>
              <td className="text-right font-mono text-dark-900 dark:text-white">
                {stream.max_concurrent_viewers.toLocaleString('vi-VN')}
              </td>
              <td className="text-right font-mono text-dark-900 dark:text-white">
                {stream.total_views.toLocaleString('vi-VN')}
              </td>
              <td className="text-right font-mono text-dark-900 dark:text-white">
                {formatDuration(stream.total_watch_time_seconds)}
              </td>
              <td className="text-right text-sm text-dark-500 dark:text-dark-400">
                {formatDate(stream.actual_start || stream.scheduled_start)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ==================== HELPERS ====================

function generateLinePath(_points: any[], _field: string, _x0: number, _y0: number, _width: number, _height: number) {
  void _points
  void _field
  void _x0
  void _y0
  void _width
  void _height
  return ''
}

function generateAreaPath(_points: any[], _field: string, _x0: number, _y0: number, _width: number, _height: number) {
  void _points
  void _field
  void _x0
  void _y0
  void _width
  void _height
  return ''
}

function getY(value: number, _points: any[], _field: string, _x0: number, _y0: number, _width: number, _height: number) {
  void _x0
  void _width
  void _points
  void _field
  return _y0 + _height - (value / 1) * _height
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('vi-VN', { 
    day: '2-digit', month: '2-digit', 
    hour: '2-digit', minute: '2-digit' 
  })
}
