import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users, CheckCircle, XCircle, Upload, Hash, RefreshCw, FileText, Camera, X } from 'lucide-react'
import { StatCard, Table, Button, SearchBar, Modal, Input, Select, ConfirmDialog, Badge, PageHeader, EmptyState } from '../ui'
import { siswaApi, sekolahApi, dbApi } from '../../lib/api'
import type { Siswa } from '../../types'

const EMPTY: Omit<Siswa, 'id'> = {
  no_urut: 1, nism: '', nisn: '', nama: '', jk: 'Laki-laki',
  tempat_lahir: '', tgl_lahir: '', ortu: '', peserta_am: '', blanko: '', no_skl: '', foto: ''
}

const BULAN_ROMAWI = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
const KODE_JENJANG: Record<string,string> = {
  'SD':'421.2','MI':'421.2','SMP':'421.3','MTs':'421.3',
  'SMA':'421.3','MA':'421.3','SMK':'421.5',
}

export function SiswaPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData]       = useState<Siswa[]>([])
  const [q, setQ]             = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<{ open: boolean; mode: 'add'|'edit'; form: any }>({ open: false, mode: 'add', form: { ...EMPTY } })
  const [confirm, setConfirm] = useState<{ open: boolean; id: number|null; nama: string }>({ open: false, id: null, nama: '' })
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState<Record<string,string>>({})

  // Generate SKL modal state
  const [genModal, setGenModal] = useState(false)
  const [genOpts, setGenOpts]   = useState({
    kode_sekolah: '', bulan_romawi: BULAN_ROMAWI[new Date().getMonth()],
    tahun: String(new Date().getFullYear()), mulai_dari: '1'
  })
  const [genPreview, setGenPreview] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [sekolah, setSekolah] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await siswaApi.list(q) || []) }
    finally { setLoading(false) }
  }, [q])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    sekolahApi.get().then(s => {
      setSekolah(s)
      if (s?.nama) {
        // Auto-suggest kode sekolah dari nama
        const kata = (s.nama || '').split(' ')
        const kode = kata.slice(0,3).map((k:string) => k.replace(/[^A-Z0-9]/gi,'')).join('.').toUpperCase()
        setGenOpts(o => ({ ...o, kode_sekolah: o.kode_sekolah || kode }))
      }
    })
  }, [])

  // Update preview otomatis
  useEffect(() => {
    const jenjang = sekolah?.jenjang || 'SMK'
    const kodeJ = KODE_JENJANG[jenjang] || '421.5'
    const no = String(parseInt(genOpts.mulai_dari)||1).padStart(3,'0')
    setGenPreview(`${kodeJ}/${no}/${genOpts.kode_sekolah||'...'}/  ${genOpts.bulan_romawi}/${genOpts.tahun}`)
  }, [genOpts, sekolah])

  const stats = {
    total: data.length,
    nilai: data.filter(s => (s.jml_nilai??0) > 0).length,
    skl:   data.filter(s => !!s.no_skl).length,
  }

  const openAdd = () => {
    const maxNo = data.length > 0 ? Math.max(...data.map(s => s.no_urut||0)) + 1 : 1
    setErrors({})
    setModal({ open: true, mode: 'add', form: { ...EMPTY, no_urut: maxNo } })
  }

  const openEdit = (row: Siswa) => {
    setErrors({})
    setModal({ open: true, mode: 'edit', form: { ...row } })
  }

  const validate = (f: any) => {
    const e: Record<string,string> = {}
    if (!f.nama?.trim()) e.nama = 'Nama wajib diisi'
    if (!f.no_urut || f.no_urut < 1) e.no_urut = 'No urut tidak valid'
    return e
  }

  const handleSave = async () => {
    const errs = validate(modal.form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      if (modal.mode === 'add') await siswaApi.add(modal.form)
      else await siswaApi.update(modal.form.id, modal.form)
      setModal(m => ({ ...m, open: false }))
      showToast(modal.mode === 'add' ? 'Siswa berhasil ditambahkan' : 'Data siswa diperbarui')
      load()
    } catch (e: any) {
      showToast(e.message || 'Gagal menyimpan', 'error')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    try {
      await siswaApi.delete(confirm.id)
      showToast('Data siswa dihapus')
      load()
    } catch { showToast('Gagal menghapus', 'error') }
    finally { setConfirm({ open: false, id: null, nama: '' }) }
  }

  const handleGenerateSkl = async () => {
    setGenLoading(true)
    try {
      const result = await siswaApi.generateNoSkl(genOpts) as any
      if (result?.ok) {
        showToast(`✅ No SKL berhasil digenerate untuk ${result.generated} siswa`)
        setGenModal(false)
        load()
      } else {
        showToast('Gagal generate No SKL', 'error')
      }
    } catch { showToast('Gagal generate No SKL', 'error') }
    finally { setGenLoading(false) }
  }

  const handleImportExcel = async () => {
    setImportLoading(true)
    try {
      const result = await siswaApi.importExcel() as any
      if (result?.ok) {
        showToast(result.message)
        load()
      } else {
        showToast(result?.message || 'Gagal import', 'error')
      }
    } catch { showToast('Gagal import Excel', 'error') }
    finally { setImportLoading(false) }
  }

  const handleUploadFoto = async (siswaId: number) => {
    const result = await siswaApi.uploadFoto(siswaId) as any
    if (result) {
      showToast('Foto berhasil diupload')
      load()
      // update modal form too if editing this siswa
      setModal(m => m.form.id === siswaId ? { ...m, form: { ...m.form, foto: result } } : m)
    }
  }

  const set = (key: string, val: any) => setModal(m => ({ ...m, form: { ...m.form, [key]: val } }))

  const columns = [
    { key: 'no_urut', header: 'No', width: '48px', align: 'center' as const,
      render: (r: Siswa) => <span className="font-mono text-xs text-gray-500">{r.no_urut}</span> },
    { key: 'nama', header: 'Nama Siswa',
      render: (r: Siswa) => <span className="font-semibold text-gray-900">{r.nama}</span> },
    { key: 'nisn', header: 'NISN', width: '120px',
      render: (r: Siswa) => <span className="font-mono text-xs text-gray-600">{r.nisn||'-'}</span> },
    { key: 'no_skl', header: 'No SKL', width: '180px',
      render: (r: Siswa) => r.no_skl
        ? <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{r.no_skl}</span>
        : <span className="text-xs text-gray-400 italic">Belum digenerate</span> },
    { key: 'blanko', header: 'No Blanko', width: '110px',
      render: (r: Siswa) => <span className="font-mono text-xs text-gray-500">{r.blanko||'-'}</span> },
    { key: 'jk', header: 'JK', width: '56px', align: 'center' as const,
      render: (r: Siswa) => <Badge color={r.jk==='Laki-laki'?'blue':'purple'}>{r.jk==='Laki-laki'?'L':'P'}</Badge> },
    { key: 'jml_nilai', header: 'Nilai', width: '72px', align: 'center' as const,
      render: (r: Siswa) => (r.jml_nilai??0)>0
        ? <span className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle className="w-3.5 h-3.5"/>{r.jml_nilai}</span>
        : <span className="flex items-center justify-center gap-1 text-gray-400 text-xs"><XCircle className="w-3.5 h-3.5"/>0</span> },
    { key: 'aksi', header: 'Aksi', width: '80px', align: 'center' as const,
      render: (r: Siswa) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={e => { e.stopPropagation(); openEdit(r) }}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); setConfirm({ open: true, id: r.id, nama: r.nama }) }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )},
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Data Siswa" subtitle="Kelola data siswa, No SKL, dan blanko ijazah"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Hash className="w-4 h-4"/>} onClick={() => setGenModal(true)}>
              Generate No SKL
            </Button>
            <Button icon={<Plus className="w-4 h-4"/>} onClick={openAdd}>Tambah Siswa</Button>
          </div>
        } />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Siswa"      value={stats.total} icon={<Users className="w-5 h-5"/>} color="text-blue-600"/>
        <StatCard label="Sudah Ada Nilai"  value={stats.nilai} icon={<CheckCircle className="w-5 h-5"/>} color="text-emerald-600"/>
        <StatCard label="No SKL Tergenerate" value={stats.skl} icon={<FileText className="w-5 h-5"/>} color="text-purple-600"/>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex-1"><SearchBar value={q} onChange={setQ} placeholder="Cari nama / NISN / NISM..." /></div>
        <Button variant="secondary" icon={<Upload className="w-4 h-4"/>} loading={importLoading} onClick={handleImportExcel}>Import Excel</Button>
      </div>

      {/* Table */}
      <Table columns={columns} data={data} keyFn={r => r.id} loading={loading}
        emptyText="Belum ada data siswa. Klik Tambah Siswa untuk memulai." />

      {/* ── Modal Generate No SKL ── */}
      <Modal open={genModal} onClose={() => setGenModal(false)}
        title="Generate Nomor SKL Otomatis" size="md"
        footer={<>
          <Button variant="secondary" onClick={() => setGenModal(false)}>Batal</Button>
          <Button icon={<RefreshCw className="w-4 h-4"/>} loading={genLoading} onClick={handleGenerateSkl}>
            Generate untuk {data.length} Siswa
          </Button>
        </>}>

        <div className="flex flex-col gap-4">
          {/* Info format */}
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">Format No SKL:</p>
            <p className="font-mono text-xs bg-white rounded px-2 py-1.5 border border-blue-200">
              {KODE_JENJANG[sekolah?.jenjang||'SMK']||'421.5'} / [No Urut] / [Kode Sekolah] / [Bulan Romawi] / [Tahun]
            </p>
            <p className="mt-1.5 text-xs text-blue-600">
              Kode {KODE_JENJANG[sekolah?.jenjang||'SMK']||'421.5'} = klasifikasi {sekolah?.jenjang||'SMK'} sesuai standar surat dinas pendidikan
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Kode Sekolah (singkatan)"
                value={genOpts.kode_sekolah}
                onChange={e => setGenOpts(o => ({ ...o, kode_sekolah: e.target.value.toUpperCase() }))}
                placeholder="Contoh: SMKN1.CBN" />
              <p className="text-xs text-gray-400 mt-1">Singkatan nama sekolah untuk kode surat</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Bulan</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={genOpts.bulan_romawi}
                onChange={e => setGenOpts(o => ({ ...o, bulan_romawi: e.target.value }))}>
                {BULAN_ROMAWI.map((b, i) => (
                  <option key={b} value={b}>{b} — {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][i]}</option>
                ))}
              </select>
            </div>
            <Input label="Tahun"
              value={genOpts.tahun}
              onChange={e => setGenOpts(o => ({ ...o, tahun: e.target.value }))}
              placeholder="2025" />
            <Input label="Nomor Urut Mulai Dari"
              type="number" min="1"
              value={genOpts.mulai_dari}
              onChange={e => setGenOpts(o => ({ ...o, mulai_dari: e.target.value }))}
              placeholder="1" />
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Preview Nomor Pertama:</p>
            <p className="font-mono text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2">
              {genPreview}
            </p>
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded px-2 py-1.5">
              ⚠️ Ini akan <strong>menimpa</strong> semua No SKL yang sudah ada. No SKL individual tetap bisa diedit manual di form Edit Siswa.
            </p>
          </div>
        </div>
      </Modal>

      {/* ── Modal Form Tambah / Edit ── */}
      <Modal open={modal.open} onClose={() => setModal(m => ({ ...m, open: false }))}
        title={modal.mode==='add' ? 'Tambah Siswa Baru' : 'Edit Data Siswa'}
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(m => ({ ...m, open: false }))}>Batal</Button>
          <Button loading={saving} onClick={handleSave}>Simpan</Button>
        </>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Nama Lengkap *" value={modal.form.nama||''}
              onChange={e => set('nama', e.target.value)} error={errors.nama}
              placeholder="Nama lengkap siswa" />
          </div>
          <Input label="No Urut *" type="number" value={modal.form.no_urut||''}
            onChange={e => set('no_urut', parseInt(e.target.value)||0)} error={errors.no_urut} />
          <Select label="Jenis Kelamin"
            value={modal.form.jk||'Laki-laki'}
            onChange={e => set('jk', e.target.value)}
            options={[{ value:'Laki-laki', label:'Laki-laki' },{ value:'Perempuan', label:'Perempuan' }]} />
          <Input label="NISN" value={modal.form.nisn||''} onChange={e => set('nisn', e.target.value)} placeholder="Nomor Induk Siswa Nasional" />
          <Input label="NISM" value={modal.form.nism||''} onChange={e => set('nism', e.target.value)} placeholder="Nomor Induk Siswa Madrasah" />
          <Input label="Tempat Lahir" value={modal.form.tempat_lahir||''} onChange={e => set('tempat_lahir', e.target.value)} placeholder="Kota tempat lahir" />
          <Input label="Tanggal Lahir" type="date" value={modal.form.tgl_lahir||''} onChange={e => set('tgl_lahir', e.target.value)} />
          <div className="col-span-2">
            <Input label="Nama Orang Tua" value={modal.form.ortu||''} onChange={e => set('ortu', e.target.value)} placeholder="Nama ayah / ibu" />
          </div>
          <Input label="No Peserta AM" value={modal.form.peserta_am||''} onChange={e => set('peserta_am', e.target.value)} placeholder="No peserta ujian" />
          <Input label="No Blanko Ijazah" value={modal.form.blanko||''} onChange={e => set('blanko', e.target.value)} placeholder="No blanko ijazah" />

          {/* Foto Siswa */}
          <div className="col-span-2">
            <div className="border-t border-gray-100 pt-4 mt-1">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-purple-500" />
                <p className="text-sm font-semibold text-gray-700">Foto Siswa</p>
                <span className="text-xs text-gray-400">Muncul otomatis di SKL (3×4 cm)</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 h-24 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {modal.form.foto
                    ? <img src={modal.form.foto} alt="foto" className="w-full h-full object-cover" />
                    : <Camera className="w-8 h-8 text-gray-300" />}
                </div>
                <div className="flex flex-col gap-2">
                  {modal.mode === 'edit' && (
                    <>
                      <button type="button"
                        onClick={() => handleUploadFoto(modal.form.id)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
                        <Upload className="w-3.5 h-3.5"/>
                        {modal.form.foto ? 'Ganti Foto' : 'Upload Foto'}
                      </button>
                      {modal.form.foto && (
                        <button type="button"
                          onClick={async () => { await siswaApi.removeFoto(modal.form.id); set('foto',''); load() }}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                          <X className="w-3.5 h-3.5"/> Hapus Foto
                        </button>
                      )}
                    </>
                  )}
                  {modal.mode === 'add' && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">Simpan data siswa dulu, lalu edit untuk upload foto.</p>
                  )}
                  <p className="text-xs text-gray-400">PNG/JPG, wajah jelas.<br/>Disarankan 3×4 cm.</p>
                </div>
              </div>
            </div>
          </div>

          {/* No SKL */}
          <div className="col-span-2">
            <div className="border-t border-gray-100 pt-4 mt-1">
              <div className="flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-blue-500" />
                <p className="text-sm font-semibold text-gray-700">Nomor SKL</p>
                <span className="text-xs text-gray-400">(bisa diisi manual atau gunakan Generate No SKL)</span>
              </div>
              <Input
                label="No SKL"
                value={modal.form.no_skl||''}
                onChange={e => set('no_skl', e.target.value)}
                placeholder="Contoh: 421.5/001/SMKN1.CBN/V/2025"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog open={confirm.open}
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null, nama: '' })}
        title="Hapus Data Siswa"
        message={`Yakin hapus data "${confirm.nama}"? Semua nilai siswa ini juga akan terhapus.`}
        danger />
    </div>
  )
}
