import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useToast } from './hooks/useToast'
import { LoginPage } from './components/pages/LoginPage'
import { Sidebar, type PageKey } from './components/layout/Sidebar'
import { DashboardPage } from './components/pages/DashboardPage'
import { SekolahPage } from './components/pages/SekolahPage'
import { SiswaPage } from './components/pages/SiswaPage'
import { MapelPage } from './components/pages/MapelPage'
import { SemesterPage } from './components/pages/SemesterPage'
import { InputNilaiPage } from './components/pages/InputNilaiPage'
import { RekapCetakPage } from './components/pages/RekapCetakPage'
import { AngkatanPage } from './components/pages/AngkatanPage'
import { ToastContainer } from './components/ui'

function AppInner() {
  const { user } = useAuth()
  const [loggedIn, setLoggedIn] = useState(!!user)
  const [page, setPage] = useState<PageKey>('dashboard')
  const { toasts, show, remove } = useToast()

  if (!loggedIn || !user) {
    return (
      <>
        <LoginPage onLogin={() => setLoggedIn(true)} />
        <ToastContainer toasts={toasts} remove={remove} />
      </>
    )
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage onNavigate={setPage} />
      case 'sekolah':   return <SekolahPage showToast={show} />
      case 'siswa':     return <SiswaPage showToast={show} />
      case 'mapel':     return <MapelPage showToast={show} />
      case 'semester':  return <SemesterPage showToast={show} />
      case 'nilai':     return <InputNilaiPage showToast={show} />
      case 'rekap':     return <RekapCetakPage showToast={show} />
      case 'angkatan':  return <AngkatanPage showToast={show} />
      default: return null
    }
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar active={page} onNavigate={setPage} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-screen-xl mx-auto h-full">
            {renderPage()}
          </div>
        </main>
      </div>
      <ToastContainer toasts={toasts} remove={remove} />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
