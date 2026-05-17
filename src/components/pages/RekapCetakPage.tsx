import { useEffect, useState, useCallback } from 'react'
import { FileSpreadsheet, FileText, Printer, RefreshCw, CheckCircle, XCircle, Download, Loader2 } from 'lucide-react'
import { Button, PageHeader, StatCard, Table, Badge } from '../ui'
import { nilaiApi, sekolahApi, appApi, pdfApi } from '../../lib/api'
import type { Sekolah } from '../../types'

interface RekapRow {
  id: number; no_urut: number; nama: string; nisn: string
  jml_nilai: number; nilai_ijazah: number | null; lengkap: boolean
}

export function RekapCetakPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData]       = useState<RekapRow[]>([])
  const [sekolah, setSekolah] = useState<Sekolah | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rekap, skl] = await Promise.all([nilaiApi.rekap(), sekolahApi.get()])
      setData(rekap || []); setSekolah(skl)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = {
    total:   data.length,
    lengkap: data.filter(r => r.lengkap).length,
    belum:   data.filter(r => !r.lengkap).length,
    avg:     (() => {
      const vals = data.filter(r => r.nilai_ijazah != null).map(r => r.nilai_ijazah!)
      return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '0.00'
    })(),
  }

  // Export Excel
  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wsData = [
        [`REKAP NILAI — ${sekolah?.nama ?? ''}`],
        [`Tahun Ajaran: ${sekolah?.tahun_ajaran ?? ''}`],
        [],
        ['No','Nama Siswa','NISN','Jumlah Nilai','Nilai Ijazah','Status'],
        ...data.map(r => [r.no_urut, r.nama, r.nisn||'-', r.jml_nilai, r.nilai_ijazah?.toFixed(2)??'-', r.lengkap?'Lengkap':'Belum Lengkap'])
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{wch:6},{wch:32},{wch:16},{wch:12},{wch:14},{wch:16}]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai')
      XLSX.writeFile(wb, `Rekap_Nilai_${sekolah?.tahun_ajaran?.replace('/','_')??'Export'}.xlsx`)
      showToast('Export Excel berhasil')
    } catch (e: any) { showToast(`Gagal export: ${e.message}`, 'error') }
  }

  // Print PDF via Electron IPC
  const printPDF = async (type: 'skl' | 'dkn' | 'nilaiIjazah' | 'ijazah' | 'transkrip' | 'sk_kelulusan', label: string) => {
    setPrinting(type)
    try {
      let result: any
      if (type === 'skl')             result = await pdfApi.skl()
      else if (type === 'dkn')        result = await pdfApi.dkn()
      else if (type === 'ijazah')     result = await pdfApi.ijazah()
      else if (type === 'transkrip')  result = await pdfApi.transkrip()
      else if (type === 'sk_kelulusan') result = await pdfApi.skKelulusan()
      else                            result = await pdfApi.nilaiIjazah()

      if (result?.ok) {
        showToast(`${label} berhasil dicetak dan dibuka`)
      } else {
        showToast(`Gagal cetak: ${result?.error || 'Unknown error'}`, 'error')
      }
    } catch (e: any) {
      // Jika tidak ada Electron (browser mode)
      showToast('Fitur PDF hanya tersedia di aplikasi desktop (.exe)', 'warning')
    } finally { setPrinting(null) }
  }

  const isElectron = !!(window as any).api

  const columns = [
    { key:'no_urut', header:'No', width:'56px', align:'center' as const,
      render:(r:RekapRow) => <span className="font-mono text-xs text-gray-400">{r.no_urut}</span> },
    { key:'nama', header:'Nama Siswa',
      render:(r:RekapRow) => <span className="font-semibold text-gray-900">{r.nama}</span> },
    { key:'nisn', header:'NISN', width:'140px',
      render:(r:RekapRow) => <span className="font-mono text-xs text-gray-500">{r.nisn||'-'}</span> },
    { key:'jml_nilai', header:'Data Nilai', width:'100px', align:'center' as const,
      render:(r:RekapRow) => <span className="text-sm text-gray-600">{r.jml_nilai}</span> },
    { key:'nilai_ijazah', header:'Nilai Ijazah', width:'130px', align:'center' as const,
      render:(r:RekapRow) => r.nilai_ijazah != null
        ? <span className="font-bold text-blue-700 text-base">{r.nilai_ijazah.toFixed(2)}</span>
        : <span className="text-gray-300">—</span> },
    { key:'lengkap', header:'Status', width:'150px', align:'center' as const,
      render:(r:RekapRow) => r.lengkap
        ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            <CheckCircle className="w-3 h-3"/>Lengkap</span>
        : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">
            <XCircle className="w-3 h-3"/>Belum Lengkap</span> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Rekap & Cetak" subtitle="Rekap nilai ijazah dan cetak dokumen resmi"
        actions={<Button variant="secondary" icon={<RefreshCw className="w-4 h-4"/>} onClick={load}>Refresh</Button>} />

      {/* Backup & Restore */}
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">🗄️ Backup & Restore Database</p>
          <p className="text-xs text-amber-600">Backup rutin untuk keamanan data siswa dan nilai</p>
        </div>
        <button onClick={async () => {
          const r = await dbApi.backup() as any
          if (r?.ok) alert('✅ Backup berhasil disimpan di:\n' + r.path)
          else if (r?.message !== 'Dibatalkan') alert('❌ Gagal backup: ' + r?.message)
        }} className="px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
          💾 Backup
        </button>
        <button onClick={async () => {
          if (!confirm('⚠️ Restore akan MENGGANTI semua data saat ini dengan data dari file backup.\n\nYakin lanjutkan?')) return
          const r = await dbApi.restore() as any
          if (r?.ok) { alert('✅ Restore berhasil! Aplikasi akan reload.'); window.location.reload() }
          else if (r?.message !== 'Dibatalkan') alert('❌ Gagal restore: ' + r?.message)
        }} className="px-4 py-2 text-sm font-semibold bg-white text-amber-700 border border-amber-400 rounded-lg hover:bg-amber-50 transition-colors">
          📂 Restore
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Siswa"      value={stats.total}   icon={<CheckCircle className="w-5 h-5"/>} color="text-blue-600"/>
        <StatCard label="Nilai Lengkap"    value={stats.lengkap} icon={<CheckCircle className="w-5 h-5"/>} color="text-emerald-600"/>
        <StatCard label="Belum Lengkap"    value={stats.belum}   icon={<XCircle className="w-5 h-5"/>}     color="text-red-500"/>
        <StatCard label="Rata-rata Ijazah" value={stats.avg}     icon={<FileText className="w-5 h-5"/>}    color="text-purple-600"/>
      </div>

      {/* Actions */}
      <div className="card p-4">
        <p className="text-sm font-bold text-gray-700 mb-1">Ekspor & Cetak Dokumen</p>
        {!isElectron && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg mb-3">
            Fitur cetak PDF hanya aktif di aplikasi desktop (.exe). Export Excel tersedia di semua platform.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600"/>} onClick={exportExcel}>
            Export Excel
          </Button>

          {(['skl','dkn','nilaiIjazah','ijazah','transkrip','sk_kelulusan'] as const).map(type => {
            const labels: Record<string,string> = { skl:'Cetak SKL', dkn:'Cetak DKN', nilaiIjazah:'Cetak Nilai Ijazah', ijazah:'Cetak Ijazah', transkrip:'Cetak Transkrip Nilai', sk_kelulusan:'Cetak SK Kelulusan' }
            const isPrinting = printing === type
            return (
              <Button key={type}
                variant={isElectron ? 'success' : 'secondary'}
                disabled={!isElectron || isPrinting}
                icon={isPrinting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>}
                onClick={() => printPDF(type, labels[type])}>
                {isPrinting ? 'Mencetak...' : `${labels[type]} (PDF)`}
              </Button>
            )
          })}

          <Button variant="ghost" icon={<Download className="w-4 h-4"/>} onClick={() => appApi.openOutput()}>
            Buka Folder Output
          </Button>
        </div>
      </div>

      <Table columns={columns} data={data} keyFn={r=>r.id} loading={loading}
        emptyText="Belum ada data. Tambahkan siswa dan input nilai terlebih dahulu." />
    </div>
  )
}
