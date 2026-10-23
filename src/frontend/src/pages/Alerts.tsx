import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  AlertTriangle, 
  Bell, 
  CheckCircle, 
  XCircle, 
  Filter, 
  ChevronDown,
  RefreshCw,
  Clock,
  Eye,
  Trash2,
  Settings,
  Plus,
  Search,
  Download
} from 'lucide-react'
import type { Alert, AlertRule, AlertType, AlertSeverity } from '../types'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale/vi'

const mockAlerts: Alert[] = [
  { id: '1', stream_id: '1', alert_type: 'high_buffer', severity: 'warning', title: 'Tỷ lệ buffer cao', message: 'Stream Gaming: Valorant Ranked có tỷ lệ buffer 15% (ngưỡng: 10%)', metadata: { buffer_ratio: 0.15, threshold: 0.1 }, is_resolved: false, created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { id: '2', stream_id: '2', alert_type: 'high_errors', severity: 'critical', title: 'Tỷ lệ lỗi cao', message: 'Stream Chatting & Q&A có tỷ lệ lỗi 8% (ngưỡng: 5%)', metadata: { error_rate: 0.08, threshold: 0.05 }, is_resolved: false, created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  { id: '3', stream_id: '1', alert_type: 'low_viewers', severity: 'info', title: 'Người xem thấp', message: 'Stream Gaming: Valorant Ranked chỉ còn 50 người xem', metadata: { current_viewers: 50, threshold: 100 }, is_resolved: true, resolved_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), resolved_by: 'admin', created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { id: '4', stream_id: '3', alert_type: 'quality_drop', severity: 'warning', title: 'Chất lượng video giảm', message: 'Stream React Tutorial giảm chất lượng từ 1080p xuống 720p', metadata: { from_quality: '1080p', to_quality: '720p' }, is_resolved: false, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: '5', stream_id: '4', alert_type: 'viewer_drop', severity: 'critical', title: 'Giảm đột ngột người xem', message: 'Stream Music Production Live giảm 60% người xem trong 5 phút', metadata: { previous_viewers: 500, current_viewers: 200, drop_percent: 60 }, is_resolved: false, created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
]

const mockAlertRules: AlertRule[] = [
  { id: '1', name: 'Cảnh báo buffer cao', description: 'Kích hoạt khi tỷ lệ buffer vượt 10%', alert_type: 'high_buffer', severity: 'warning', condition: { metric: 'buffer_ratio', operator: '>', threshold: 0.1 }, threshold: 0.1, window_minutes: 5, is_enabled: true, created_by: 'admin', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: '2', name: 'Cảnh báo lỗi cao', description: 'Kích hoạt khi tỷ lệ lỗi vượt 5%', alert_type: 'high_errors', severity: 'critical', condition: { metric: 'error_rate', operator: '>', threshold: 0.05 }, threshold: 0.05, window_minutes: 5, is_enabled: true, created_by: 'admin', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: '3', name: 'Cảnh báo người xem thấp', description: 'Kích hoạt khi người xem đồng thời dưới 100', alert_type: 'low_viewers', severity: 'info', condition: { metric: 'concurrent_viewers', operator: '<', threshold: 100 }, threshold: 100, window_minutes: 10, is_enabled: true, created_by: 'admin', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
]

const alertTypes: AlertType[] = ['low_viewers', 'high_buffer', 'high_errors', 'quality_drop', 'viewer_drop', 'stream_offline', 'high_latency', 'cdn_issue']
const severities: AlertSeverity[] = ['info', 'warning', 'critical']

const getSeverityConfig = (severity: AlertSeverity) => {
  const configs: Record<AlertSeverity, { class: string; icon: any; color: string }> = {
    info: { class: 'badge-info', icon: <Bell className="w-3 h-3" />, color: 'text-blue-600' },
    warning: { class: 'badge-warning', icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-600' },
    critical: { class: 'badge-danger', icon: <XCircle className="w-3 h-3" />, color: 'text-red-600' },
  }
  return configs[severity]
}

const getTypeLabel = (type: AlertType) => {
  const labels: Record<AlertType, string> = {
    low_viewers: 'Người xem thấp',
    high_buffer: 'Buffer cao',
    high_errors: 'Lỗi cao',
    quality_drop: 'Giảm chất lượng',
    viewer_drop: 'Giảm người xem',
    stream_offline: 'Mất kết nối',
    high_latency: 'Độ trễ cao',
    cdn_issue: 'Vấn đề CDN',
  }
  return labels[type]
}

export function Alerts() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AlertType | null>(null)
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | null>(null)
  const [resolvedFilter, setResolvedFilter] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules' | 'summary'>('alerts')
  const [showCreateRule, setShowCreateRule] = useState(false)

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', page, pageSize, search, typeFilter, severityFilter, resolvedFilter],
    queryFn: async () => {
      let filtered = [...mockAlerts]
      
      if (search) {
        filtered = filtered.filter(a => 
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.message.toLowerCase().includes(search.toLowerCase()) ||
          a.stream_id.toLowerCase().includes(search.toLowerCase())
        )
      }
      if (typeFilter) filtered = filtered.filter(a => a.alert_type === typeFilter)
      if (severityFilter) filtered = filtered.filter(a => a.severity === severityFilter)
      if (resolvedFilter !== null) filtered = filtered.filter(a => a.is_resolved === resolvedFilter)
      
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      const start = (page - 1) * pageSize
      return {
        alerts: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        page_size: pageSize,
        total_pages: Math.ceil(filtered.length / pageSize)
      }
    },
    placeholderData: { alerts: [], total: 0, page: 1, page_size: 20, total_pages: 1 },
  })

  const handleResolve = (alertId: string) => {
    const alert = mockAlerts.find(a => a.id === alertId)
    if (alert) {
      alert.is_resolved = true
      alert.resolved_at = new Date().toISOString()
      alert.resolved_by = 'current_user'
    }
  }

  const handleUnresolve = (alertId: string) => {
    const alert = mockAlerts.find(a => a.id === alertId)
    if (alert) {
      alert.is_resolved = false
      alert.resolved_at = undefined
      alert.resolved_by = undefined
    }
  }

  const tabs = [
    { id: 'alerts', label: 'Cảnh báo', icon: Bell, count: alertsData?.total || 0 },
    { id: 'rules', label: 'Quy tắc', icon: Settings, count: mockAlertRules.length },
    { id: 'summary', label: 'Tóm tắt', icon: AlertTriangle, count: 0 },
  ]

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Quản lý cảnh báo</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Theo dõi, quản lý và cấu hình cảnh báo real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'rules' && (
            <button onClick={() => setShowCreateRule(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Tạo quy tắc mới
            </button>
          )}
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Xuất báo cáo
          </button>
          <button className="btn-secondary" onClick={() => {}}>
            <RefreshCw className="w-4 h-4" />
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
            {tab.count > 0 && <span className={clsx('badge', activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300')}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'alerts' && (
        <AlertsTab 
          alerts={alertsData} 
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          resolvedFilter={resolvedFilter}
          setResolvedFilter={setResolvedFilter}
          page={page}
          setPage={setPage}
          handleResolve={handleResolve}
          handleUnresolve={handleUnresolve}
        />
      )}

      {activeTab === 'rules' && (
        <RulesTab 
          rules={mockAlertRules}
          showCreateRule={showCreateRule}
          setShowCreateRule={setShowCreateRule}
        />
      )}

      {activeTab === 'summary' && (
        <SummaryTab />
      )}
    </div>
  )
}

// ==================== ALERTS TAB ====================

function AlertsTab({ 
  alerts, search, setSearch, typeFilter, setTypeFilter,
  severityFilter, setSeverityFilter, resolvedFilter, setResolvedFilter,
  page, setPage, handleResolve, handleUnresolve
}: any) {
  return (
    <div className="card">
      {/* Filters */}
      <div className="card-header flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm cảnh báo..."
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <select value={typeFilter || ''} onChange={(e) => setTypeFilter(e.target.value || null)} className="input py-1.5 pr-8">
            <option value="">Tất cả loại</option>
            {alertTypes.map(t => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
          </select>
          <select value={severityFilter || ''} onChange={(e) => setSeverityFilter(e.target.value || null)} className="input py-1.5 pr-8">
            <option value="">Tất cả mức độ</option>
            {severities.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={resolvedFilter === null ? '' : String(resolvedFilter)} onChange={(e) => setResolvedFilter(e.target.value === '' ? null : e.target.value === 'true')} className="input py-1.5 pr-8">
            <option value="">Tất cả trạng thái</option>
            <option value="false">Chưa giải quyết</option>
            <option value="true">Đã giải quyết</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Mức độ</th>
              <th>Loại</th>
              <th>Livestream</th>
              <th>Tiêu đề</th>
              <th className="hidden md:table-cell">Chi tiết</th>
              <th>Trạng thái</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {alerts?.alerts?.map((alert: any) => {
              const severityConfig = getSeverityConfig(alert.severity)
              return (
                <tr key={alert.id} className={alert.is_resolved ? 'opacity-60' : ''}>
                  <td className="text-sm text-dark-500 dark:text-dark-400 whitespace-nowrap">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: viLocale })}
                  </td>
                  <td>
                    <span className={clsx('badge flex items-center gap-1', severityConfig.class)}>
                      {severityConfig.icon}
                      {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                    </span>
                  </td>
                  <td>
                    <span className="badge-primary">{getTypeLabel(alert.alert_type)}</span>
                  </td>
                  <td className="font-mono text-sm text-dark-900 dark:text-white">{alert.stream_id}</td>
                  <td className="max-w-md">
                    <p className="font-medium text-dark-900 dark:text-white truncate">{alert.title}</p>
                    <p className="text-sm text-dark-500 dark:text-dark-400 truncate">{alert.message}</p>
                  </td>
                  <td className="hidden md:table-cell text-sm text-dark-500 dark:text-dark-400 font-mono">
                    {JSON.stringify(alert.metadata)}
                  </td>
                  <td>
                    <span className={clsx('badge flex items-center gap-1', alert.is_resolved ? 'badge-success' : 'badge-warning')}>
                      {alert.is_resolved ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3 animate-pulse" />}
                      {alert.is_resolved ? 'Đã giải quyết' : 'Đang xử lý'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {!alert.is_resolved && (
                        <button onClick={() => handleResolve(alert.id)} className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400" title="Đánh dấu đã giải quyết">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {alert.is_resolved && (
                        <button onClick={() => handleUnresolve(alert.id)} className="p-1.5 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400" title="Mở lại">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500 dark:text-dark-400" title="Xem chi tiết">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {alerts && alerts.total_pages > 1 && (
        <div className="card-footer flex items-center justify-between">
          <p className="text-sm text-dark-500 dark:text-dark-400">
            Hiển thị {(page - 1) * (alerts.page_size || 20) + 1} - {Math.min(page * (alerts.page_size || 20), alerts.total)} / {alerts.total} cảnh báo
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p: number) => p - 1)} disabled={page === 1} className="btn-secondary btn-sm">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            <span className="px-3 text-sm text-dark-700 dark:text-dark-300">Trang {page} / {alerts.total_pages}</span>
            <button onClick={() => setPage((p: number) => p + 1)} disabled={page === alerts.total_pages} className="btn-secondary btn-sm">
              <ChevronDown className="w-4 h-4 rotate-270" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== RULES TAB ====================

function RulesTab({ rules, showCreateRule, setShowCreateRule }: any) {
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)

  return (
    <div className="space-y-6">
      {rules.map(rule => (
        <div key={rule.id} className="card">
          <div className="card-body">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-dark-900 dark:text-white">{rule.name}</h3>
                  <span className={clsx('badge', rule.is_enabled ? 'badge-success' : 'badge')}>
                    {rule.is_enabled ? 'Đang bật' : 'Đã tắt'}
                  </span>
                  <span className={clsx('badge', rule.severity === 'critical' ? 'badge-danger' : rule.severity === 'warning' ? 'badge-warning' : 'badge-info')}>
                    {rule.severity.charAt(0).toUpperCase() + rule.severity.slice(1)}
                  </span>
                </div>
                <p className="text-dark-500 dark:text-dark-400 text-sm mb-3">{rule.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-dark-600 dark:text-dark-400">
                  <span className="flex items-center gap-1"><Filter className="w-4 h-4" /> Loại: {getTypeLabel(rule.alert_type)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Cửa sổ: {rule.window_minutes} phút</span>
                  <span className="flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Ngưỡng: {typeof rule.threshold === 'number' ? (rule.threshold < 1 ? `${(rule.threshold * 100).toFixed(0)}%` : rule.threshold.toLocaleString('vi-VN')) : rule.threshold}</span>
                  <span className="flex items-center gap-1"><Settings className="w-4 h-4" /> Điều kiện: {rule.condition.metric} {rule.condition.operator} {rule.condition.threshold}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:ml-auto">
                <button onClick={() => setEditingRule(rule)} className="btn-secondary btn-sm">Sửa</button>
                <button className="btn-secondary btn-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Create/Edit Rule Modal */}
      {(showCreateRule || editingRule) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-dark-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                {editingRule ? 'Chỉnh sửa quy tắc' : 'Tạo quy tắc cảnh báo mới'}
              </h3>
              <button onClick={() => { setShowCreateRule(false); setEditingRule(null) }} className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-800">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Tên quy tắc</label>
                <input type="text" className="input" placeholder="VD: Cảnh báo buffer cao" defaultValue={editingRule?.name} />
              </div>
              <div>
                <label className="label">Mô tả</label>
                <textarea className="input" rows={3} placeholder="Mô tả chi tiết quy tắc..." defaultValue={editingRule?.description} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Loại cảnh báo</label>
                  <select className="input" defaultValue={editingRule?.alert_type}>
                    {alertTypes.map(t => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Mức độ</label>
                  <select className="input" defaultValue={editingRule?.severity}>
                    {severities.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Cửa sổ thời gian (phút)</label>
                  <input type="number" className="input" min="1" max="1440" defaultValue={editingRule?.window_minutes || 5} />
                </div>
                <div>
                  <label className="label">Ngưỡng</label>
                  <input type="text" className="input" placeholder="VD: 0.1 hoặc 100" defaultValue={editingRule?.threshold} />
                </div>
              </div>
              <div>
                <label className="label">Điều kiện</label>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input w-auto" defaultValue={editingRule?.condition.metric}>
                    <option value="buffer_ratio">Tỷ lệ buffer</option>
                    <option value="error_rate">Tỷ lệ lỗi</option>
                    <option value="concurrent_viewers">Người xem đồng thời</option>
                    <option value="avg_bitrate">Bitrate trung bình</option>
                    <option value="avg_buffer_health">Buffer health</option>
                  </select>
                  <select className="input w-auto" defaultValue={editingRule?.condition.operator}>
                    <option value=">">Lớn hơn</option>
                    <option value="<">Nhỏ hơn</option>
                    <option value=">=">Lớn hơn hoặc bằng</option>
                    <option value="<=">Nhỏ hơn hoặc bằng</option>
                    <option value="==">Bằng</option>
                  </select>
                  <input type="text" className="input w-auto" placeholder="Giá trị" defaultValue={editingRule?.condition.threshold} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500" defaultChecked={editingRule?.is_enabled !== false} />
                  <span className="text-sm text-dark-700 dark:text-dark-300">Kích hoạt quy tắc này</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-dark-200 dark:border-dark-700">
                <button onClick={() => { setShowCreateRule(false); setEditingRule(null) }} className="btn-secondary">Hủy</button>
                <button className="btn-primary">{editingRule ? 'Cập nhật' : 'Tạo quy tắc'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== SUMMARY TAB ====================

function SummaryTab() {
  const severityData = { info: 12, warning: 8, critical: 3 }
  const typeData = { high_buffer: 5, high_errors: 3, low_viewers: 4, quality_drop: 2, viewer_drop: 2, stream_offline: 1, high_latency: 1, cdn_issue: 0 }
  const timelineData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    total: Math.floor(Math.random() * 10),
    active: Math.floor(Math.random() * 5),
    critical: Math.floor(Math.random() * 2),
  }))

  return (
    <div className="space-y-6">
      {/* Severity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(severityData).map(([severity, count]) => {
          const config = getSeverityConfig(severity as AlertSeverity)
          return (
            <div key={severity} className="card p-6 text-center border-l-4" style={{ borderColor: config.color.replace('text-', '') }}>
              <config.icon className={clsx('w-8 h-8 mx-auto mb-2', config.color)} />
              <p className="text-3xl font-bold text-dark-900 dark:text-white">{count}</p>
              <p className="text-dark-500 dark:text-dark-400 capitalize">{severity}</p>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Cảnh báo theo loại</h3>
          <div className="space-y-3 h-64">
            {Object.entries(typeData).map(([type, count], i) => {
              const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#f43f5e', '#8b5cf6', '#ec4899', '#6b7280']
              const maxCount = Math.max(...Object.values(typeData))
              const width = (count / maxCount) * 100
              return (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-dark-700 dark:text-dark-300 truncate">{getTypeLabel(type as AlertType)}</div>
                  <div className="flex-1 h-6 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: colors[i] }} />
                  </div>
                  <span className="w-12 text-right text-sm font-medium text-dark-900 dark:text-white">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Timeline 24h</h3>
          <div className="h-64 flex items-end gap-1">
            {timelineData.map((data, i) => (
              <div key={i} className="flex-1 flex flex-col items-center" title={`${data.hour} - ${data.total} alerts`}>
                <div 
                  className="w-full rounded-t transition-all duration-300"
                  style={{ 
                    height: `${Math.max((data.total / 10) * 100, 4)}%`, 
                    backgroundColor: data.critical > 0 ? '#ef4444' : data.active > 0 ? '#f59e0b' : '#3b82f6',
                    minHeight: '4px'
                  }}
                />
                <span className="text-xs text-dark-500 dark:text-dark-400 mt-1">{data.hour}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top streams with alerts */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Top livestream có nhiều cảnh báo</h3>
        <div className="space-y-3">
          {[
            { stream: 'Gaming: Valorant Ranked', alerts: 12, critical: 2, active: 3 },
            { stream: 'Chatting & Q&A', alerts: 8, critical: 1, active: 2 },
            { stream: 'React Tutorial', alerts: 5, critical: 0, active: 1 },
            { stream: 'Music Production Live', alerts: 4, critical: 1, active: 2 },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
              <span className="w-8 text-center font-bold text-dark-500 dark:text-dark-400">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-dark-900 dark:text-white truncate">{item.stream}</p>
                <div className="flex items-center gap-4 text-sm text-dark-500 dark:text-dark-400">
                  <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-500" /> {item.alerts} cảnh báo</span>
                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> {item.critical} critical</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500" /> {item.active} đang xử lý</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}