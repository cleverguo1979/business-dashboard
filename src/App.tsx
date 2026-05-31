import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/Layout/AppLayout'
import { LoginPage } from './components/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { OverviewPage } from './pages/OverviewPage'
import { ImportPage } from './pages/ImportPage'
import { DataManagementPage } from './pages/DataManagementPage'
import './App.css'

function App() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('dashboard_auth') === '1') setAuthed(true);
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('dashboard_auth', '1');
    setAuthed(true);
  };

  if (!authed) return <LoginPage onSuccess={handleLogin} />;

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
