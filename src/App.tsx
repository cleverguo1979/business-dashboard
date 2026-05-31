import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/Layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { OverviewPage } from './pages/OverviewPage'
import { ImportPage } from './pages/ImportPage'
import { DataManagementPage } from './pages/DataManagementPage'
import './App.css'

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/data" element={<DataManagementPage />} />
      </Routes>
    </AppLayout>
  )
}

export default App
