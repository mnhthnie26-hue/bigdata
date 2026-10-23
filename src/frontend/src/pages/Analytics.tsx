import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  MapPin, 
  Monitor, 
  Smartphone,
  Download,
  ChevronDown,
  TrendingUp,
  Filter,
  CalendarRange,
  RefreshCw
} from 'lucide-react'
import type { HistoricalDataPoint, TimeRange } from '../types'
import { TIME_RANGES } from '../types'
import { clsx } from 'clsx'
import { format } from 'date-fns'

const mockHistoricalData: HistoricalDataPoint[] = Array.from({ length: 24 }, (_, i) => ({
  stream_id: '1',
  period_start: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
  avg_concurrent_viewers: 400 + Math.floor(Math.random() * 400),
  max_concurrent_viewers: 600 + Math.floor(Math.random() * 400),
  avg_unique_viewers: 500 + Math.floor(Math.random() * 300),
  total_unique_viewers: 800 + Math.floor(Math.random() * 500),
  avg_engagement_rate: 0.05 + Math.random() * 0.1,
  total_likes: 50 + Math.floor(Math.random() * 100),
  total_shares: 15 + Math.floor(Math.random() * 30),
  total_comments: 20 + Math.floor(Math.random() * 40),
  avg_bitrate: 2500 + Math.floor(Math.random() * 1000),
  max_bitrate: 4000 + Math.floor(Math.random() * 2000),
  avg_buffer_health: 0.85 + Math.random() * 0.15,
  avg_buffer_ratio: 0.02 + Math.random() * 0.05,
  avg_error_rate: 0.001 + Math.random() * 0.01,
  total_errors: Math.floor(Math.random() * 5),
}))

const mockTopStreams = [
  { stream_id: '1', title: 'Gaming: Valorant Ranked', category: 'Gaming', avg_concurrent_viewers: 1250, peak_concurrent_viewers: 1800, total_unique_viewers: 5420, avg_engagement_rate: 0.12, total_likes: 1200, total_shares: 300 },
  { stream_id: '2', title: 'Chatting & Q&A', category: 'Just Chatting', avg_concurrent_viewers: 890, peak_concurrent_viewers: 1200, total_unique_viewers: 3210, avg_engagement_rate: 0.15, total_likes: 950, total_shares: 200 },
  { stream_id: '3', title: 'React Tutorial', category: 'Education', avg_concurrent_viewers: 450, peak_concurrent_viewers: 680, total_unique_viewers: 2100, avg_engagement_rate: 0.08, total_likes: 400, total_shares: 80 },
  { stream_id: '4', title: 'Music Production Live', category: 'Music', avg_concurrent_viewers: 320, peak_concurrent_viewers: 500, total_unique_viewers: 1800, avg_engagement_rate: 0.10, total_likes: 350, total_shares: 120 },
  { stream_id: '5', title: 'Cooking Vietnamese Food', category: 'Food', avg_concurrent_viewers: 280, peak_concurrent_viewers: 420, total_unique_viewers: 1500, avg_engagement_rate: 0.18, total_likes: 500, total_shares: 250 },
]

export function Analytics() {
  const [timeRange, setTimeRange] = useState<TIME_RANGES[number]['value']>('24h')
  const [selectedMetric, setSelectedMetric] = useState<'viewers' | 'engagement' | 'quality' | 'errors'>('viewers')
  const [compareStreams, setCompareStreams] = useState<string[]>([])

  const { data: historicalData } = useQuery({
    queryKey: ['historical-analytics', timeRange],
    queryFn: async () => mockHistoricalData,
    staleTime: 30000,
  })

  const metrics = [
    { key: 'viewers', label: 'Người xem', icon: BarChart3 },
    { key: 'engagement', label: 'Tương tác', icon: TrendingUp },
    { key: 'quality', label: 'Chất lượng', icon: Monitor },
    { key: 'errors', label: 'Lỗi & Buffer', icon: Smartphone },
  ]

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Phân tích chi tiết</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Xem báo cáo lịch sử, so sánh livestream và xuất dữ liệu
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-lg text-sm font-medium hover:bg-dark-50 dark:hover:bg-dark-800">
              <CalendarRange className="w-4 h-4" />
              <span>{TIME_RANGES.find(t => t.value === timeRange)?.label}</span>
              <ChevronDown className="w-4 h-4 text-dark-400" />
            </button>
          </div>
          
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon
          return (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key as any)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                selectedMetric === metric.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-dark-900 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800'
              )}
            >
              <MetricIcon className="w-4 h-4" />
              {metric.label}
            </button>
          )
        })}
      </div>

      {/* Main Chart */}
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-dark-500 dark:text-dark-400" />
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
              {metrics.find(m => m.key === selectedMetric)?.label} theo thời gian
            </h3>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="input py-1.5 pl-3 pr-8 text-sm bg-white dark:bg-dark-900"
            >
              {TIME_RANGES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            
            <button className="btn-secondary btn-sm" onClick={() => {}}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="card-body">
          <MetricChart 
            data={historicalData} 
            metric={selectedMetric} 
            height={400}
          />
        </div>
      </div>

      {/* Secondary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {selectedMetric === 'viewers' && (
          <>
            <Card title="Top Livestreams" icon={TrendingUp}>
              <TopStreamsTable streams={mockTopStreams} />
            </Card>
            
            <Card title="Phân bố thiết bị" icon={Monitor}>
              <DeviceDistributionChart />
            </Card>
          </>
        )}
        
        {selectedMetric === 'engagement' && (
          <>
            <Card title="Tương tác theo loại" icon={PieChart}>
              <EngagementBreakdownChart />
            </Card>
            
            <Card title="Phân bố địa lý" icon={MapPin}>
              <GeoDistributionChart />
            </Card>
          </>
        )}
        
        {selectedMetric === 'quality' && (
          <>
            <Card title="Phân bố chất lượng video" icon={Monitor}>
              <QualityDistributionChart />
            </Card>
            
            <Card title="Bitrate trung bình" icon={LineChart}>
              <BitrateChart />
            </Card>
          </>
        )}
        
        {selectedMetric === 'errors' && (
          <>
            <Card title="Tỷ lệ Buffer" icon={Smartphone}>
              <BufferChart />
            </Card>
            
            <Card title="Lỗi theo loại" icon={PieChart}>
              <ErrorBreakdownChart />
            </Card>
          </>
        )}
      </div>

      {/* Comparison Section */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-dark-500 dark:text-dark-400" />
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white">So sánh Livestream</h3>
          </div>
          <button className="btn-secondary btn-sm">
            <Filter className="w-4 h-4" />
            Chọn để so sánh
          </button>
        </div>
        <div className="card-body">
          <ComparisonChart streams={mockTopStreams} selected={compareStreams} onSelect={setCompareStreams} />
        </div>
      </div>
    </div>
  )
}

// ==================== CHART COMPONENTS ====================

function MetricChart({ data, metric, height }: { data: HistoricalDataPoint[] | undefined; metric: string; height: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-dark-400">
        Không có dữ liệu cho khoảng thời gian này
      </div>
    )
  }

  const metricConfig = {
    viewers: { 
      key: 'avg_concurrent_viewers' as keyof HistoricalDataPoint, 
      color: '#3b82f6', 
      label: 'Người xem TB',
      formatter: (v: number) => v.toLocaleString('vi-VN')
    },
    engagement: { 
      key: 'avg_engagement_rate' as keyof HistoricalDataPoint, 
      color: '#f43f5e', 
      label: 'Tỷ lệ tương tác',
      formatter: (v: number) => `${(v * 100).toFixed(1)}%`
    },
    quality: { 
      key: 'avg_bitrate' as keyof HistoricalDataPoint, 
      color: '#10b981', 
      label: 'Bitrate TB (kbps)',
      formatter: (v: number) => `${v.toLocaleString('vi-VN')} kbps`
    },
    errors: { 
      key: 'avg_error_rate' as keyof HistoricalDataPoint, 
      color: '#ef4444', 
      label: 'Tỷ lệ lỗi',
      formatter: (v: number) => `${(v * 100).toFixed(2)}%`
    },
  }

  const config = metricConfig[metric as keyof typeof metricConfig] || metricConfig.viewers
  const maxVal = Math.max(...data.map(d => Number(d[config.key]) || 0), 1)
  const width = 1000
  const chartHeight = height - 60

  return (
    <div style={{ width, height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={config.color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={config.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Grid */}
        {Array.from({ length: 5 }).map((_, i) => (
          <line
            key={i}
            x1="60" y1={30 + i * (chartHeight / 4)}
            x2={width - 20} y2={30 + i * (chartHeight / 4)}
            stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4"
          />
        ))}
        
        {/* Area */}
        <path
          d={generateAreaPath(data, config.key, maxVal, 60, 30, width - 80, chartHeight)}
          fill="url(#metricGradient)"
        />
        
        {/* Line */}
        <path
          d={generateLinePath(data, config.key, maxVal, 60, 30, width - 80, chartHeight)}
          stroke={config.color} strokeWidth="2.5" fill="none"
        />
        
        {/* Points */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={60 + (i / (data.length - 1)) * (width - 80)}
            cy={30 + chartHeight - (Number(d[config.key]) / maxVal) * chartHeight}
            r={4} fill={config.color} stroke="white" strokeWidth={2}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between px-2 mt-2 text-xs text-dark-500 dark:text-dark-400" style={{ width }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i) => (
          <span key={i} style={{ 
            position: 'absolute', 
            left: `${60 + (i * Math.ceil(data.length / 6) / (data.length - 1)) * (width - 80)}px`,
            transform: 'translateX(-50%)'
          }}>
            {format(new Date(d.period_start), 'HH:mm')}
          </span>
        ))}
      </div>
    </div>
  )
}

function TopStreamsTable({ streams }: { streams: any[] }) {
  return (
    <div className="space-y-3">
      {streams.map((stream, i) => (
        <div key={stream.stream_id} className="flex items-center gap-4 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors">
          <span className="w-8 text-center font-bold text-dark-500 dark:text-dark-400">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-dark-900 dark:text-white truncate">{stream.title}</p>
            <p className="text-sm text-dark-500 dark:text-dark-400">{stream.category}</p>
          </div>
          <div className="text-right w-24">
            <p className="font-medium text-dark-900 dark:text-white">{stream.avg_concurrent_viewers.toLocaleString('vi-VN')}</p>
            <p className="text-xs text-dark-500 dark:text-dark-400">TB: {stream.avg_concurrent_viewers.toLocaleString('vi-VN')}</p>
          </div>
          <div className="text-right w-24">
            <p className="font-medium text-dark-900 dark:text-white">{(stream.avg_engagement_rate * 100).toFixed(1)}%</p>
            <p className="text-xs text-dark-500 dark:text-dark-400">Tương tác</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function DeviceDistributionChart() {
  const data = { 'Mobile': 55, 'Desktop': 35, 'Tablet': 8, 'TV': 2 }
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
  const total = Object.values(data).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3 h-64">
      {Object.entries(data).map(([device, count], i) => (
        <div key={device} className="flex items-center gap-3">
          <div className="w-24 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
            <span className="text-sm text-dark-700 dark:text-dark-300">{device}</span>
          </div>
          <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(count / total) * 100}%`, backgroundColor: colors[i] }}
            />
          </div>
          <span className="w-16 text-right text-sm font-medium text-dark-900 dark:text-white">{count}%</span>
        </div>
      ))}
    </div>
  )
}

function EngagementBreakdownChart() {
  const data = { 'Thích': 45, 'Chia sẻ': 20, 'Bình luận': 25, 'Reaction': 10 }
  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b']
  const total = Object.values(data).reduce((a, b) => a + b, 0)

  return (
    <div className="flex items-center justify-center h-64">
      <svg viewBox="0 0 200 200" className="w-64 h-64">
        let cumulative = 0
        {Object.entries(data).map(([label, value], i) => {
          const angle = (value / total) * 360
          const startAngle = cumulative
          const endAngle = cumulative + angle
          cumulative += angle
          
          const startX = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180)
          const startY = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180)
          const endX = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180)
          const endY = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180)
          const largeArc = angle > 180 ? 1 : 0
          
          return (
            <path
              key={label}
              d={`M 100 100 L ${startX} ${startY} A 80 80 0 ${largeArc} 1 ${endX} ${endY} Z`}
              fill={colors[i]}
            />
          )
        })}
        <circle cx="100" cy="100" r="50" fill="white" />
      </svg>
      <div className="absolute space-y-2">
        {Object.entries(data).map(([label, value], i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
            <span className="text-sm text-dark-700 dark:text-dark-300">
              {label}: {((value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GeoDistributionChart() {
  const data = { 'Việt Nam': 45, 'Mỹ': 18, 'Nhật': 12, 'Hàn': 8, 'Thái': 7, 'Khác': 10 }
  
  return (
    <div className="space-y-3 h-64">
      {Object.entries(data).map(([country, count]) => (
        <div key={country} className="flex items-center gap-3">
          <div className="w-24 text-sm font-medium text-dark-700 dark:text-dark-300">{country}</div>
          <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${count}%` }} />
          </div>
          <span className="w-16 text-right text-sm text-dark-600 dark:text-dark-400">{count}%</span>
        </div>
      ))}
    </div>
  )
}

function QualityDistributionChart() {
  const data = { '1080p': 40, '720p': 30, '480p': 15, '360p': 10, '240p': 5 }
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
  const total = Object.values(data).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3 h-64">
      {Object.entries(data).map(([quality, count], i) => (
        <div key={quality} className="flex items-center gap-3">
          <div className="w-20 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
            <span className="text-sm text-dark-700 dark:text-dark-300">{quality}</span>
          </div>
          <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(count / total) * 100}%`, backgroundColor: colors[i] }}
            />
          </div>
          <span className="w-16 text-right text-sm font-medium text-dark-900 dark:text-white">{count}%</span>
        </div>
      ))}
    </div>
  )
}

function BitrateChart() {
  const points = Array.from({ length: 24 }, (_, i) => 2000 + Math.floor(Math.random() * 2000))
  const maxVal = Math.max(...points)
  const width = 400
  const height = 200

  return (
    <div style={{ width, height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <path
          d={generateSimplePath(points, maxVal, 0, 0, width, height)}
          stroke="#3b82f6" strokeWidth="2" fill="none"
        />
      </svg>
    </div>
  )
}

function BufferChart() {
  const points = Array.from({ length: 24 }, (_, i) => Math.random() * 0.08)
  const maxVal = Math.max(...points, 0.1)
  const width = 400
  const height = 200

  return (
    <div style={{ width, height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <path
          d={generateSimplePath(points, maxVal, 0, 0, width, height)}
          stroke="#f59e0b" strokeWidth="2" fill="none"
        />
      </svg>
    </div>
  )
}

function ErrorBreakdownChart() {
  const data = { 'Network': 40, 'Codec': 25, 'DRM': 15, 'Player': 20 }
  const colors = ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899']
  const total = Object.values(data).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3 h-64">
      {Object.entries(data).map(([error, count], i) => (
        <div key={error} className="flex items-center gap-3">
          <div className="w-20 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
            <span className="text-sm text-dark-700 dark:text-dark-300">{error}</span>
          </div>
          <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, backgroundColor: colors[i] }} />
          </div>
          <span className="w-16 text-right text-sm font-medium text-dark-900 dark:text-white">{count}%</span>
        </div>
      ))}
    </div>
  )
}

function ComparisonChart({ streams, selected, onSelect }: { streams: any[]; selected: string[]; onSelect: (ids: string[]) => void }) {
  return (
    <div className="space-y-3">
      {streams.map(stream => (
        <label key={stream.stream_id} className="flex items-center gap-4 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg cursor-pointer hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors">
          <input
            type="checkbox"
            checked={selected.includes(stream.stream_id)}
            onChange={(e) => onSelect(e.target.checked ? [...selected, stream.stream_id] : selected.filter(id => id !== stream.stream_id))}
            className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-dark-900 dark:text-white truncate">{stream.title}</p>
            <p className="text-sm text-dark-500 dark:text-dark-400">{stream.category} • {stream.avg_concurrent_viewers.toLocaleString('vi-VN')} viewers TB</p>
          </div>
          {selected.includes(stream.stream_id) && (
            <span className="badge-success">Đã chọn</span>
          )}
        </label>
      ))}
      {selected.length >= 2 && (
        <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
          <button className="btn-primary w-full">
            So sánh {selected.length} livestream đã chọn
          </button>
        </div>
      )}
    </div>
  )
}

// ==================== HELPERS ====================

function generateLinePath(data: HistoricalDataPoint[], key: string, maxVal: number, x0: number, y0: number, width: number, height: number) {
  return data.map((d, i) => {
    const x = x0 + (i / (data.length - 1)) * width
    const y = y0 + height - (Number(d[key]) / maxVal) * height
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
}

function generateAreaPath(data: HistoricalDataPoint[], key: string, maxVal: number, x0: number, y0: number, width: number, height: number) {
  const linePath = generateLinePath(data, key, maxVal, x0, y0, width, height)
  return linePath.replace('M', 'M') + ` L ${x0 + width} ${y0 + height} L ${x0} ${y0 + height} Z`
}

function generateSimplePath(points: number[], maxVal: number, x0: number, y0: number, width: number, height: number) {
  return points.map((v, i) => {
    const x = x0 + (i / (points.length - 1)) * width
    const y = y0 + height - (v / maxVal) * height
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
}