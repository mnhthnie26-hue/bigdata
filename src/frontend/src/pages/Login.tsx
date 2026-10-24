import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Moon, Sun, Loader2, Activity } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
})

type LoginForm = z.infer<typeof loginSchema>

export function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@livestream.com',
      password: 'admin123',
    },
  })

  const onSubmit = async (data: LoginForm) => {
    if (isLoading) return
    setIsLoading(true)
    try {
      await login(data.email, data.password)
      toast.success('Đăng nhập thành công!', { id: 'login-toast' })
      navigate('/dashboard')
    } catch (error: any) {
      const message =
        error.response?.data?.detail ||
        (error.code === 'ERR_NETWORK' || !error.response
          ? 'Không thể kết nối đến máy chủ backend (Port 8000). Vui lòng kiểm tra dịch vụ API.'
          : 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.')
      toast.error(message, { id: 'login-toast' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>

        {/* Theme toggle */}
        <button
          className="absolute top-6 right-6 z-10 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={toggleTheme}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* Brand content */}
        <div className="relative z-10 max-w-md mx-auto w-full text-center">
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Activity className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            Phân tích hành vi người xem
            <br />
            <span className="text-primary-200">Livestream Real-time</span>
          </h1>
          <p className="text-lg text-primary-100 mb-10 max-w-lg mx-auto">
            Hệ thống Big Data theo dõi, phân tích và trực quan hóa hành vi người xem livestream 
            với độ trễ thấp, hỗ trợ ra quyết định dựa trên dữ liệu thời gian thực.
          </p>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 text-white">
            <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
              <div className="w-10 h-10 mx-auto mb-3 bg-white/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <p className="font-medium">Real-time</p>
              <p className="text-sm text-primary-200">Xử lý luồng</p>
            </div>
            <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
              <div className="w-10 h-10 mx-auto mb-3 bg-white/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <p className="font-medium">Big Data</p>
              <p className="text-sm text-primary-200">ClickHouse + Kafka</p>
            </div>
            <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
              <div className="w-10 h-10 mx-auto mb-3 bg-white/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <p className="font-medium">AI Ready</p>
              <p className="text-sm text-primary-200">Dự đoán xu hướng</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-center text-primary-200 text-sm">
          <p>Phiên bản 1.0.0 • Xây dựng với React, TypeScript, TailwindCSS</p>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-10 lg:mb-0">
            <h2 className="text-2xl lg:text-3xl font-bold text-dark-900 dark:text-white mb-2">
              Chào mừng quay lại
            </h2>
            <p className="text-dark-500 dark:text-dark-400">
              Đăng nhập để truy cập dashboard phân tích
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className={clsx('input', errors.email && 'border-red-500 focus:ring-red-500')}
                placeholder="admin@livestream.com"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className={clsx('input pr-12', errors.password && 'border-red-500 focus:ring-red-500')}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-dark-600 dark:text-dark-400">Ghi nhớ đăng nhập</span>
              </label>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
                Quên mật khẩu?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-base"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang đăng nhập...
                </span>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 p-4 bg-dark-50 dark:bg-dark-900 rounded-lg border border-dark-200 dark:border-dark-700">
            <p className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Tài khoản demo:
            </p>
            <div className="space-y-1 text-sm text-dark-600 dark:text-dark-400 font-mono">
              <p>Email: <span className="text-dark-900 dark:text-white">admin@livestream.com</span></p>
              <p>Mật khẩu: <span className="text-dark-900 dark:text-white">admin123</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}