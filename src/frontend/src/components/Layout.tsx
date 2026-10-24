import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  AlertTriangle, 
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  User,
  Activity
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { clsx } from 'clsx'

const navigation = [
  { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Phân tích', href: '/analytics', icon: Activity },
  { name: 'Người xem', href: '/viewers', icon: Users },
  { name: 'Cảnh báo', href: '/alerts', icon: AlertTriangle },
  { name: 'Cài đặt', href: '/settings', icon: Settings },
]

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-dark-900 border-r border-dark-200 dark:border-dark-700 transform transition-transform duration-300 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-dark-200 dark:border-dark-700">
            <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark-900 dark:text-white">StreamAnalytics</h1>
              <p className="text-xs text-dark-500 dark:text-dark-400">Big Data Platform</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const IconComponent = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.href === '/dashboard'}
                  className={({ isActive }) => clsx(
                    'sidebar-link',
                    isActive && 'sidebar-link-active'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <IconComponent className="w-5 h-5 flex-shrink-0" />
                  {item.name}
                </NavLink>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-dark-200 dark:border-dark-700">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <User className="w-4 h-4 text-primary-700 dark:text-primary-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-xs text-dark-500 dark:text-dark-400 capitalize">
                  {user?.role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-dark-900/80 backdrop-blur-sm border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 rounded-lg text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Page title */}
            <div className="flex-1 lg:flex-none">
              <Outlet />
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <div className="relative">
                <button className="p-2 rounded-lg text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>
              </div>

              {/* Theme toggle */}
              <button
                className="p-2 rounded-lg text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-700 dark:text-primary-300" />
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-dark-700 dark:text-dark-300">
                    {user?.full_name?.split(' ')[0] || user?.username}
                  </span>
                  <ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400 hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <div className="dropdown">
                    <div className="px-4 py-2 border-b border-dark-200 dark:border-dark-700">
                      <p className="text-sm font-medium text-dark-900 dark:text-white">
                        {user?.full_name}
                      </p>
                      <p className="text-xs text-dark-500 dark:text-dark-400">
                        {user?.email}
                      </p>
                    </div>
                    <button className="dropdown-item w-full text-left">
                      <User className="w-4 h-4" />
                      Hồ sơ cá nhân
                    </button>
                    <button className="dropdown-item w-full text-left">
                      <Settings className="w-4 h-4" />
                      Cài đặt
                    </button>
                    <hr className="my-1 border-dark-200 dark:border-dark-700" />
                    <button className="dropdown-item w-full text-left text-red-600 dark:text-red-400" onClick={handleLogout}>
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}