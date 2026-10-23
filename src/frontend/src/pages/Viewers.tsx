import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Users, 
  Search, 
  Filter, 
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MapPin,
  Smartphone,
  Award,
  AlertTriangle,
  Loader2,
  Eye,
  Download,
  BarChart3,
  PieChart,
  LineChart,
  Activity
} from 'lucide-react'
import { api } from '../lib/api'
import type { ViewerProfile, ViewerSession, SegmentStats, CohortData } from '../types'
import { clsx } from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale/vi'

const mockViewers: ViewerProfile[] = Array.from({ length: 50 }, (_, i) => ({
  id: `viewer_${String(i + 1).padStart(4, '0')}`,
  user_id: i < 30 ? `user_${String(i + 1).padStart(4, '0')}` : undefined,
  anonymous_id: i >= 30 ? `anon_${String(i + 1).padStart(4, '0')}` : undefined,
  first_seen: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
  last_seen: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  total_sessions: Math.floor(Math.random() * 100) + 1,
  total_watch_time_seconds: Math.floor(Math.random() * 1000000) + 1000,
  avg_session_duration_seconds: Math.floor(Math.random() * 3600) + 300,
  favorite_streamers: ['streamer_1', 'streamer_2'],
  favorite_categories: ['Gaming', 'Just Chatting'],
  preferred_quality: ['1080p', '720p', '480p'][Math.floor(Math.random() * 3)],
  preferred_platform: ['web', 'ios', 'android'][Math.floor(Math.random() * 3)],
  preferred_device: ['mobile', 'desktop', 'tablet'][Math.floor(Math.random() * 3)],
  country: ['VN', 'US', 'JP', 'KR', 'TH'][Math.floor(Math.random() * 5)],
  city: ['Hanoi', 'Ho Chi Minh City', 'Tokyo', 'Seoul', 'Bangkok'][Math.floor(Math.random() * 5)],
  is_high_engagement: Math.random() > 0.7,
  is_frequent_viewer: Math.random() > 0.6,
  is_mobile_viewer: Math.random() > 0.5,
  is_binge_watcher: Math.random() > 0.8,
  churn_risk_score: Math.random() * 0.5,
  lifetime_value: Math.random() * 1000,
  segment: ['new', 'casual', 'regular', 'loyal', 'at_risk', 'churned'][Math.floor(Math.random() * 6)],
  created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
}))

const mockSegments: SegmentStats[] = [
  { segment: 'loyal', count: 1200, percentage: 12.5, avg_watch_time: 45.2, avg_sessions: 25.3, churn_risk: 0.05 },
  { segment: 'regular', count: 2800, percentage: 29.2, avg_watch_time: 28.5, avg_sessions: 15.7, churn_risk: 0.12 },
  { segment: 'casual', count: 3500, percentage: 36.5, avg_watch_time: 12.3, avg_sessions: 5.2, churn_risk: 0.35 },
  { segment: 'new', count: 1500, percentage: 15.6, avg_watch_time: 8.7, avg_sessions: 2.1, churn_risk: 0.45 },
  { segment: 'at_risk', count: 400, percentage: 4.2, avg_watch_time: 15.8, avg_sessions: 8.9, churn_risk: 0.78 },
  { segment: 'churned', count: 200, percentage: 2.1, avg_watch_time: 5.2, avg_sessions: 1.5, churn_risk: 0.95 },
]

const mockCohorts: CohortData[] = [
  { cohort_month: '2023-12', viewers: 1500, retention: [100, 45, 32, 25, 20] },
  { cohort_month: '2024-01', viewers: 1800, retention: [100, 48, 35, 28, 22] },
  { cohort_month: '2024-02', viewers: 2100, retention: [100, 52, 38, 30, 24] },
  { cohort_month: '2024-03', viewers: 1900, retention: [100, 50, 36, 29, 23] },
  { cohort_month: '2024-04', viewers: 2300, retention: [100, 55, 40, 32, 25] },
  { cohort_month: '2024-05', viewers: 2500, retention: [100, 58, 42, 35, 28] },
]

export function Viewers() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null)
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'last_seen' | 'total_sessions' | 'total_watch_time' | 'churn_risk'>('last_seen')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState<'list' | 'segments' | 'cohorts' | 'behavior'>('list')

  const { data: viewers, isLoading } = useQuery({
    queryKey: ['viewers', page, pageSize, search, segmentFilter, countryFilter, sortField, sortOrder],
    queryFn: async () => {
      // In real app, call API with filters
      let filtered = [...mockViewers]
      
      if (search) {
        filtered = filtered.filter(v => 
          v.id.toLowerCase().includes(search.toLowerCase()) ||
          v.country?.toLowerCase().includes(search.toLowerCase()) ||
          v.city?.toLowerCase().includes(search.toLowerCase())
        )
      }
      if (segmentFilter) filtered = filtered.filter(v => v.segment === segmentFilter)
      if (countryFilter) filtered = filtered.filter(v => v.country === countryFilter)
      
      filtered.sort((a, b) => {
        const aVal = a[sortField as keyof ViewerProfile]
        const bVal = b[sortField as keyof ViewerProfile]
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
      
      const start = (page - 1) * pageSize
      const end = start + pageSize
      return {
        viewers: filtered.slice(start, end),
        total: filtered.length,
        page,
        page_size: pageSize,
        total_pages: Math.ceil(filtered.length / pageSize)
      }
    },
    placeholderData: { viewers: [], total: 0, page: 1, page_size: 20, total_pages: 1 },
  })

  const tabs = [
    { id: 'list', label: 'Danh sách', icon: Users },
    { id: 'segments', label: 'Phân khúc', icon: Award },
    { id: 'cohorts', label: 'Cohort', icon: BarChart3 },
    { id: 'behavior', label: 'Hành vi', icon: Activity },
  ]

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Quản lý người xem</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Phân tích hành vi, phân khúc và الاحتفاظ người xem
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Xuất dữ liệu
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-dark-900 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'list' && (
        <ViewerListTab 
          viewers={viewers} 
          isLoading={isLoading}
          search={search}
          setSearch={setSearch}
          segmentFilter={segmentFilter}
          setSegmentFilter={setSegmentFilter}
          countryFilter={countryFilter}
          setCountryFilter={setCountryFilter}
          sortField={sortField}
          setSortField={setSortField}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      )}

      {activeTab === 'segments' && (
        <SegmentsTab segments={mockSegments} />
      )}

      {activeTab === 'cohorts' && (
        <CohortsTab cohorts={mockCohorts} />
      )}

      {activeTab === 'behavior' && (
        <BehaviorTab />
      )}
    </div>
  )
}

// ==================== TAB COMPONENTS ====================

function ViewerListTab({ 
  viewers, isLoading, search, setSearch, segmentFilter, setSegmentFilter,
  countryFilter, setCountryFilter, sortField, setSortField, sortOrder, setSortOrder,
  page, setPage, pageSize, setPageSize
}: any) {
  const segments = ['new', 'casual', 'regular', 'loyal', 'at_risk', 'churned']
  const countries = ['VN', 'US', 'JP', 'KR', 'TH', 'SG', 'MY', 'ID']

  const getSegmentBadge = (segment: string) => {
    const colors = {
      loyal: 'badge-success',
      regular: 'badge-primary',
      casual: 'badge-info',
      new: 'badge-warning',
      at_risk: 'badge-danger',
      churned: 'badge',
    }
    return <span className={clsx('badge', colors[segment as keyof typeof colors] || 'badge')}>
      {segment.charAt(0).toUpperCase() + segment.slice(1)}
    </span>
  }

  const sortableHeaders = [
    { key: 'last_seen' as const, label: 'Hoạt động gần nhất' },
    { key: 'total_sessions' as const, label: 'Số phiên' },
    { key: 'total_watch_time' as const, label: 'Thời gian xem' },
    { key: 'churn_risk' as const, label: 'Rủi ro rời bỏ' },
  ]

  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    if (hours > 0) return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`
    return `${Math.floor(seconds / 60)}m`
  }

  return (
    <div className="card">
      {/* Filters */}
      <div className="card-header flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm người xem..."
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={segmentFilter || ''}
            onChange={(e) => setSegmentFilter(e.target.value || null)}
            className="input py-1.5 pr-8"
          >
            <option value="">Tất cả phân khúc</option>
            {segments.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select
            value={countryFilter || ''}
            onChange={(e) => setCountryFilter(e.target.value || null)}
            className="input py-1.5 pr-8"
          >
            <option value="">Tất cả quốc gia</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Người xem</th>
              <th>Phân khúc</th>
              <th className="hidden md:table-cell">Quốc gia</th>
              <th>
                <button
                  onClick={() => setSortField('total_sessions'), setSortOrder(sortField === 'total_sessions' && sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-1 hover:text-primary-600"
                >
                  Số phiên {sortField === 'total_sessions' && (sortOrder === 'asc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />)}
                </button>
              </th>
              <th>
                <button
                  onClick={() => setSortField('total_watch_time'), setSortOrder(sortField === 'total_watch_time' && sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-1 hover:text-primary-600"
                >
                  Thời gian xem {sortField === 'total_watch_time' && (sortOrder === 'asc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />)}
                </button>
              </th>
              <th className="hidden lg:table-cell">
                <button
                  onClick={() => setSortField('churn_risk'), setSortOrder(sortField === 'churn_risk' && sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-1 hover:text-primary-600"
                >
                  Rủi ro rời bỏ {sortField === 'churn_risk' && (sortOrder === 'asc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />)}
                </button>
              </th>
              <th>Hoạt động cuối</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
                </td>
              </tr>
            ) : viewers.viewers.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-dark-500 dark:text-dark-400">
                  Không tìm thấy người xem nào
                </td>
              </tr>
            ) : (
              viewers.viewers.map(viewer => (
                <tr key={viewer.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary-700 dark:text-primary-300" />
                      </div>
                      <div>
                        <p className="font-medium text-dark-900 dark:text-white truncate max-w-xs">{viewer.id}</p>
                        <p className="text-xs text-dark-500 dark:text-dark-400">
                          {viewer.user_id ? `User: ${viewer.user_id}` : `Anonymous: ${viewer.anonymous_id}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{getSegmentBadge(viewer.segment)}</td>
                  <td className="hidden md:table-cell">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {viewer.country} - {viewer.city}
                    </span>
                  </td>
                  <td className="font-mono text-dark-900 dark:text-white">{viewer.total_sessions.toLocaleString('vi-VN')}</td>
                  <td className="font-mono text-dark-900 dark:text-white">{formatWatchTime(viewer.total_watch_time_seconds)}</td>
                  <td className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${viewer.churn_risk_score * 100}%`,
                            backgroundColor: viewer.churn_risk_score > 0.7 ? '#ef4444' : viewer.churn_risk_score > 0.4 ? '#f59e0b' : '#10b981'
                          }} 
                        />
                      </div>
                      <span className="text-sm font-medium text-dark-900 dark:text-white">
                        {(viewer.churn_risk_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-sm text-dark-500 dark:text-dark-400">
                    {formatDistanceToNow(new Date(viewer.last_seen), { addSuffix: true, locale: viLocale })}
                  </td>
                  <td>
                    <button className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500 dark:text-dark-400" title="Xem chi tiết">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && viewers.total_pages > 1 && (
        <div className="card-footer flex items-center justify-between">
          <p className="text-sm text-dark-500 dark:text-dark-400">
            Hiển thị {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, viewers.total)} / {viewers.total} người xem
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="input py-1.5 w-auto"
            >
              {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / trang</option>)}
            </select>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary btn-sm">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm text-dark-700 dark:text-dark-300">Trang {page} / {viewers.total_pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page === viewers.total_pages} className="btn-secondary btn-sm">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SegmentsTab({ segments }: { segments: SegmentStats[] }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-primary-600" />
            Phân khúc người xem
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map(segment => (
              <div key={segment.segment} className="card p-6 border-l-4 border-primary-500">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-dark-900 dark:text-white capitalize">{segment.segment}</h4>
                    <p className="text-sm text-dark-500 dark:text-dark-400">{segment.percentage}% tổng người xem</p>
                  </div>
                  <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{segment.count.toLocaleString('vi-VN')}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-dark-900 dark:text-white">{segment.avg_watch_time}h</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Xem TB</p>
                  </div>
                  <div className="p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-dark-900 dark:text-white">{segment.avg_sessions}</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Phiên TB</p>
                  </div>
                  <div className="p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{(segment.churn_risk * 100).toFixed(0)}%</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Rủi ro rời bỏ</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Segment distribution chart */}
          <div className="mt-8">
            <h4 className="font-medium text-dark-900 dark:text-white mb-4">Phân bố phân khúc</h4>
            <div className="flex items-end gap-4 h-48">
              {segments.map((segment, i) => (
                <div key={segment.segment} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full rounded-t transition-all duration-500"
                    style={{ 
                      height: `${(segment.count / Math.max(...segments.map(s => s.count))) * 100}%`, 
                      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#ef4444', '#6b7280'][i],
                      minHeight: '4px'
                    }}
                  />
                  <span className="text-xs text-dark-500 dark:text-dark-400 mt-2 capitalize">{segment.segment}</span>
                  <span className="text-sm font-medium text-dark-900 dark:text-white">{segment.count.toLocaleString('vi-VN')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CohortsTab({ cohorts }: { cohorts: CohortData[] }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            Phân tích Cohort - Tỷ lệ giữ chân theo tuần
          </h3>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Cohort (Tháng)</th>
                <th className="text-right">Số người xem</th>
                <th>Tuần 0</th>
                <th>Tuần 1</th>
                <th>Tuần 2</th>
                <th>Tuần 3</th>
                <th>Tuần 4</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map(cohort => (
                <tr key={cohort.cohort_month}>
                  <td className="font-medium text-dark-900 dark:text-white">{cohort.cohort_month}</td>
                  <td className="text-right font-mono text-dark-900 dark:text-white">{cohort.viewers.toLocaleString('vi-VN')}</td>
                  {cohort.retention.map((rate, i) => (
                    <td key={i} className={clsx('font-medium', rate >= 50 ? 'text-green-600' : rate >= 30 ? 'text-yellow-600' : 'text-red-600')}>
                      {rate.toFixed(1)}%
                    </td>
                  ))}
                </tr>
               ))}
             </tbody>
            </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-600" />
            Heatmap giữ chân
          </h3>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Cohort</th>
                  {Array.from({ length: 5 }, (_, i) => <th key={i} className="text-center">Tuần {i}</th>)}
                </tr>
              </thead>
              <tbody>
                {cohorts.map(cohort => (
                  <tr key={cohort.cohort_month}>
                    <td className="font-medium text-dark-900 dark:text-white">{cohort.cohort_month}</td>
                    {cohort.retention.map((rate, i) => (
                      <td key={i} className="text-center">
                        <div
                          className="w-16 h-8 mx-auto rounded"
                          style={{
                            backgroundColor: `rgba(${rate >= 50 ? '16, 185, 129' : rate >= 30 ? '245, 158, 11' : '239, 68, 68'}, ${Math.min(rate / 100 + 0.2, 1)})`,
                          }}
                        >
                          <span className="text-xs font-medium text-white block text-center leading-8">{rate.toFixed(1)}%</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
             </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function BehaviorTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary-600" />
            Thiết bị & Nền tảng
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Mobile', value: 55, color: '#3b82f6' },
              { label: 'Desktop', value: 35, color: '#10b981' },
              { label: 'Tablet', value: 8, color: '#f59e0b' },
              { label: 'TV', value: 2, color: '#8b5cf6' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-20 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-dark-700 dark:text-dark-300">{item.label}</span>
                </div>
                <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                </div>
                <span className="w-12 text-right text-sm font-medium text-dark-900 dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Hoạt động theo giờ
          </h3>
          <div className="h-64 flex items-end gap-2">
            {Array.from({ length: 24 }).map((_, h) => {
              const activity = Math.random() * 100
              const peakHours = [19, 20, 21, 22]
              const isPeak = peakHours.includes(h)
              return (
                <div key={h} className="flex-1 flex flex-col items-center" title={`${h}:00 - ${activity.toFixed(0)}%`}>
                  <div 
                    className="w-full rounded-t transition-all duration-300"
                    style={{ 
                      height: `${activity}%`, 
                      backgroundColor: isPeak ? '#f43f5e' : '#3b82f6',
                      minHeight: '4px'
                    }}
                  />
                  <span className="text-xs text-dark-500 dark:text-dark-400 mt-1">{h}:00</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary-600" />
            Danh mục yêu thích
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Gaming', value: 40, color: '#3b82f6' },
              { label: 'Just Chatting', value: 25, color: '#10b981' },
              { label: 'Education', value: 15, color: '#f59e0b' },
              { label: 'Music', value: 10, color: '#f43f5e' },
              { label: 'Sports', value: 10, color: '#8b5cf6' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-24 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-dark-700 dark:text-dark-300">{item.label}</span>
                </div>
                <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                </div>
                <span className="w-12 text-right text-sm font-medium text-dark-900 dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary-600" />
            Chất lượng video ưa thích
          </h3>
          <div className="space-y-3">
            {[
              { label: '1080p', value: 40, color: '#3b82f6' },
              { label: '720p', value: 30, color: '#10b981' },
              { label: '480p', value: 15, color: '#f59e0b' },
              { label: '360p', value: 10, color: '#ef4444' },
              { label: 'Auto', value: 5, color: '#6b7280' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-20 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-dark-700 dark:text-dark-300">{item.label}</span>
                </div>
                <div className="flex-1 h-5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                </div>
                <span className="w-12 text-right text-sm font-medium text-dark-900 dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}