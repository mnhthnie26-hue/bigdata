import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../lib/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  login: (email?: string, password?: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>({
    id: '1',
    email: 'admin@livestream.com',
    username: 'admin',
    full_name: 'Demo Admin',
    avatar_url: undefined,
    role: 'admin',
    is_active: true,
    email_verified: true,
    last_login: undefined,
    created_at: '',
    updated_at: ''
  } as User)
  const [loading] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      localStorage.setItem('access_token', 'demo_token_123')
    }
    if (!localStorage.getItem('token')) {
      localStorage.setItem('token', 'demo_token_123')
    }
    api.defaults.headers.common['Authorization'] = 'Bearer demo_token_123'
  }, [])

  const refreshUser = async () => {
    setUser({
      id: '1',
      email: 'admin@livestream.com',
      username: 'admin',
      full_name: 'Demo Admin',
      avatar_url: undefined,
      role: 'admin',
      is_active: true,
      email_verified: true,
      last_login: undefined,
      created_at: '',
      updated_at: ''
    } as User)
  }

  const login = async () => {
    localStorage.setItem('access_token', 'demo_token_123')
    localStorage.setItem('token', 'demo_token_123')
    api.defaults.headers.common['Authorization'] = 'Bearer demo_token_123'
    setUser({
      id: '1',
      email: 'admin@livestream.com',
      username: 'admin',
      full_name: 'Demo Admin',
      avatar_url: undefined,
      role: 'admin',
      is_active: true,
      email_verified: true,
      last_login: undefined,
      created_at: '',
      updated_at: ''
    } as User)
  }

  const logout = () => {
    setUser({
      id: '1',
      email: 'admin@livestream.com',
      username: 'admin',
      full_name: 'Demo Admin',
      avatar_url: undefined,
      role: 'admin',
      is_active: true,
      email_verified: true,
      last_login: undefined,
      created_at: '',
      updated_at: ''
    } as User)
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: true,
      loading,
      login,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}