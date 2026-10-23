import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Bell, 
  Database, 
  Globe, 
  Palette,
  Moon,
  Sun,
  Save,
  RefreshCw,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Info,
  Download,
  Upload,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Key,
  Link,
  Server,
  Code,
  FileText
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../lib/api'
import { clsx } from 'clsx'

export function Settings() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<'general' | 'profile' | 'notifications' | 'security' | 'database' | 'api' | 'system'>('general')
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  const tabs = [
    { id: 'general', label: 'Cài đặt chung', icon: SettingsIcon },
    { id: 'profile', label: 'Hồ sơ', icon: User },
    { id: 'notifications', label: 'Thông báo', icon: Bell },
    { id: 'security', label: 'Bảo mật', icon: Shield },
    { id: 'database', label: 'Cơ sở dữ liệu', icon: Database },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'system', label: 'Hệ thống', icon: Server },
  ]

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Cài đặt</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Quản lý cấu hình hệ thống và tài khoản người dùng
          </p>
        </div>
        <button onClick={() => setShowSaveConfirm(true)} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          Lưu thay đổi
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card sticky top-24">
            <div className="card-body p-3">
              <nav className="space-y-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800'
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'general' && <GeneralSettings theme={theme} toggleTheme={toggleTheme} />}
          {activeTab === 'profile' && <ProfileSettings user={user} />}
          {activeTab === 'notifications' && <NotificationsSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'database' && <DatabaseSettings />}
          {activeTab === 'api' && <ApiSettings />}
          {activeTab === 'system' && <SystemSettings />}
        </div>
      </div>

      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-dark-900 rounded-xl w-full max-w-md animate-slide-up">
            <div className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">Lưu thay đổi?</h3>
              <p className="text-dark-500 dark:text-dark-400">Bạn có chắc chắn muốn lưu các thay đổi đã thực hiện không?</p>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button onClick={() => setShowSaveConfirm(false)} className="btn-secondary">Hủy</button>
              <button onClick={() => { setShowSaveConfirm(false); /* Save logic */ }} className="btn-primary">Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== GENERAL SETTINGS ====================

function GeneralSettings({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Cài đặt chung</h3>
      </div>
      <div className="card-body space-y-6">
        {/* Theme */}
        <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            {theme === 'light' ? <Sun className="w-5 h-5 text-yellow-600" /> : <Moon className="w-5 h-5 text-blue-600" />}
            <div>
              <p className="font-medium text-dark-900 dark:text-white">Giao diện</p>
              <p className="text-sm text-dark-500 dark:text-dark-400">Chọn chế độ sáng hoặc tối</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} className="sr-only peer" />
            <div className="w-11 h-6 bg-dark-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-dark-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-dark-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-dark-600 peer-checked:bg-primary-600" />
          </label>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="label">Ngôn ngữ</label>
          <select className="input max-w-xs">
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <label className="label">Múi giờ</label>
          <select className="input max-w-xs">
            <option value="Asia/Ho_Chi_Minh">(GMT+7) Hồ Chí Minh</option>
            <option value="Asia/Bangkok">(GMT+7) Bangkok</option>
            <option value="UTC">(GMT+0) UTC</option>
          </select>
        </div>

        {/* Date Format */}
        <div className="space-y-2">
          <label className="label">Định dạng ngày</label>
          <select className="input max-w-xs">
            <option value="dd/MM/yyyy">DD/MM/YYYY</option>
            <option value="MM/dd/yyyy">MM/DD/YYYY</option>
            <option value="yyyy-MM-dd">YYYY-MM-DD</option>
          </select>
        </div>

        {/* Refresh Interval */}
        <div className="space-y-2">
          <label className="label">Khoảng thời gian cập nhật real-time (giây)</label>
          <input type="number" className="input max-w-xs" defaultValue={10} min={5} max={60} />
          <p className="text-xs text-dark-500 dark:text-dark-400">Từ 5-60 giây</p>
        </div>
      </div>
    </div>
  )
}

// ==================== PROFILE SETTINGS ====================

function ProfileSettings({ user }: { user: any }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Hồ sơ cá nhân</h3>
      </div>
      <div className="card-body space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <User className="w-10 h-10 text-primary-700 dark:text-primary-300" />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Tải lên avatar
            </button>
            <button className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Xóa</button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="label">Họ và tên</label>
            <input type="text" className="input" defaultValue={user?.full_name || 'Administrator'} />
          </div>
          <div className="space-y-2">
            <label className="label">Tên đăng nhập</label>
            <input type="text" className="input" defaultValue={user?.username || 'admin'} />
          </div>
          <div className="space-y-2">
            <label className="label">Email</label>
            <input type="email" className="input" defaultValue={user?.email || 'admin@livestream.local'} />
          </div>
          <div className="space-y-2">
            <label className="label">Số điện thoại</label>
            <input type="tel" className="input" placeholder="Nhập số điện thoại" />
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="label">Giới thiệu</label>
          <textarea className="input" rows={4} placeholder="Viết vài dòng giới thiệu về bạn..." />
        </div>

        {/* Company Info */}
        <div className="space-y-2">
          <label className="label">Công ty</label>
          <input type="text" className="input max-w-md" placeholder="Tên công ty" />
        </div>
      </div>
    </div>
  )
}

// ==================== NOTIFICATIONS SETTINGS ====================

function NotificationsSettings() {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Cài đặt thông báo</h3>
      </div>
      <div className="card-body space-y-6">
        {/* Email Notifications */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary-600" />
            Thông báo qua email
          </h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm text-dark-700 dark:text-dark-300">Cảnh báo quan trọng</span>
                <p className="text-xs text-dark-500 dark:text-dark-400">Nhận email khi có cảnh báo critical</p>
              </div>
              <input type="checkbox" className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500" defaultChecked />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm text-dark-700 dark:text-dark-300">Cảnh báo warning</span>
                <p className="text-xs text-dark-500 dark:text-dark-400">Nhận email khi có cảnh báo warning</p>
              </div>
              <input type="checkbox" className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm text-dark-700 dark:text-dark-300">Báo cáo hàng ngày</span>
                <p className="text-xs text-dark-500 dark:text-dark-400">Nhận báo cáo tóm tắt hàng ngày</p>
              </div>
              <input type="checkbox" className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500" defaultChecked />
            </label>
          </div>
        </div>

        {/* In-App Notifications */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary-600" />
            Thông báo trong ứng dụng
          </h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm text-dark-700 dark:text-dark-300">Tất cả cảnh báo</span>
                <p className="text-xs text-dark-500 dark:text-dark-400">Hiển thị thông báo khi có cảnh báo mới</p>
              </div>
              <input type="checkbox" className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500" defaultChecked />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm text-dark-700 dark:text-dark-300">Thông báo hệ thống</span>
                <p className="text-xs text-dark-500 dark:text-dark-400">Thông báo cập nhật, bảo trì hệ thống</p>
              </div>
              <input type="checkbox" className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500" defaultChecked />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== SECURITY SETTINGS ====================

function SecuritySettings() {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Cài đặt bảo mật</h3>
      </div>
      <div className="card-body space-y-6">
        {/* Password Change */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4">Đổi mật khẩu</h4>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="label">Mật khẩu hiện tại</label>
              <div className="relative max-w-md">
                <input type={showPassword ? 'text' : 'password'} className="input pr-12" placeholder="Nhập mật khẩu hiện tại" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="label">Mật khẩu mới</label>
              <input type="password" className="input max-w-md" placeholder="Nhập mật khẩu mới" />
            </div>
            <div className="space-y-2">
              <label className="label">Xác nhận mật khẩu mới</label>
              <input type="password" className="input max-w-md" placeholder="Xác nhận mật khẩu mới" />
            </div>
            <button className="btn-primary mt-2">Cập nhật mật khẩu</button>
          </div>
        </div>

        {/* 2FA */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary-600" />
            Xác thực hai yếu tố (2FA)
          </h4>
          <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">Bật 2FA để bảo vệ tài khoản khỏi truy cập trái phép</p>
          <button className="btn-secondary flex items-center gap-2">
            <Key className="w-4 h-4" />
            Bật 2FA
          </button>
        </div>

        {/* Sessions */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3">Phiên đăng nhập</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
              <div>
                <p className="font-medium text-dark-900 dark:text-white">Phiên hiện tại</p>
                <p className="text-sm text-dark-500 dark:text-dark-400">Windows • Chrome • Việt Nam</p>
                <p className="text-xs text-dark-500 dark:text-dark-400">Đăng nhập: hôm nay lúc 08:30</p>
              </div>
              <span className="badge-success">Đang hoạt động</span>
            </div>
            <button className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Đăng xuất tất cả phiên khác</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== DATABASE SETTINGS ====================

function DatabaseSettings() {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Cấu hình cơ sở dữ liệu</h3>
      </div>
      <div className="card-body space-y-6">
        {/* ClickHouse */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary-600" />
            ClickHouse
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="label">Host</label>
              <input type="text" className="input" defaultValue="localhost" />
            </div>
            <div className="space-y-2">
              <label className="label">Port</label>
              <input type="number" className="input" defaultValue={9000} />
            </div>
            <div className="space-y-2">
              <label className="label">Database</label>
              <input type="text" className="input" defaultValue="livestream_analytics" />
            </div>
            <div className="space-y-2">
              <label className="label">Username</label>
              <input type="text" className="input" defaultValue="analytics" />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="label">Password</label>
              <input type="password" className="input" defaultValue="analytics_password" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-secondary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Kiểm tra kết nối
            </button>
            <span className="badge-success flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Đã kết nối
            </span>
          </div>
        </div>

        {/* PostgreSQL */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary-600" />
            PostgreSQL
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="label">Host</label>
              <input type="text" className="input" defaultValue="localhost" />
            </div>
            <div className="space-y-2">
              <label className="label">Port</label>
              <input type="number" className="input" defaultValue={5432} />
            </div>
            <div className="space-y-2">
              <label className="label">Database</label>
              <input type="text" className="input" defaultValue="livestream_analytics" />
            </div>
            <div className="space-y-2">
              <label className="label">Username</label>
              <input type="text" className="input" defaultValue="analytics" />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="label">Password</label>
              <input type="password" className="input" defaultValue="analytics_password" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-secondary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Kiểm tra kết nối
            </button>
            <span className="badge-success flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Đã kết nối
            </span>
          </div>
        </div>

        {/* Redis */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary-600" />
            Redis
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="label">Host</label>
              <input type="text" className="input" defaultValue="localhost" />
            </div>
            <div className="space-y-2">
              <label className="label">Port</label>
              <input type="number" className="input" defaultValue={6379} />
            </div>
            <div className="space-y-2">
              <label className="label">Database</label>
              <input type="number" className="input" defaultValue={0} />
            </div>
            <div className="space-y-2">
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="Để trống nếu không có" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-secondary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Kiểm tra kết nối
            </button>
            <span className="badge-success flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Đã kết nối
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== API SETTINGS ====================

function ApiSettings() {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Quản lý API Keys</h3>
      </div>
      <div className="card-body space-y-6">
        {/* Create API Key */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4">Tạo API Key mới</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="label">Tên API Key</label>
              <input type="text" className="input" placeholder="VD: Integration Service" />
            </div>
            <div className="space-y-2">
              <label className="label">Quyền hạn</label>
              <select className="input">
                <option value="read">Chỉ đọc</option>
                <option value="write">Đọc/Viết</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <label className="label">Ngày hết hạn</label>
              <input type="date" className="input max-w-xs" />
            </div>
          </div>
          <button className="btn-primary mt-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Tạo API Key
          </button>
        </div>

        {/* API Keys List */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4">Danh sách API Keys</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-dark-900 dark:text-white">Analytics Dashboard</p>
                <p className="text-sm text-dark-500 dark:text-dark-400 font-mono">ls_ak_...x9f3</p>
                <div className="flex gap-3 mt-1 text-xs text-dark-500 dark:text-dark-400">
                  <span>Quyền hạn: <span className="text-green-600">Đọc/Viết</span></span>
                  <span>Tạo: 2024-01-15</span>
                  <span>Hết hạn: 2024-12-31</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500" title="Sao chép">
                  <Copy className="w-4 h-4" />
                </button>
                <button className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-red-600" title="Xóa">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-800/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-dark-900 dark:text-white">Data Collector</p>
                <p className="text-sm text-dark-500 dark:text-dark-400 font-mono">ls_ak_...a7b2</p>
                <div className="flex gap-3 mt-1 text-xs text-dark-500 dark:text-dark-400">
                  <span>Quyền hạn: <span className="text-green-600">Đọc/Viết</span></span>
                  <span>Tạo: 2024-01-10</span>
                  <span>Hết hạn: Không</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500" title="Sao chép">
                  <Copy className="w-4 h-4" />
                </button>
                <button className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-red-600" title="Xóa">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* API Documentation */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3 flex items-center gap-2">
            <Code className="w-4 h-4 text-primary-600" />
            API Documentation
          </h4>
          <p className="text-sm text-dark-500 dark:text-dark-400 mb-3">Xem API documentation để biết cách sử dụng</p>
          <button className="btn-secondary flex items-center gap-2">
            <Link className="w-4 h-4" />
            Mở API Docs
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== SYSTEM SETTINGS ====================

function SystemSettings() {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Cài đặt hệ thống</h3>
      </div>
      <div className="card-body space-y-6">
        {/* System Info */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4">Thông tin hệ thống</h4>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-dark-500 dark:text-dark-400">Phiên bản</dt>
              <dd className="font-medium text-dark-900 dark:text-white">v1.0.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-500 dark:text-dark-400">Build Time</dt>
              <dd className="font-medium text-dark-900 dark:text-white">2024-01-15 10:30</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-500 dark:text-dark-400">Environment</dt>
              <dd className="font-medium text-dark-900 dark:text-white">Development</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-500 dark:text-dark-400">Uptime</dt>
              <dd className="font-medium text-dark-900 dark:text-white">5 ngày 12 giờ</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-500 dark:text-dark-400">Memory</dt>
              <dd className="font-medium text-dark-900 dark:text-white">2.1 GB / 8.0 GB</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-500 dark:text-dark-400">CPU</dt>
              <dd className="font-medium text-dark-900 dark:text-white">25.3%</dd>
            </div>
          </dl>
        </div>

        {/* Logs */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-600" />
            Nhật ký hệ thống
          </h4>
          <p className="text-sm text-dark-500 dark:text-dark-400 mb-3">Tải xuống và xem nhật ký hệ thống</p>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Tải logs hôm nay
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Tải tất cả logs
            </button>
          </div>
        </div>

        {/* Maintenance */}
        <div className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
          <h4 className="font-medium text-dark-900 dark:text-white mb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-primary-600" />
            Bảo trì hệ thống
          </h4>
          <div className="space-y-3">
            <button className="btn-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Restart API Server
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Restart Processing Jobs
            </button>
            <button className="btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 className="w-4 h-4" />
              Xóa cache
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}