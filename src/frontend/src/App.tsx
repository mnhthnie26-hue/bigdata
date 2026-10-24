import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { StreamDetail } from './pages/StreamDetail'
import { Analytics } from './pages/Analytics'
import { Viewers } from './pages/Viewers'
import { Alerts } from './pages/Alerts'
import { Settings } from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/streams/:streamId" element={<StreamDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/viewers" element={<Viewers />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App