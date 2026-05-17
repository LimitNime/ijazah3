const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Paths ──────────────────────────────────────────────────────────────────
const userDataPath = app.getPath('userData')
const dbPath       = path.join(userDataPath, 'sim_ijazah.db')
const outputPath   = path.join(userDataPath, 'output')
if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true })

let db

// ── DB init ────────────────────────────────────────────────────────────────
function initDB() {
  const Database = require('better-sqlite3')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, email TEXT UNIQUE, password TEXT, role TEXT
    );
    CREATE TABLE IF NOT EXISTS sekolah (
      id INTEGER PRIMARY KEY,
      nama TEXT, nss TEXT, npsn TEXT, kepala TEXT, nip TEXT,
      alamat TEXT, kota TEXT, provinsi TEXT, kode_pos TEXT,
      telp TEXT, email_sekolah TEXT, website TEXT,
      tahun_ajaran TEXT, tgl_lulus TEXT,
      bobot_raport REAL DEFAULT 60, bobot_ujian REAL DEFAULT 40,
      jenjang TEXT DEFAULT 'MI',
      logo_sekolah TEXT,
      logo_kemdikbud TEXT,
      program_keahlian TEXT,
      kompetensi_keahlian TEXT,
      keputusan_kepala TEXT,
      no_sk TEXT
    );
    CREATE TABLE IF NOT EXISTS semester_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL, urutan INTEGER NOT NULL, is_ujian INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS siswa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_urut INTEGER, nism TEXT, nisn TEXT, nama TEXT, jk TEXT,
      tempat_lahir TEXT, tgl_lahir TEXT, ortu TEXT, peserta_am TEXT, blanko TEXT, no_skl TEXT, foto TEXT
    );
    CREATE TABLE IF NOT EXISTS mapel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT, kelompok TEXT, urutan INTEGER, is_mulok INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS nilai (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siswa_id INTEGER, mapel_id INTEGER, semester_id INTEGER,
      nilai_p REAL, nilai_k REAL, nilai_ujian REAL,
      UNIQUE(siswa_id, mapel_id, semester_id)
    );
    CREATE TABLE IF NOT EXISTS angkatan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL, tahun_lulus TEXT, keterangan TEXT, is_aktif INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS angkatan_siswa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      angkatan_id INTEGER NOT NULL, siswa_id INTEGER NOT NULL,
      UNIQUE(angkatan_id, siswa_id)
    );
  `)

  const crypto = require('crypto')
  const hash = pw => crypto.createHash('sha256').update(pw).digest('hex')

  if (!db.prepare('SELECT id FROM users LIMIT 1').get())
    db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run('Administrator','admin@sekolah.id',hash('admin123'),'admin')

  // Migrasi: tambah kolom baru jika belum ada (untuk DB lama)
  const sekolahCols = db.prepare("PRAGMA table_info(sekolah)").all().map(c => c.name)
  const newCols = {
    logo_sekolah: 'TEXT', logo_kemdikbud: 'TEXT',
    program_keahlian: 'TEXT', kompetensi_keahlian: 'TEXT',
    keputusan_kepala: 'TEXT', no_sk: 'TEXT'
  }
  // Migrasi kolom siswa
  const siswaCols = db.prepare("PRAGMA table_info(siswa)").all().map(c => c.name)
  if (!siswaCols.includes('no_skl'))
    db.prepare("ALTER TABLE siswa ADD COLUMN no_skl TEXT").run()
  if (!siswaCols.includes('foto'))
    db.prepare("ALTER TABLE siswa ADD COLUMN foto TEXT").run()

  Object.entries(newCols).forEach(([col, type]) => {
    if (!sekolahCols.includes(col))
      db.prepare(`ALTER TABLE sekolah ADD COLUMN ${col} ${type}`).run()
  })

  if (!db.prepare('SELECT id FROM sekolah LIMIT 1').get())
    db.prepare(`INSERT INTO sekolah(id,nama,nss,npsn,kepala,nip,alamat,kota,provinsi,kode_pos,telp,tahun_ajaran,tgl_lulus,bobot_raport,bobot_ujian,jenjang)
      VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('MI Contoh','111233040001','10100001','Nama Kepala Sekolah','196001011980011001',
      'Jl. Contoh No.1','Kota','Provinsi','12345','021-000000','2024/2025',new Date().toISOString().split('T')[0],60,40,'MI')

  if (!db.prepare('SELECT id FROM semester_config LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO semester_config(label,urutan,is_ujian) VALUES(?,?,?)')
    ;[['Semester 1 (Ganjil)',1,0],['Semester 2 (Genap)',2,0],['Semester 3 (Ganjil)',3,0],
      ['Semester 4 (Genap)',4,0],['Semester 5 (Ganjil)',5,0],['Semester 6 (Genap)',6,0],
      ['Ujian Madrasah (UM)',7,1]].forEach(s => ins.run(...s))
  }

  if (!db.prepare('SELECT id FROM mapel LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO mapel(nama,kelompok,urutan,is_mulok) VALUES(?,?,?,?)')
    ;[["Al-Qur'an Hadis",'A',1,0],['Akidah Akhlak','A',2,0],['Fikih','A',3,0],['SKI','A',4,0],
      ['Pendidikan Pancasila','A',5,0],['Bahasa Indonesia','A',6,0],['Matematika','A',7,0],
      ['IPAS','A',8,0],['Bahasa Arab','A',9,0],['PJOK','B',10,0],
      ['Seni Budaya dan Prakarya','B',11,0]].forEach(m => ins.run(...m))
  }
}

// ── Helper: get semua nilai siswa (object indexed by siswa_id) ─────────────
function getAllNilai() {
  const rows = db.prepare('SELECT * FROM nilai').all()
  const map = {}
  rows.forEach(r => {
    if (!map[r.siswa_id]) map[r.siswa_id] = []
    map[r.siswa_id].push(r)
  })
  return map
}

// ── IPC ────────────────────────────────────────────────────────────────────
function registerIPC() {
  const crypto = require('crypto')
  const hash = pw => crypto.createHash('sha256').update(pw).digest('hex')

  // Auth
  ipcMain.handle('auth:login', (_, email, password) =>
    db.prepare('SELECT id,name,email,role FROM users WHERE email=? AND password=?').get(email, hash(password)) || null)

  // Sekolah
  ipcMain.handle('sekolah:get', () => db.prepare('SELECT * FROM sekolah WHERE id=1').get())
  ipcMain.handle('sekolah:save', (_, data) => {
    const keys = Object.keys(data).filter(k => k !== 'id')
    db.prepare(`UPDATE sekolah SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=1`).run(...keys.map(k => data[k]))
    return true
  })

  // Semester
  ipcMain.handle('semester:list', () => db.prepare('SELECT * FROM semester_config ORDER BY urutan').all())
  ipcMain.handle('semester:add', (_, d) => db.prepare('INSERT INTO semester_config(label,urutan,is_ujian) VALUES(?,?,?)').run(d.label,d.urutan,d.is_ujian||0).lastInsertRowid)
  ipcMain.handle('semester:update', (_, id, d) => { db.prepare('UPDATE semester_config SET label=?,urutan=?,is_ujian=? WHERE id=?').run(d.label,d.urutan,d.is_ujian||0,id); return true })
  ipcMain.handle('semester:delete', (_, id) => { db.prepare('DELETE FROM nilai WHERE semester_id=?').run(id); db.prepare('DELETE FROM semester_config WHERE id=?').run(id); return true })
  ipcMain.handle('semester:reorder', (_, ids) => {
    const tx = db.transaction(list => list.forEach((id,i) => db.prepare('UPDATE semester_config SET urutan=? WHERE id=?').run(i+1,id)))
    tx(ids); return true
  })

  // Siswa
  ipcMain.handle('siswa:list', (_, q) => {
    const base = 'SELECT s.*, (SELECT COUNT(*) FROM nilai n WHERE n.siswa_id=s.id) jml_nilai FROM siswa s'
    return q
      ? db.prepare(`${base} WHERE s.nama LIKE ? OR s.nisn LIKE ? OR s.nism LIKE ? OR s.peserta_am LIKE ? ORDER BY COALESCE(s.no_urut,99999),s.nama`).all(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`)
      : db.prepare(`${base} ORDER BY COALESCE(s.no_urut,99999),s.nama`).all()
  })
  ipcMain.handle('siswa:get', (_, id) => db.prepare('SELECT * FROM siswa WHERE id=?').get(id))
  ipcMain.handle('siswa:add', (_, d) => db.prepare('INSERT INTO siswa(no_urut,nism,nisn,nama,jk,tempat_lahir,tgl_lahir,ortu,peserta_am,blanko,no_skl,foto) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(d.no_urut,d.nism,d.nisn,d.nama,d.jk,d.tempat_lahir,d.tgl_lahir,d.ortu,d.peserta_am,d.blanko,d.no_skl||null,d.foto||null).lastInsertRowid)
  ipcMain.handle('siswa:update', (_, id, d) => { db.prepare('UPDATE siswa SET no_urut=?,nism=?,nisn=?,nama=?,jk=?,tempat_lahir=?,tgl_lahir=?,ortu=?,peserta_am=?,blanko=?,no_skl=?,foto=? WHERE id=?').run(d.no_urut,d.nism,d.nisn,d.nama,d.jk,d.tempat_lahir,d.tgl_lahir,d.ortu,d.peserta_am,d.blanko,d.no_skl||null,d.foto||null,id); return true })
  ipcMain.handle('siswa:delete', (_, id) => { db.prepare('DELETE FROM nilai WHERE siswa_id=?').run(id); db.prepare('DELETE FROM angkatan_siswa WHERE siswa_id=?').run(id); db.prepare('DELETE FROM siswa WHERE id=?').run(id); return true })
  ipcMain.handle('siswa:stats', () => ({ total: db.prepare('SELECT COUNT(*) c FROM siswa').get().c, dengan_nilai: db.prepare('SELECT COUNT(DISTINCT siswa_id) c FROM nilai').get().c }))

  // Mapel
  ipcMain.handle('mapel:list', () => db.prepare('SELECT m.*, (SELECT COUNT(*) FROM nilai n WHERE n.mapel_id=m.id) jml_nilai FROM mapel m ORDER BY COALESCE(m.urutan,999),m.nama').all())
  ipcMain.handle('mapel:add', (_, d) => db.prepare('INSERT INTO mapel(nama,kelompok,urutan,is_mulok) VALUES(?,?,?,?)').run(d.nama,d.kelompok,d.urutan,d.is_mulok).lastInsertRowid)
  ipcMain.handle('mapel:update', (_, id, d) => { db.prepare('UPDATE mapel SET nama=?,kelompok=?,urutan=?,is_mulok=? WHERE id=?').run(d.nama,d.kelompok,d.urutan,d.is_mulok,id); return true })
  ipcMain.handle('mapel:delete', (_, id) => { db.prepare('DELETE FROM nilai WHERE mapel_id=?').run(id); db.prepare('DELETE FROM mapel WHERE id=?').run(id); return true })
  ipcMain.handle('mapel:reorder', (_, ids) => { const tx = db.transaction(list => list.forEach((id,i) => db.prepare('UPDATE mapel SET urutan=? WHERE id=?').run(i+1,id))); tx(ids); return true })
  ipcMain.handle('mapel:seed_default', () => {
    const existing = new Set(db.prepare('SELECT lower(trim(nama)) n FROM mapel').all().map(r => r.n))
    const defaults = [["Al-Qur'an Hadis",'A',1,0],['Akidah Akhlak','A',2,0],['Fikih','A',3,0],['SKI','A',4,0],['Pendidikan Pancasila','A',5,0],['Bahasa Indonesia','A',6,0],['Matematika','A',7,0],['IPAS','A',8,0],['Bahasa Arab','A',9,0],['PJOK','B',10,0],['Seni Budaya dan Prakarya','B',11,0]]
    const ins = db.prepare('INSERT INTO mapel(nama,kelompok,urutan,is_mulok) VALUES(?,?,?,?)')
    let added = 0
    defaults.forEach(([nama,...r]) => { if (!existing.has(nama.toLowerCase().trim())) { ins.run(nama,...r); added++ } })
    return added
  })

  // Nilai
  ipcMain.handle('nilai:get_siswa', (_, id) => db.prepare('SELECT * FROM nilai WHERE siswa_id=?').all(id))
  ipcMain.handle('nilai:save_batch', (_, rows) => {
    const ins = db.prepare('INSERT INTO nilai(siswa_id,mapel_id,semester_id,nilai_p,nilai_k,nilai_ujian) VALUES(?,?,?,?,?,?) ON CONFLICT(siswa_id,mapel_id,semester_id) DO UPDATE SET nilai_p=excluded.nilai_p,nilai_k=excluded.nilai_k,nilai_ujian=excluded.nilai_ujian')
    const tx = db.transaction(list => list.forEach(r => ins.run(r.siswa_id,r.mapel_id,r.semester_id,r.nilai_p,r.nilai_k,r.nilai_ujian)))
    tx(rows); return true
  })
  ipcMain.handle('nilai:rekap', () => {
    const siswa   = db.prepare('SELECT id,no_urut,nama,nisn FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    const mapels  = db.prepare('SELECT id FROM mapel').all()
    const s       = db.prepare('SELECT bobot_raport,bobot_ujian FROM sekolah WHERE id=1').get()
    const ujianSem = db.prepare('SELECT id FROM semester_config WHERE is_ujian=1 ORDER BY urutan DESC LIMIT 1').get()
    const br = s?.bobot_raport || 60, bu = s?.bobot_ujian || 40, tb = br + bu
    return siswa.map(sw => {
      let ok = true, sum = 0, cnt = 0
      for (const m of mapels) {
        const raps = db.prepare('SELECT semester_id,nilai_p,nilai_k FROM nilai WHERE siswa_id=? AND mapel_id=? AND semester_id<>?').all(sw.id,m.id,ujianSem?.id??0)
        if (!raps.length || raps.some(r => r.nilai_p==null||r.nilai_k==null)) { ok=false; break }
        const raport = raps.reduce((a,r)=>a+(parseFloat(r.nilai_p)+parseFloat(r.nilai_k))/2,0)/raps.length
        const um = db.prepare('SELECT nilai_ujian FROM nilai WHERE siswa_id=? AND mapel_id=? AND semester_id=?').get(sw.id,m.id,ujianSem?.id??0)
        if (!um||um.nilai_ujian==null) { ok=false; break }
        sum += (raport*br+parseFloat(um.nilai_ujian)*bu)/tb; cnt++
      }
      const nij = ok&&cnt ? Math.round(sum/cnt*100)/100 : null
      const jml = db.prepare('SELECT COUNT(*) c FROM nilai WHERE siswa_id=?').get(sw.id).c
      return { ...sw, nilai_ijazah: nij, jml_nilai: jml, lengkap: ok }
    })
  })

  // Angkatan
  ipcMain.handle('angkatan:list', () => db.prepare('SELECT a.*, (SELECT COUNT(*) FROM angkatan_siswa x WHERE x.angkatan_id=a.id) jml_siswa FROM angkatan a ORDER BY a.id DESC').all())
  ipcMain.handle('angkatan:add', (_, d) => db.prepare('INSERT INTO angkatan(nama,tahun_lulus,keterangan,is_aktif) VALUES(?,?,?,?)').run(d.nama,d.tahun_lulus,d.keterangan,d.is_aktif).lastInsertRowid)
  ipcMain.handle('angkatan:update', (_, id, d) => { db.prepare('UPDATE angkatan SET nama=?,tahun_lulus=?,keterangan=?,is_aktif=? WHERE id=?').run(d.nama,d.tahun_lulus,d.keterangan,d.is_aktif,id); return true })
  ipcMain.handle('angkatan:delete', (_, id) => { db.prepare('DELETE FROM angkatan_siswa WHERE angkatan_id=?').run(id); db.prepare('DELETE FROM angkatan WHERE id=?').run(id); return true })
  ipcMain.handle('angkatan:siswa', (_, id) => db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(id))
  ipcMain.handle('angkatan:tambah_siswa', (_, id, ids) => { const ins=db.prepare('INSERT OR IGNORE INTO angkatan_siswa(angkatan_id,siswa_id) VALUES(?,?)'); const tx=db.transaction(list=>list.forEach(sid=>ins.run(id,sid))); tx(ids); return true })
  ipcMain.handle('angkatan:hapus_siswa', (_, id, ids) => { const del=db.prepare('DELETE FROM angkatan_siswa WHERE angkatan_id=? AND siswa_id=?'); const tx=db.transaction(list=>list.forEach(sid=>del.run(id,sid))); tx(ids); return true })

  // ── PDF Handlers ──────────────────────────────────────────────────────
  const { generateSKL, generateDKN, generateNilaiIjazah, generateIjazah, generateTranskrip } = require('./pdf-generator')

  function getPDFData() {
    const sekolah  = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
    const siswaList = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    const mapelList = db.prepare('SELECT * FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
    const sems     = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
    const ujianSem = sems.find(s => s.is_ujian) || sems[sems.length - 1]
    const raportSems = sems.filter(s => !s.is_ujian)
    const nilaiData = getAllNilai()
    const br = sekolah?.bobot_raport || 60
    const bu = sekolah?.bobot_ujian  || 40
    return { sekolah, siswaList, mapelList, ujianSemId: ujianSem?.id, raportSemIds: raportSems.map(s=>s.id), nilaiData, br, bu, totalB: br+bu }
  }

  ipcMain.handle('pdf:skl', async () => {
    try {
      const data = getPDFData()
      const filePath = generateSKL(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('pdf:dkn', async () => {
    try {
      const data = getPDFData()
      const filePath = generateDKN(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('export:excel_angkatan', async (_, angkatan_id) => {
    try {
      const { exportExcelAngkatan } = require('./pdf-generator')
      const angkatan = db.prepare('SELECT * FROM angkatan WHERE id=?').get(angkatan_id)
      const siswaList = angkatan_id
        ? db.prepare(`SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id
            WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama`).all(angkatan_id)
        : db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      const mapelList = db.prepare('SELECT * FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
      const semList   = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const seo       = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const ujianSem  = semList.find(s => s.is_ujian) || semList[semList.length-1]
      const raportSems = semList.filter(s => !s.is_ujian)
      const nilaiData  = getAllNilai()
      const br = seo?.bobot_raport||60, bu = seo?.bobot_ujian||40, totalB = br+bu
      const filePath = exportExcelAngkatan(outputPath, {
        sekolah: seo, angkatan, siswaList, mapelList, semList,
        nilaiData, ujianSemId: ujianSem?.id, raportSemIds: raportSems.map(s=>s.id),
        br, bu, totalB
      })
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('pdf:nilai_ijazah', async () => {
    try {
      const data = getPDFData()
      const filePath = generateNilaiIjazah(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })


  ipcMain.handle('pdf:ijazah', async () => {
    try {
      const data = getPDFData()
      const filePath = generateIjazah(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('pdf:transkrip', async () => {
    try {
      const data = getPDFData()
      const filePath = generateTranskrip(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })


  // Upload logo (simpan base64 ke DB)
  ipcMain.handle('sekolah:upload_logo', async (_, field) => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({
      title: 'Pilih Logo',
      filters: [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    const buf = fs.readFileSync(result.filePaths[0])
    const ext = path.extname(result.filePaths[0]).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const base64 = `data:image/${mime};base64,${buf.toString('base64')}`
    db.prepare(`UPDATE sekolah SET ${field}=? WHERE id=1`).run(base64)
    return base64
  })

  ipcMain.handle('sekolah:remove_logo', (_, field) => {
    db.prepare(`UPDATE sekolah SET ${field}=NULL WHERE id=1`).run()
    return true
  })


  // Generate No SKL otomatis untuk semua siswa
  ipcMain.handle('siswa:generate_no_skl', (_, { kode_sekolah, bulan_romawi, tahun, mulai_dari }) => {
    const jenjang = db.prepare('SELECT jenjang FROM sekolah WHERE id=1').get()?.jenjang || 'SMK'
    const kodeJenjang = {
      'SD': '421.2', 'MI': '421.2',
      'SMP': '421.3', 'MTs': '421.3',
      'SMA': '421.3', 'MA': '421.3',
      'SMK': '421.5',
    }[jenjang] || '421.5'

    const siswaList = db.prepare('SELECT id, no_urut FROM siswa ORDER BY no_urut ASC').all()
    const bulan = bulan_romawi || ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][new Date().getMonth()]
    const thn = tahun || new Date().getFullYear()
    const kode = kode_sekolah || 'SKL'
    let nomor = parseInt(mulai_dari) || 1

    const stmt = db.prepare('UPDATE siswa SET no_skl=? WHERE id=?')
    const run = db.transaction(() => {
      siswaList.forEach(s => {
        const noUrut = String(nomor).padStart(3, '0')
        const noSkl = \`\${kodeJenjang}/\${noUrut}/\${kode}/\${bulan}/\${thn}\`
        stmt.run(noSkl, s.id)
        nomor++
      })
    })
    run()
    return { ok: true, generated: siswaList.length }
  })

  // Update no_skl satu siswa
  ipcMain.handle('siswa:update_no_skl', (_, id, no_skl) => {
    db.prepare('UPDATE siswa SET no_skl=? WHERE id=?').run(no_skl, id)
    return true
  })


  // ── Upload foto siswa ──────────────────────────────────────────────────
  ipcMain.handle('siswa:upload_foto', async (_, siswaId) => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih Foto Siswa',
      filters: [{ name: 'Gambar', extensions: ['png','jpg','jpeg'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    const buf  = fs.readFileSync(result.filePaths[0])
    const ext  = path.extname(result.filePaths[0]).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const base64 = `data:image/${mime};base64,${buf.toString('base64')}`
    db.prepare('UPDATE siswa SET foto=? WHERE id=?').run(base64, siswaId)
    return base64
  })

  ipcMain.handle('siswa:remove_foto', (_, siswaId) => {
    db.prepare('UPDATE siswa SET foto=NULL WHERE id=?').run(siswaId)
    return true
  })

  // ── Import Excel siswa ─────────────────────────────────────────────────
  ipcMain.handle('siswa:import_excel', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih File Excel Data Siswa',
      filters: [{ name: 'Excel', extensions: ['xlsx','xls'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return { ok: false, message: 'Dibatalkan' }
    try {
      const XLSX = require('xlsx')
      const wb   = XLSX.readFile(result.filePaths[0])
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!rows.length) return { ok: false, message: 'File kosong atau format tidak dikenal' }

      // Normalize header (case-insensitive, strip spasi)
      const normalize = s => String(s).toLowerCase().replace(/\s+/g,'_')
      const normalizedRows = rows.map(r => {
        const n = {}
        Object.keys(r).forEach(k => { n[normalize(k)] = r[k] })
        return n
      })

      const mapField = (row, ...keys) => {
        for (const k of keys) {
          const v = row[normalize(k)] ?? row[k]
          if (v !== undefined && v !== '') return String(v).trim()
        }
        return ''
      }

      const stmt = db.prepare('INSERT INTO siswa(no_urut,nism,nisn,nama,jk,tempat_lahir,tgl_lahir,ortu,peserta_am,blanko,no_skl) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      let imported = 0, skipped = 0
      const tx = db.transaction(() => {
        normalizedRows.forEach((row, i) => {
          const nama = mapField(row,'nama','nama_lengkap','name')
          if (!nama) { skipped++; return }
          const no = parseInt(mapField(row,'no','no_urut','nomor')) || (i + 1)
          const jk = /^p/i.test(mapField(row,'jk','jenis_kelamin','gender')) ? 'Perempuan' : 'Laki-laki'
          stmt.run(no,
            mapField(row,'nism','nis','no_induk'),
            mapField(row,'nisn'),
            nama, jk,
            mapField(row,'tempat_lahir','tempat'),
            mapField(row,'tgl_lahir','tanggal_lahir','tgl_lahir'),
            mapField(row,'ortu','nama_ortu','orang_tua','nama_orang_tua'),
            mapField(row,'peserta_am','no_peserta','no_peserta_am'),
            mapField(row,'blanko','no_blanko','blanko_ijazah'),
            mapField(row,'no_skl','nomor_skl')
          )
          imported++
        })
      })
      tx()
      return { ok: true, imported, skipped, message: `${imported} siswa berhasil diimport${skipped ? ', '+skipped+' dilewati (tidak ada nama)' : ''}` }
    } catch (e) {
      return { ok: false, message: 'Gagal membaca file: ' + e.message }
    }
  })

  // ── Backup & Restore database ──────────────────────────────────────────
  ipcMain.handle('db:backup', async () => {
    const now    = new Date()
    const stamp  = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
    const result = await dialog.showSaveDialog({
      title: 'Simpan Backup Database',
      defaultPath: `SIM_Ijazah_Backup_${stamp}.db`,
      filters: [{ name: 'Database', extensions: ['db'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, message: 'Dibatalkan' }
    try {
      await db.backup(result.filePath)
      return { ok: true, path: result.filePath }
    } catch (e) { return { ok: false, message: e.message } }
  })

  ipcMain.handle('db:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih File Backup Database',
      filters: [{ name: 'Database', extensions: ['db'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return { ok: false, message: 'Dibatalkan' }
    try {
      // Tutup DB lama, copy file, buka ulang
      const backupPath = result.filePaths[0]
      db.close()
      fs.copyFileSync(backupPath, dbPath)
      const Database = require('better-sqlite3')
      db = new Database(dbPath)
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
      return { ok: true }
    } catch (e) { return { ok: false, message: e.message } }
  })

  // ── Cetak SK Penetapan Kelulusan ───────────────────────────────────────
  ipcMain.handle('pdf:sk_kelulusan', async () => {
    try {
      const data = getPDFData()
      const { generateSKKelulusan } = require('./pdf-generator')
      const filePath = generateSKKelulusan(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  // Misc
  ipcMain.handle('app:get_paths', () => ({ dbPath, outputPath }))
  ipcMain.handle('app:open_output', () => shell.openPath(outputPath))
  ipcMain.handle('stats:dashboard', () => ({
    siswa:    db.prepare('SELECT COUNT(*) c FROM siswa').get().c,
    mapel:    db.prepare('SELECT COUNT(*) c FROM mapel').get().c,
    nilai:    db.prepare('SELECT COUNT(*) c FROM nilai').get().c,
    angkatan: db.prepare('SELECT COUNT(*) c FROM angkatan').get().c,
  }))
}

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 1100, minHeight: 680,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#18181b', symbolColor: '#a1a1aa', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#f9fafb',
    show: false,
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.once('ready-to-show', () => win.show())
}

app.whenReady().then(() => {
  initDB(); registerIPC(); createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
