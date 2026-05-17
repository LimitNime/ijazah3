/**
 * PDF Generator — SKL 1 halaman, Nilai Ijazah 1 halaman per siswa
 * Export Excel per angkatan mirip format rekap_nilai.pdf
 */
const path = require('path')
const fs   = require('fs')

function fmtTgl(tgl) {
  if (!tgl) return '-'
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember']
  try {
    const d = new Date(tgl)
    if (isNaN(d)) return tgl
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`
  } catch { return tgl }
}

function fmtN(v, dec = 2) {
  if (v == null || v === '') return '-'
  const n = parseFloat(v)
  return isNaN(n) ? '-' : dec === 0 ? String(Math.round(n)) : n.toFixed(dec)
}

// ── Kop sekolah (1 baris saja, compact) ────────────────────────────────────
function drawKopCompact(doc, s) {
  const pw = doc.page.width
  const ml = 50, mr = 50
  let y = 30

  doc.moveTo(ml, y).lineTo(pw-mr, y).lineWidth(2.5).stroke('#000')
  doc.moveTo(ml, y+4).lineTo(pw-mr, y+4).lineWidth(0.8).stroke('#000')
  y += 10

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000')
    .text((s.nama||'').toUpperCase(), ml, y, { width: pw-ml-mr, align: 'center' })
  y += 16

  doc.font('Helvetica').fontSize(8.5)
    .text(`NSS: ${s.nss||'-'}   NPSN: ${s.npsn||'-'}   ${s.alamat||''}   Telp: ${s.telp||'-'}`, ml, y, { width: pw-ml-mr, align: 'center' })
  y += 12

  doc.moveTo(ml, y+2).lineTo(pw-mr, y+2).lineWidth(0.8).stroke('#000')
  doc.moveTo(ml, y+5).lineTo(pw-mr, y+5).lineWidth(2.5).stroke('#000')

  return y + 14
}

// ── SKL — 1 HALAMAN PER SISWA ──────────────────────────────────────────────
function generateSKL(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId }) {
  const PDFDocument = require('pdfkit')
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const filePath = path.join(outputPath, 'SKL_Kelulusan.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const ml = 50, mr = 50, pw = doc.page.width

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()

    let y = drawKopCompact(doc, s)

    // Judul
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
      .text('SURAT KETERANGAN LULUS', ml, y, { width: pw-ml-mr, align: 'center', underline: true })
    y += 16
    const noSkl = siswa.no_skl || '......................................................'
    doc.font('Helvetica').fontSize(9)
      .text(`Nomor : ${noSkl}`, ml, y)
    y += 14

    // Pembuka
    doc.font('Helvetica').fontSize(9.5)
      .text(`Yang bertanda tangan di bawah ini, Kepala ${s.nama||''} menerangkan bahwa :`, ml, y, { width: pw-ml-mr })
    y += 14

    // Biodata — compact
    const bio = [
      ['Nama',                       siswa.nama||''],
      ['Jenis Kelamin',              siswa.jk||''],
      ['Tempat dan tanggal lahir',   `${siswa.tempat_lahir||'-'}, ${siswa.tgl_lahir||'-'}`],
      ['Nama Orang Tua',             siswa.ortu||'-'],
      ['Nomor Induk Siswa',          siswa.nism||'-'],
      ['Nomor Induk Siswa Nasional', siswa.nisn||'-'],
    ]
    bio.forEach(([lbl, val]) => {
      doc.font('Helvetica').fontSize(9.5)
        .text(lbl,      ml+6,  y, { width: 155, continued: false })
        .text(':',      ml+162, y, { width: 8,   continued: false })
        .text(val,      ml+172, y, { width: pw-ml-mr-172, continued: false })
      y += 13
    })
    y += 6

    // Paragraf kelulusan
    const para = `Berdasarkan Peraturan Menteri Pendidikan, Kebudayaan, Riset dan Teknologi Nomor 58 Tahun 2024 tentang Ijazah Pendidikan Dasar dan Pendidikan Menengah Tahun Pelajaran ${s.tahun_ajaran||''} serta Surat Keputusan Kepala ${s.nama||''} Nomor : .............. Tanggal ${fmtTgl(s.tgl_lulus)} tentang Kelulusan Siswa, maka dengan ini siswa tersebut di atas dinyatakan :`
    doc.font('Helvetica').fontSize(9.5)
      .text(para, ml, y, { width: pw-ml-mr, align: 'justify' })
    y += doc.heightOfString(para, { width: pw-ml-mr, fontSize: 9.5 }) + 6

    doc.font('Helvetica-Bold').fontSize(12)
      .text('LULUS', ml, y, { width: pw-ml-mr, align: 'center', underline: true })
    y += 16
    doc.font('Helvetica').fontSize(9.5)
      .text(`dari ${s.jenjang||'SD/MI'} dengan nilai Ujian Sekolah (Nilai Ijazah) :`, ml, y, { width: pw-ml-mr, align: 'center' })
    y += 14

    // ── Tabel nilai — 2 kolom agar muat 1 halaman ──
    const mapelA = mapelList.filter(m => m.kelompok === 'A')
    const mapelB = mapelList.filter(m => m.kelompok === 'B')
    const allMapel = [...mapelA, ...mapelB]

    // Split jadi 2 kolom
    const half = Math.ceil(allMapel.length / 2)
    const col1 = allMapel.slice(0, half)
    const col2 = allMapel.slice(half)

    const colW = pw - ml - mr
    const halfW = (colW - 8) / 2
    const noW = 18, nilaiW = 36, namaW = halfW - noW - nilaiW

    function drawTblHdr(x, w) {
      doc.rect(x, y, w, 14).fill('#1D4ED8')
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
        .text('No', x+1, y+3, { width: noW-2, align: 'center' })
        .text('Mata Pelajaran', x+noW+2, y+3, { width: namaW-4 })
        .text('Nilai', x+noW+namaW+1, y+3, { width: nilaiW-2, align: 'center' })
      doc.fillColor('#000')
    }

    drawTblHdr(ml, halfW)
    drawTblHdr(ml + halfW + 8, halfW)
    y += 14

    const rowH = 13
    const maxRows = Math.max(col1.length, col2.length)

    for (let i = 0; i < maxRows; i++) {
      const bg = i % 2 === 0 ? '#fff' : '#F9FAFB'

      // Kolom kiri
      if (col1[i]) {
        const m = col1[i]
        const nr = (nilaiData[siswa.id]||[]).find(n => n.mapel_id===m.id && n.semester_id===ujianSemId)
        const val = nr ? fmtN(nr.nilai_ujian, 0) : '-'
        doc.rect(ml, y, halfW, rowH).fill(bg).stroke('#E5E7EB')
        doc.fillColor('#111').font('Helvetica').fontSize(8)
          .text(String(i+1), ml+1, y+2, { width: noW-2, align: 'center' })
          .text(m.nama, ml+noW+2, y+2, { width: namaW-4 })
        doc.font('Helvetica-Bold').text(val, ml+noW+namaW+1, y+2, { width: nilaiW-2, align: 'center' })
        doc.fillColor('#000')
      }

      // Kolom kanan
      const x2 = ml + halfW + 8
      if (col2[i]) {
        const m = col2[i]
        const nr = (nilaiData[siswa.id]||[]).find(n => n.mapel_id===m.id && n.semester_id===ujianSemId)
        const val = nr ? fmtN(nr.nilai_ujian, 0) : '-'
        doc.rect(x2, y, halfW, rowH).fill(bg).stroke('#E5E7EB')
        doc.fillColor('#111').font('Helvetica').fontSize(8)
          .text(String(half+i+1), x2+1, y+2, { width: noW-2, align: 'center' })
          .text(m.nama, x2+noW+2, y+2, { width: namaW-4 })
        doc.font('Helvetica-Bold').text(val, x2+noW+namaW+1, y+2, { width: nilaiW-2, align: 'center' })
        doc.fillColor('#000')
      }
      y += rowH
    }

    // Rata-rata
    const ujianVals = allMapel.map(m => {
      const nr = (nilaiData[siswa.id]||[]).find(n => n.mapel_id===m.id && n.semester_id===ujianSemId)
      return nr && nr.nilai_ujian != null ? parseFloat(nr.nilai_ujian) : null
    }).filter(v => v != null)
    const avg = ujianVals.length ? (ujianVals.reduce((a,b)=>a+b,0)/ujianVals.length).toFixed(2) : '-'

    doc.rect(ml, y, halfW*2+8, 15).fill('#DBEAFE').stroke('#93C5FD')
    doc.fillColor('#1E3A8A').font('Helvetica-Bold').fontSize(9)
      .text('RATA-RATA NILAI IJAZAH', ml+2, y+3, { width: halfW*2+8-nilaiW-6 })
      .text(avg, ml+halfW*2+8-nilaiW-2, y+3, { width: nilaiW, align: 'center' })
    doc.fillColor('#000')
    y += 22

    // Penutup + TTD
    doc.font('Helvetica').fontSize(9)
      .text('Demikianlah surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.', ml, y, { width: pw-ml-mr })
    y += 20

    const kota = s.kota || ''
    const tglLulus = fmtTgl(s.tgl_lulus)
    doc.font('Helvetica').fontSize(9.5)
      .text(`${kota}, ${tglLulus}`, ml, y, { width: 200 })
      .text(`${kota}, ${tglLulus}`, pw-mr-200, y, { width: 200, align: 'center' })
    y += 12
    doc.text(`Kepala ${s.nama||''}`, pw-mr-200, y, { width: 200, align: 'center' })
    y += 50
    doc.font('Helvetica-Bold').fontSize(9.5)
      .text(s.kepala||'', pw-mr-200, y, { width: 200, align: 'center', underline: true })
    y += 12
    doc.font('Helvetica').fontSize(9)
      .text(`NIP. ${s.nip||''}`, pw-mr-200, y, { width: 200, align: 'center' })
  })

  doc.end()
  return filePath
}

// ── NILAI IJAZAH — 1 HALAMAN PER SISWA ─────────────────────────────────────
function generateNilaiIjazah(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const PDFDocument = require('pdfkit')
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const filePath = path.join(outputPath, 'Nilai_Ijazah_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const ml = 50, mr = 50, pw = doc.page.width

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()
    let y = drawKopCompact(doc, s)

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000')
      .text('NILAI IJAZAH', ml, y, { width: pw-ml-mr, align: 'center' })
    y += 16
    doc.font('Helvetica').fontSize(9.5)
      .text(`Tahun Pelajaran ${s.tahun_ajaran||''}`, ml, y, { width: pw-ml-mr, align: 'center' })
    y += 14

    // Biodata compact
    const bio = [
      ['Nama',                   siswa.nama||''],
      ['NISN / NISM',            `${siswa.nisn||'-'}  /  ${siswa.nism||'-'}`],
      ['Tempat / Tgl Lahir',     `${siswa.tempat_lahir||'-'}, ${siswa.tgl_lahir||'-'}`],
      ['Nama Orang Tua',         siswa.ortu||'-'],
      ['No Peserta / Blanko',    `${siswa.peserta_am||'-'}  /  ${siswa.blanko||'-'}`],
    ]
    bio.forEach(([lbl, val]) => {
      doc.font('Helvetica').fontSize(9.5).fillColor('#000')
        .text(lbl, ml+6, y, { width: 130 })
        .text(':', ml+138, y, { width: 8 })
        .text(val, ml+148, y, { width: pw-ml-mr-148 })
      y += 13
    })
    y += 8

    // Tabel 2 kolom agar muat 1 halaman
    const mapelA = mapelList.filter(m => m.kelompok === 'A')
    const mapelB = mapelList.filter(m => m.kelompok === 'B')
    const allMapel = [...mapelA, ...mapelB]
    const half = Math.ceil(allMapel.length / 2)
    const col1 = allMapel.slice(0, half)
    const col2 = allMapel.slice(half)

    const colW = pw - ml - mr
    const halfW = (colW - 8) / 2
    const noW = 18, nijW = 40, namaW = halfW - noW - nijW

    function calcNij(sid, mid) {
      const nils = nilaiData[sid] || []
      const raps = nils.filter(n => raportSemIds.includes(n.semester_id) && n.nilai_p != null && n.nilai_k != null)
      if (!raps.length) return null
      const raport = raps.reduce((a,r) => a + (parseFloat(r.nilai_p)+parseFloat(r.nilai_k))/2, 0) / raps.length
      const um = nils.find(n => n.semester_id === ujianSemId && n.nilai_ujian != null)
      if (!um) return null
      return (raport * br + parseFloat(um.nilai_ujian) * bu) / totalB
    }

    function drawHdr2(x, w) {
      doc.rect(x, y, w, 15).fill('#1D4ED8')
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
        .text('No', x+1, y+3, { width: noW-2, align: 'center' })
        .text('Mata Pelajaran', x+noW+2, y+3, { width: namaW-4 })
        .text('Nilai Ijazah', x+noW+namaW+1, y+3, { width: nijW-2, align: 'center' })
      doc.fillColor('#000')
    }

    drawHdr2(ml, halfW)
    drawHdr2(ml+halfW+8, halfW)
    y += 15

    const rowH = 13
    const maxRows = Math.max(col1.length, col2.length)
    let allNij = []

    for (let i = 0; i < maxRows; i++) {
      const bg = i % 2 === 0 ? '#fff' : '#F9FAFB'

      if (col1[i]) {
        const m = col1[i]
        const nij = calcNij(siswa.id, m.id)
        if (nij) allNij.push(nij)
        doc.rect(ml, y, halfW, rowH).fill(bg).stroke('#E5E7EB')
        doc.fillColor('#111').font('Helvetica').fontSize(8)
          .text(String(i+1), ml+1, y+2, { width: noW-2, align: 'center' })
          .text(m.nama, ml+noW+2, y+2, { width: namaW-4 })
        doc.font('Helvetica-Bold').text(nij != null ? nij.toFixed(2) : '-', ml+noW+namaW+1, y+2, { width: nijW-2, align: 'center' })
        doc.fillColor('#000')
      }

      const x2 = ml+halfW+8
      if (col2[i]) {
        const m = col2[i]
        const nij = calcNij(siswa.id, m.id)
        if (nij) allNij.push(nij)
        doc.rect(x2, y, halfW, rowH).fill(bg).stroke('#E5E7EB')
        doc.fillColor('#111').font('Helvetica').fontSize(8)
          .text(String(half+i+1), x2+1, y+2, { width: noW-2, align: 'center' })
          .text(m.nazwa||m.nama, x2+noW+2, y+2, { width: namaW-4 })
        doc.font('Helvetica-Bold').text(nij != null ? nij.toFixed(2) : '-', x2+noW+namaW+1, y+2, { width: nijW-2, align: 'center' })
        doc.fillColor('#000')
      }
      y += rowH
    }

    // Rata-rata
    const rata = allNij.length ? (allNij.reduce((a,b)=>a+b,0)/allNij.length).toFixed(2) : '-'
    doc.rect(ml, y, halfW*2+8, 16).fill('#DBEAFE').stroke('#93C5FD')
    doc.fillColor('#1E3A8A').font('Helvetica-Bold').fontSize(9.5)
      .text('RATA-RATA NILAI IJAZAH', ml+4, y+3, { width: halfW*2+8-nijW-10 })
      .text(rata, ml+halfW*2+8-nijW-2, y+3, { width: nijW, align: 'center' })
    doc.fillColor('#000')
    y += 24

    // TTD
    const tgl = fmtTgl(s.tgl_lulus)
    doc.font('Helvetica').fontSize(9.5)
      .text(`${s.kota||''}, ${tgl}`, pw-mr-200, y, { width: 200, align: 'center' })
    y += 12
    doc.text(`Kepala ${s.nama||''}`, pw-mr-200, y, { width: 200, align: 'center' })
    y += 48
    doc.font('Helvetica-Bold').fontSize(9.5)
      .text(s.kepala||'', pw-mr-200, y, { width: 200, align: 'center', underline: true })
    y += 12
    doc.font('Helvetica').fontSize(9)
      .text(`NIP. ${s.nip||''}`, pw-mr-200, y, { width: 200, align: 'center' })

    // Foto siswa (pojok kiri bawah sejajar TTD)
    const fotoY2 = y - 78, fotoX2 = ml, fotoW2 = 38, fotoH2 = 48
    doc.save().dash(2,{space:2}).rect(fotoX2,fotoY2,fotoW2,fotoH2).stroke('#999').undash().restore()
    if (siswa.foto) {
      try { doc.image(siswa.foto, fotoX2+1, fotoY2+1, { fit:[fotoW2-2,fotoH2-2] }) }
      catch(_) { doc.fontSize(5).fillColor('#aaa').text('Foto
Tidak Valid',fotoX2+2,fotoY2+16,{width:fotoW2-4,align:'center'}) }
    } else {
      doc.fontSize(5).fillColor('#aaa').text('Pasfoto
3x4 cm',fotoX2+2,fotoY2+18,{width:fotoW2-4,align:'center'})
    }
    doc.fillColor('#000')
  })

  doc.end()
  return filePath
}

// ── DKN landscape ──────────────────────────────────────────────────────────
function generateDKN(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const PDFDocument = require('pdfkit')
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
  const filePath = path.join(outputPath, 'DKN_Lengkap.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const ml = 25, mr = 25, pw = doc.page.width, ph = doc.page.height

  doc.rect(0, 0, pw, 44).fill('#0F172A')
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13)
    .text('DAFTAR KUMPULAN NILAI (DKN)', ml, 8, { width: pw-ml-mr, align: 'center' })
  doc.font('Helvetica').fontSize(9)
    .text(`${s.nama||''}  —  Tahun Ajaran ${s.tahun_ajaran||''}`, ml, 26, { width: pw-ml-mr, align: 'center' })
  doc.fillColor('#000')

  let y = 50
  const n = mapelList.length
  const usW = pw-ml-mr
  const noW = 22, namaW = 110, nisnW = 72, rataW = 46
  const mW = Math.max(28, (usW-noW-namaW-nisnW-rataW)/Math.max(n,1))

  // Header
  doc.rect(ml, y, usW, 18).fill('#1D4ED8')
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(6.5)
  let xh = ml
  for (const [t, w] of [['No',noW],['Nama Siswa',namaW],['NISN',nisnW]]) {
    doc.text(t, xh+1, y+5, { width: w-2, align: 'center' }); xh += w
  }
  mapelList.forEach(m => {
    const s = m.nama.length > 9 ? m.nama.slice(0,8)+'.' : m.nama
    doc.text(s, xh+1, y+3, { width: mW-2, align: 'center' }); xh += mW
  })
  doc.text('Rata', xh+1, y+5, { width: rataW-2, align: 'center' })
  doc.fillColor('#000')
  y += 18

  siswaList.forEach((siswa, i) => {
    if (y > ph-30) { doc.addPage(); y = 20 }
    const bg = i%2===0?'#fff':'#F9FAFB'
    doc.rect(ml, y, usW, 14).fill(bg).stroke('#E5E7EB')
    doc.fillColor('#111').font('Helvetica').fontSize(6.5)
    let x = ml
    doc.text(String(siswa.no_urut||i+1), x+1, y+3, { width: noW-2, align: 'center' }); x += noW
    doc.font('Helvetica-Bold').text(siswa.nama||'', x+2, y+3, { width: namaW-4 }); x += namaW
    doc.font('Helvetica').text(siswa.nisn||'-', x+1, y+3, { width: nisnW-2, align: 'center' }); x += nisnW

    let sumNij=0, cntNij=0
    mapelList.forEach(m => {
      const nils = nilaiData[siswa.id]||[]
      const raps = nils.filter(n => raportSemIds.includes(n.semester_id) && n.nilai_p!=null && n.nilai_k!=null)
      let nij = null
      if (raps.length>0) {
        const raport = raps.reduce((a,r)=>a+(parseFloat(r.nilai_p)+parseFloat(r.nilai_k))/2,0)/raps.length
        const um = nils.find(n=>n.semester_id===ujianSemId && n.nilai_ujian!=null)
        if (um) { nij=(raport*br+parseFloat(um.nilai_ujian)*bu)/totalB; sumNij+=nij; cntNij++ }
      }
      doc.text(nij!=null?nij.toFixed(1):'-', x+1, y+3, { width: mW-2, align: 'center' }); x+=mW
    })
    const rata = cntNij>0?(sumNij/cntNij).toFixed(2):'-'
    doc.font('Helvetica-Bold').text(rata, x+1, y+3, { width: rataW-2, align: 'center' })
    doc.fillColor('#000')
    y += 14
  })

  doc.font('Helvetica').fontSize(7).fillColor('#9CA3AF')
    .text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, ml, ph-16, { width: pw-ml-mr, align: 'center' })
  doc.end()
  return filePath
}

// ── EXPORT EXCEL PER ANGKATAN (mirip format rekap_nilai.pdf) ───────────────
function exportExcelAngkatan(outputPath, { sekolah: s, angkatan, siswaList, mapelList, semList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const XLSX = require('xlsx')

  const wb = XLSX.utils.book_new()
  const raportSems = semList.filter(sm => raportSemIds.includes(sm.id))
  const nSem = raportSems.length

  // ── Sheet 1: REKAP AKHIR (mirip halaman terakhir PDF) ──────────────────
  const rekapRows = []

  // Header baris 1
  const hdr1 = ['NO', 'NAMA SISWA']
  mapelList.forEach(m => { hdr1.push(m.nama); for(let i=1;i<nSem;i++) hdr1.push('') })
  hdr1.push('JUMLAH', 'RATA-RATA')
  rekapRows.push(hdr1)

  // Header baris 2: sub-header semester
  const hdr2 = ['', '']
  mapelList.forEach(() => {
    raportSems.forEach((sm, i) => hdr2.push(`SMT ${i+1}`))
  })
  hdr2.push('', '')
  rekapRows.push(hdr2)

  // Data siswa
  siswaList.forEach((siswa, i) => {
    const row = [i+1, siswa.nama||'']
    const nils = nilaiData[siswa.id] || []
    let jumlah = 0, cnt = 0

    mapelList.forEach(m => {
      raportSems.forEach(sm => {
        const n = nils.find(n => n.mapel_id===m.id && n.semester_id===sm.id)
        if (n && n.nilai_p!=null && n.nilai_k!=null) {
          const avg = (parseFloat(n.nilai_p)+parseFloat(n.nilai_k))/2
          row.push(parseFloat(avg.toFixed(2))); jumlah+=avg; cnt++
        } else {
          row.push('')
        }
      })
    })

    row.push(cnt>0 ? parseFloat(jumlah.toFixed(2)) : '')
    row.push(cnt>0 ? parseFloat((jumlah/cnt).toFixed(2)) : '')
    rekapRows.push(row)
  })

  const wsRekap = XLSX.utils.aoa_to_sheet(rekapRows)

  // Merge header mapel
  if (!wsRekap['!merges']) wsRekap['!merges'] = []
  let col = 2
  mapelList.forEach(m => {
    if (nSem > 1) {
      wsRekap['!merges'].push({ s:{r:0,c:col}, e:{r:0,c:col+nSem-1} })
    }
    col += nSem
  })

  // Lebar kolom
  const wscols = [{ wch:5 }, { wch:30 }]
  mapelList.forEach(() => { raportSems.forEach(() => wscols.push({ wch:8 })) })
  wscols.push({ wch:10 }, { wch:12 })
  wsRekap['!cols'] = wscols
  wsRekap['!freeze'] = { xSplit: 2, ySplit: 2 }

  XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Nilai')

  // ── Sheet 2: PER MAPEL (satu sheet tiap mapel, mirip halaman 6-18 PDF) ──
  mapelList.forEach(m => {
    const rows = []

    // Header
    const hm = ['NO', 'NAMA']
    raportSems.forEach((sm, i) => hm.push(`SMT ${i+1}`))
    hm.push('Rata Raport', 'Nilai UM', 'Nilai Ijazah')
    rows.push(hm)

    siswaList.forEach((siswa, i) => {
      const row = [i+1, siswa.nama||'']
      const nils = nilaiData[siswa.id]||[]
      const raps = []

      raportSems.forEach(sm => {
        const n = nils.find(n => n.mapel_id===m.id && n.semester_id===sm.id)
        if (n && n.nilai_p!=null && n.nilai_k!=null) {
          const avg = (parseFloat(n.nilai_p)+parseFloat(n.nilai_k))/2
          row.push(parseFloat(avg.toFixed(2))); raps.push(avg)
        } else { row.push('') }
      })

      const rataRap = raps.length ? raps.reduce((a,b)=>a+b,0)/raps.length : null
      const umRow = nils.find(n => n.mapel_id===m.id && n.semester_id===ujianSemId)
      const um = umRow && umRow.nilai_ujian!=null ? parseFloat(umRow.nilai_ujian) : null
      const nij = rataRap!=null && um!=null ? (rataRap*br+um*bu)/totalB : null

      row.push(rataRap!=null ? parseFloat(rataRap.toFixed(2)) : '')
      row.push(um!=null ? um : '')
      row.push(nij!=null ? parseFloat(nij.toFixed(2)) : '')
      rows.push(row)
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wc = [{ wch:5 }, { wch:30 }]
    raportSems.forEach(() => wc.push({ wch:8 }))
    wc.push({ wch:12 }, { wch:10 }, { wch:12 })
    ws['!cols'] = wc
    ws['!freeze'] = { xSplit: 2, ySplit: 1 }

    // Nama sheet maks 31 karakter
    const sheetName = m.nama.length > 28 ? m.nama.slice(0,28)+'.' : m.nama
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })

  // ── Sheet 3: REKAP NILAI IJAZAH ────────────────────────────────────────
  const nijRows = [['NO', 'NAMA SISWA', 'NISN', ...mapelList.map(m=>m.nama), 'RATA-RATA']]
  siswaList.forEach((siswa, i) => {
    const row = [i+1, siswa.nama||'', siswa.nisn||'-']
    const nils = nilaiData[siswa.id]||[]
    let sum=0, cnt=0
    mapelList.forEach(m => {
      const raps = nils.filter(n=>raportSemIds.includes(n.semester_id)&&n.nilai_p!=null&&n.nilai_k!=null)
      const raport = raps.length ? raps.reduce((a,r)=>a+(parseFloat(r.nilai_p)+parseFloat(r.nilai_k))/2,0)/raps.length : null
      const um = nils.find(n=>n.mapel_id===m.id&&n.semester_id===ujianSemId&&n.nilai_ujian!=null)
      const nij = raport!=null&&um ? (raport*br+parseFloat(um.nilai_ujian)*bu)/totalB : null
      row.push(nij!=null ? parseFloat(nij.toFixed(2)) : '')
      if (nij) { sum+=nij; cnt++ }
    })
    row.push(cnt>0 ? parseFloat((sum/cnt).toFixed(2)) : '')
    nijRows.push(row)
  })

  const wsNij = XLSX.utils.aoa_to_sheet(nijRows)
  const wcNij = [{ wch:5 }, { wch:30 }, { wch:16 }, ...mapelList.map(()=>({ wch:10 })), { wch:12 }]
  wsNij['!cols'] = wcNij
  wsNij['!freeze'] = { xSplit: 3, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsNij, 'Nilai Ijazah')

  const fname = `Nilai_Angkatan_${(angkatan?.nama||'').replace(/[^a-zA-Z0-9]/g,'_')}_${Date.now()}.xlsx`
  const filePath = path.join(outputPath, fname)
  XLSX.writeFile(wb, filePath)
  return filePath
}


// ══════════════════════════════════════════════════════════════════════════
//  IJAZAH — 1 halaman per siswa (format resmi Kemdikbud)
// ══════════════════════════════════════════════════════════════════════════
function generateIjazah(outputPath, { sekolah: s, siswaList }) {
  const PDFDocument = require('pdfkit')
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const filePath = path.join(outputPath, 'Ijazah_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const ml = 28, mr = 28, pw = doc.page.width, ph = doc.page.height

  function dotLine(x, y, w) {
    doc.save().dash(1, { space: 2 }).moveTo(x, y).lineTo(x + w, y).stroke('#999').undash().restore()
  }

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()
    const cw = pw - ml - mr

    // Border ganda
    doc.rect(8, 8, pw - 16, ph - 16).lineWidth(2).stroke('#000')
    doc.rect(11, 11, pw - 22, ph - 22).lineWidth(0.5).stroke('#000')

    let y = 22

    // No. Ijazah pojok kanan
    doc.font('Helvetica').fontSize(8).fillColor('#000')
      .text(`No. Ijazah: ${siswa.blanko || '...........................'}`, ml, y, { width: cw, align: 'right' })

    y += 10

    // Logo Kemdikbud kiri
    if (s.logo_kemdikbud) {
      try { doc.image(s.logo_kemdikbud, ml, y, { width: 24, height: 24, fit: [24,24] }) }
      catch (_) { doc.rect(ml, y, 24, 24).lineWidth(0.3).stroke('#ccc') }
    } else {
      doc.rect(ml, y, 24, 24).lineWidth(0.5).stroke('#aaa')
      doc.fontSize(5).fillColor('#aaa').text('LOGO\nKEMDIKBUD', ml+1, y+7, { width:22, align:'center' })
    }

    // Logo Garuda / Sekolah tengah
    if (s.logo_sekolah) {
      try { doc.image(s.logo_sekolah, pw/2 - 12, y, { width: 24, height: 24, fit: [24,24] }) }
      catch (_) { doc.rect(pw/2-12, y, 24, 24).lineWidth(0.3).stroke('#ccc') }
    } else {
      doc.rect(pw/2-12, y, 24, 24).lineWidth(0.5).stroke('#aaa')
      doc.fontSize(5).fillColor('#aaa').text('LOGO\nSEKOLAH', pw/2-11, y+7, { width:22, align:'center' })
    }

    doc.fillColor('#000')
    y += 28

    // Nomenklatur
    doc.font('Helvetica-Bold').fontSize(7.5)
      .text('NOMENKLATUR KEMENTERIAN YANG MENYELENGGARAKAN', ml, y, { width: cw, align: 'center' })
    y += 9
    doc.text('URUSAN PEMERINTAHAN DI BIDANG PENDIDIKAN.', ml, y, { width: cw, align: 'center' })
    y += 14

    // Judul
    doc.font('Helvetica-Bold').fontSize(22)
      .text('IJAZAH', ml, y, { width: cw, align: 'center' })
    y += 26

    // Nama sekolah (garis titik-titik)
    dotLine(ml, y + 3, cw)
    doc.font('Helvetica-Bold').fontSize(10)
      .text((s.nama || '').toUpperCase(), ml, y - 1, { width: cw, align: 'center' })
    y += 10

    doc.font('Helvetica').fontSize(9.5)
      .text(`TAHUN AJARAN ${s.tahun_ajaran || '......./......'}`, ml, y, { width: cw, align: 'center' })
    y += 14

    doc.text('Dengan ini menyatakan bahwa:', ml, y, { width: cw, align: 'center' })
    y += 18

    // Watermark lingkaran
    doc.save().opacity(0.08).circle(pw / 2, y + 22, 52).lineWidth(1).stroke('#000').opacity(1).restore()

    // Nama siswa
    dotLine(ml, y + 3, cw)
    doc.font('Helvetica-Bold').fontSize(13)
      .text((siswa.nama || '').toUpperCase(), ml, y - 1, { width: cw, align: 'center' })
    y += 12

    const lx = ml + 4, cx = ml + 116, vx = ml + 120, vw = cw - 120

    function bioRow(label, value) {
      doc.font('Helvetica').fontSize(9.5).fillColor('#000')
        .text(label, lx, y, { width: 110 })
        .text(':', cx, y, { width: 6 })
      dotLine(vx, y + 3, vw)
      if (value) doc.text(value, vx + 2, y, { width: vw - 4 })
      y += 10
    }

    bioRow('tempat, tanggal lahir', `${siswa.tempat_lahir || '-'}, ${fmtTgl(siswa.tgl_lahir)}`)
    bioRow('Nomor Induk Siswa Nasional', siswa.nisn || '-')
    y += 10

    // LULUS
    doc.font('Helvetica-Bold').fontSize(17)
      .text('L U L U S', ml, y, { width: cw, align: 'center' })
    y += 16

    doc.font('Helvetica').fontSize(9.5)
      .text('dari,', ml, y, { width: cw, align: 'center' })
    y += 10

    bioRow('satuan pendidikan', s.nama || '-')
    bioRow('Nomor Pokok Sekolah Nasional', s.npsn || '-')
    y += 6

    const keputusan = s.keputusan_kepala || 'Kepala Dinas Pendidikan'
    const noSk = s.no_sk || '............................................'
    const tglSk = fmtTgl(s.tgl_lulus)
    doc.font('Helvetica').fontSize(9)
      .text(`berdasarkan Keputusan Kepala ${keputusan}`, lx, y, { width: cw - 8 })
    y += 11
    doc.text(`Nomor  ${noSk}  tanggal  ${tglSk}  setelah memenuhi`, lx, y, { width: cw - 8 })
    y += 11
    doc.text('seluruh kriteria sesuai dengan peraturan perundang-undangan.', lx, y, { width: cw - 8 })
    y += 22

    // Pasfoto box
    const fotoX = pw / 2 - 55, fotoY = y, fotoW = 32, fotoH = 40
    doc.save().dash(3, { space: 3 }).rect(fotoX, fotoY, fotoW, fotoH).stroke('#888').undash().restore()
    if (siswa.foto) {
      try { doc.image(siswa.foto, fotoX+1, fotoY+1, { fit:[fotoW-2, fotoH-2] }) }
      catch(_) {
        doc.font('Helvetica').fontSize(6).fillColor('#aaa').text('Foto\nTidak Valid', fotoX+1, fotoY+14, { width:fotoW-2, align:'center' })
      }
    } else {
      doc.font('Helvetica').fontSize(6).fillColor('#888')
        .text('pasfoto\n3x4 cm\nhitam putih\natau\nberwarna', fotoX + 1, fotoY + 8, { width: fotoW - 2, align: 'center' })
    }
    doc.fillColor('#000')

    // TTD Kepala
    const tx = pw / 2 + 10, tw2 = cw / 2 - 15
    doc.font('Helvetica').fontSize(9.5)
      .text(`${s.kota || 'Bogor'}, ${fmtTgl(s.tgl_lulus)}`, tx, y, { width: tw2, align: 'center' })
    y += 12
    doc.text('Kepala,', tx, y, { width: tw2, align: 'center' })
    y += 42
    dotLine(tx, y + 6, tw2)
    doc.font('Helvetica-Bold').fontSize(9)
      .text(s.kepala || '................................', tx, y + 2, { width: tw2, align: 'center', underline: true })
    doc.font('Helvetica').fontSize(8.5)
      .text(`NIP ${s.nip || '-'}`, tx, y + 13, { width: tw2, align: 'center' })
  })

  doc.end()
  return filePath
}

// ══════════════════════════════════════════════════════════════════════════
//  TRANSKRIP NILAI — 1 halaman per siswa (format SMK Kurikulum 2013/2018)
// ══════════════════════════════════════════════════════════════════════════
function generateTranskrip(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId, raportSemIds }) {
  const PDFDocument = require('pdfkit')
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const filePath = path.join(outputPath, 'Transkrip_Nilai_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const ml = 28, mr = 28, pw = doc.page.width
  const cw = pw - ml - mr

  function dotLine(x, y, w) {
    doc.save().dash(1, { space: 2 }).moveTo(x, y).lineTo(x + w, y).stroke('#999').undash().restore()
  }

  // Hitung rata-rata nilai per siswa per mapel (raport + ujian)
  function getAvgNilai(siswaId, mapelId) {
    const nils = nilaiData[siswaId] || []
    const raps = nils.filter(n => raportSemIds.includes(n.semester_id) && n.nilai_p != null && n.nilai_k != null)
    const raport = raps.length
      ? raps.reduce((a, r) => a + (parseFloat(r.nilai_p) + parseFloat(r.nilai_k)) / 2, 0) / raps.length
      : null
    const um = nils.find(n => n.semester_id === ujianSemId && n.nilai_ujian != null)
    if (raport == null && !um) return null
    if (raport == null) return parseFloat(um.nilai_ujian)
    if (!um) return raport
    return (raport * 60 + parseFloat(um.nilai_ujian) * 40) / 100
  }

  // Kelompokan mapel
  const grpA  = mapelList.filter(m => m.kelompok === 'A')
  const grpB  = mapelList.filter(m => m.kelompok === 'B')
  const grpC  = mapelList.filter(m => m.kelompok === 'C')
  const grpC1 = mapelList.filter(m => m.kelompok === 'C1')
  const grpC2 = mapelList.filter(m => m.kelompok === 'C2')
  const grpC3 = mapelList.filter(m => m.kelompok === 'C3')

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()
    let y = 20

    // ── KOP ──
    // Logo sekolah
    if (s.logo_sekolah) {
      try { doc.image(s.logo_sekolah, ml, y, { width: 24, height: 24, fit: [24,24] }) }
      catch (_) { doc.rect(ml, y, 24, 24).lineWidth(0.3).stroke('#ccc') }
    } else {
      doc.rect(ml, y, 24, 24).lineWidth(0.5).stroke('#aaa')
      doc.font('Helvetica').fontSize(5).fillColor('#aaa').text('LOGO\nSEKOLAH', ml+1, y+7, { width:22, align:'center' })
    }
    doc.fillColor('#000')

    doc.font('Helvetica-Bold').fontSize(8)
      .text('KOP SATUAN PENDIDIKAN', ml + 28, y, { width: cw - 28, align: 'center' })
    doc.font('Helvetica-Bold').fontSize(10)
      .text((s.nama || '').toUpperCase(), ml + 28, y + 10, { width: cw - 28, align: 'center' })
    doc.font('Helvetica').fontSize(7.5)
      .text(`NPSN: ${s.npsn || '-'}   ${s.alamat || ''}`, ml + 28, y + 22, { width: cw - 28, align: 'center' })

    y += 30
    doc.moveTo(ml, y).lineTo(ml + cw, y).lineWidth(2).stroke('#000')
    doc.moveTo(ml, y + 2.5).lineTo(ml + cw, y + 2.5).lineWidth(0.4).stroke('#000')
    y += 10

    // Judul
    doc.font('Helvetica-Bold').fontSize(13)
      .text('TRANSKRIP NILAI', ml, y, { width: cw, align: 'center' })
    y += 14
    doc.font('Helvetica').fontSize(9)
      .text(`Nomor : ${siswa.blanko || '...................................................'}`, ml, y)
    y += 12

    // Biodata
    const lx = ml, cx = ml + 70, vx = ml + 74, vw = cw - 74

    function bioRow(label, value) {
      doc.font('Helvetica').fontSize(9).fillColor('#000')
        .text(label, lx, y, { width: 68 })
        .text(':', cx, y, { width: 5 })
      dotLine(vx, y + 3, vw)
      if (value) doc.text(value, vx + 2, y, { width: vw - 4 })
      y += 8
    }

    bioRow('Satuan Pendidikan',             s.nama || '-')
    bioRow('Nomor Pokok Sekolah Nasional',  s.npsn || '-')
    bioRow('Nama lengkap',                  siswa.nama || '-')
    bioRow('Tempat, Tanggal Lahir',         `${siswa.tempat_lahir || '-'}, ${fmtTgl(siswa.tgl_lahir)}`)
    bioRow('Nomor Induk Siswa Nasional',    siswa.nisn || '-')
    bioRow('Nomor Ijazah',                  siswa.blanko || '-')
    bioRow('Tanggal Kelulusan',             fmtTgl(s.tgl_lulus))

    y += 2
    bioRow('Program Keahlian',    s.program_keahlian    || '-')
    bioRow('Kompetensi Keahlian', s.kompetensi_keahlian || '-')
    y += 4

    // ── TABEL NILAI ──
    const noW  = 14, nilW = 24, namaW = cw - noW - nilW
    const rowH = 7

    function tblHeader() {
      doc.rect(ml, y, cw, rowH + 2).fill('#1D4ED8')
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
        .text('No', ml + 1, y + 1, { width: noW - 2, align: 'center' })
        .text('Mata Pelajaran', ml + noW + 2, y + 1, { width: namaW - 4 })
        .text('Nilai', ml + noW + namaW + 1, y + 1, { width: nilW - 2, align: 'center' })
      doc.fillColor('#000')
      y += rowH + 2
    }

    function sectionRow(label) {
      doc.rect(ml, y, cw, rowH + 1).fill('#EFF6FF').stroke('#BFDBFE')
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1E40AF')
        .text(label, ml + noW + 2, y + 1, { width: namaW + noW - 4 })
      doc.fillColor('#000')
      y += rowH + 1
    }

    function dataRow(no, nama, nilaiVal, i) {
      const bg = i % 2 === 0 ? '#fff' : '#F9FAFB'
      doc.rect(ml, y, cw, rowH).fill(bg).stroke('#E5E7EB')
      doc.font('Helvetica').fontSize(7.5).fillColor('#111')
        .text(no, ml + 1, y + 1, { width: noW - 2, align: 'center' })
        .text(nama, ml + noW + 2, y + 1, { width: namaW - 4 })
      if (nilaiVal != null) {
        doc.font('Helvetica-Bold')
          .text(fmtN(nilaiVal, 2), ml + noW + namaW + 1, y + 1, { width: nilW - 2, align: 'center' })
      }
      doc.fillColor('#000')
      y += rowH
    }

    tblHeader()
    let allNilai = []

    // Kelompok A
    if (grpA.length) {
      sectionRow('A   Muatan Nasional')
      grpA.forEach((m, i) => {
        const v = getAvgNilai(siswa.id, m.id)
        if (v != null) allNilai.push(v)
        dataRow(`${i + 1}.`, m.nama, v, i)
      })
    }

    // Kelompok B
    if (grpB.length) {
      sectionRow('B   Muatan Kewilayahan')
      grpB.forEach((m, i) => {
        const v = getAvgNilai(siswa.id, m.id)
        if (v != null) allNilai.push(v)
        dataRow(`${i + 1}.`, m.nama, v, i)
      })
    }

    // Kelompok C
    const hasC = grpC.length || grpC1.length || grpC2.length || grpC3.length
    if (hasC) {
      sectionRow('C   Muatan Peminatan Kejuruan')
      if (grpC1.length) {
        sectionRow('C1.  Dasar Bidang Keahlian')
        grpC1.forEach((m, i) => {
          const v = getAvgNilai(siswa.id, m.id)
          if (v != null) allNilai.push(v)
          dataRow(`${i + 1}.`, m.nama, v, i)
        })
      }
      if (grpC2.length) {
        sectionRow('C2.  Dasar Program Keahlian')
        grpC2.forEach((m, i) => {
          const v = getAvgNilai(siswa.id, m.id)
          if (v != null) allNilai.push(v)
          dataRow(`${i + 1}.`, m.nama, v, i)
        })
      }
      if (grpC3.length) {
        sectionRow('C3.  Kompetensi Keahlian')
        grpC3.forEach((m, i) => {
          const v = getAvgNilai(siswa.id, m.id)
          if (v != null) allNilai.push(v)
          dataRow(`${i + 1}.`, m.nama, v, i)
        })
      }
      // Mapel kelompok C tanpa sub
      grpC.forEach((m, i) => {
        const v = getAvgNilai(siswa.id, m.id)
        if (v != null) allNilai.push(v)
        dataRow(`${i + 1}.`, m.nama, v, i)
      })
    }

    // Rata-rata
    const rata = allNilai.length ? allNilai.reduce((a, b) => a + b, 0) / allNilai.length : null
    doc.rect(ml, y, cw, rowH + 2).fill('#DBEAFE').stroke('#93C5FD')
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1E3A8A')
      .text('Rata-rata', ml + noW + 2, y + 2, { width: namaW + noW - 4, align: 'center' })
    if (rata != null)
      doc.text(fmtN(rata, 2), ml + noW + namaW + 1, y + 2, { width: nilW - 2, align: 'center' })
    doc.fillColor('#000')
    y += rowH + 8

    // TTD
    const tx = pw / 2 + 10, tw2 = cw / 2 - 15
    doc.font('Helvetica').fontSize(9.5)
      .text(`${s.kota || 'Bogor'}, ${fmtTgl(s.tgl_lulus)}`, tx, y, { width: tw2, align: 'center' })
    y += 11
    doc.text('Kepala,', tx, y, { width: tw2, align: 'center' })
    y += 38
    doc.moveTo(tx, y + 4).lineTo(tx + tw2, y + 4).lineWidth(0.5).stroke('#000')
    doc.font('Helvetica-Bold').fontSize(9)
      .text(s.kepala || '................................', tx, y, { width: tw2, align: 'center', underline: true })
    y += 12
    doc.font('Helvetica').fontSize(8.5)
      .text(`NIP. ${s.nip || '-'}`, tx, y, { width: tw2, align: 'center' })
  })

  doc.end()
  return filePath
}


// ══════════════════════════════════════════════════════════════════════════
//  SK PENETAPAN KELULUSAN — 1 dokumen resmi kepala sekolah
// ══════════════════════════════════════════════════════════════════════════
function generateSKKelulusan(outputPath, { sekolah: s, siswaList }) {
  const PDFDocument = require('pdfkit')
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const filePath = path.join(outputPath, 'SK_Penetapan_Kelulusan.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const ml = 28, mr = 28, pw = doc.page.width, ph = doc.page.height
  const cw = pw - ml - mr

  function line(x1,y1,x2,y2,w=0.5,color='#000'){
    doc.moveTo(x1,y1).lineTo(x2,y2).lineWidth(w).stroke(color)
  }

  // ── KOP ──────────────────────────────────────────────────────────────────
  let y = 20

  // Logo kiri
  if (s.logo_sekolah) {
    try { doc.image(s.logo_sekolah, ml, y, { fit:[28,28] }) }
    catch(_){ doc.rect(ml,y,28,28).lineWidth(0.4).stroke('#aaa') }
  } else {
    doc.rect(ml,y,28,28).lineWidth(0.4).stroke('#aaa')
    doc.fontSize(5).fillColor('#aaa').text('LOGO',ml+2,y+10,{width:24,align:'center'})
  }

  // Logo kanan
  if (s.logo_kemdikbud) {
    try { doc.image(s.logo_kemdikbud, ml+cw-28, y, { fit:[28,28] }) }
    catch(_){ doc.rect(ml+cw-28,y,28,28).lineWidth(0.4).stroke('#aaa') }
  }

  doc.fillColor('#000')
  doc.font('Helvetica-Bold').fontSize(11)
    .text((s.nama||'NAMA SEKOLAH').toUpperCase(), ml+32, y+2, { width:cw-64, align:'center' })
  doc.font('Helvetica').fontSize(8)
    .text(`NPSN: ${s.npsn||'-'}  |  ${s.alamat||''}`, ml+32, y+14, { width:cw-64, align:'center' })
    .text(`Telp: ${s.telp||'-'}  |  Email: ${s.email_sekolah||'-'}`, ml+32, y+22, { width:cw-64, align:'center' })

  y += 34
  line(ml, y, ml+cw, y, 2)
  line(ml, y+2.5, ml+cw, y+2.5, 0.4)
  y += 12

  // ── JUDUL ─────────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(11)
    .text('KEPUTUSAN KEPALA', ml, y, { width:cw, align:'center' })
  y += 13
  doc.font('Helvetica-Bold').fontSize(11)
    .text((s.nama||'').toUpperCase(), ml, y, { width:cw, align:'center' })
  y += 13
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`NOMOR : ${s.no_sk || '............................................'}`, ml, y, { width:cw, align:'center' })
  y += 12
  doc.font('Helvetica').fontSize(9.5)
    .text('TENTANG', ml, y, { width:cw, align:'center' })
  y += 11
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`PENETAPAN KELULUSAN PESERTA DIDIK ${(s.nama||'').toUpperCase()}`, ml, y, { width:cw, align:'center' })
  y += 10
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`TAHUN PELAJARAN ${s.tahun_ajaran||'......./......'}`, ml, y, { width:cw, align:'center' })
  y += 14

  // ── MENIMBANG / MENGINGAT / MEMPERHATIKAN ────────────────────────────────
  const lx = ml+4, cx = ml+36, vx = ml+40, vw = cw-40

  function menimbang(huruf, teks) {
    doc.font('Helvetica').fontSize(9)
      .text(huruf+'.', lx, y, { width:30 })
      .text(teks, vx, y, { width:vw, align:'justify' })
    y += doc.heightOfString(teks, { width:vw, fontSize:9 }) + 4
  }

  doc.font('Helvetica-Bold').fontSize(9).text('Menimbang', ml, y, { width:80 })
  doc.text(':', ml+80, y, { width:10 })
  y += 12

  menimbang('a', `Bahwa peserta didik ${(s.nama||'')} Tahun Pelajaran ${s.tahun_ajaran||'......'} telah mengikuti seluruh program pembelajaran dan memenuhi kriteria kelulusan yang ditetapkan;`)
  menimbang('b', 'Bahwa berdasarkan hasil rapat Dewan Guru dan penilaian yang telah dilakukan, peserta didik yang namanya tercantum dalam lampiran Surat Keputusan ini dinyatakan telah memenuhi seluruh kriteria kelulusan;')
  menimbang('c', 'Bahwa berdasarkan pertimbangan sebagaimana dimaksud pada huruf a dan b, perlu menetapkan Keputusan Kepala tentang Penetapan Kelulusan Peserta Didik;')

  y += 4
  doc.font('Helvetica-Bold').fontSize(9).text('Mengingat', ml, y, { width:80 })
  doc.text(':', ml+80, y, { width:10 })
  y += 12
  menimbang('1', 'Undang-Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional;')
  menimbang('2', 'Peraturan Pemerintah Nomor 57 Tahun 2021 tentang Standar Nasional Pendidikan;')
  menimbang('3', `Permendikbudristek Nomor 58 Tahun 2024 tentang Ijazah Pendidikan Dasar dan Pendidikan Menengah;`)
  menimbang('4', `Pedoman Pengelolaan Ijazah Kemendikdasmen Tahun 2025;`)

  y += 6
  // ── MEMUTUSKAN ─────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(10)
    .text('MEMUTUSKAN :', ml, y, { width:cw, align:'center' })
  y += 14

  const diktum = (no, bold, normal) => {
    doc.font('Helvetica-Bold').fontSize(9).text(no, ml, y, { width:28, continued:false })
    doc.font('Helvetica-Bold').fontSize(9).text(bold, ml+28, y, { width:cw-28, continued:false })
    y += 11
    if (normal) {
      doc.font('Helvetica').fontSize(9).text(normal, ml+28, y, { width:cw-28, align:'justify' })
      y += doc.heightOfString(normal, { width:cw-28, fontSize:9 }) + 6
    }
  }

  diktum('Pertama   :', 'MENETAPKAN', null)
  diktum('', 'Keputusan Kepala tentang Penetapan Kelulusan Peserta Didik.', null)
  y += 4
  diktum('Kedua     :', 'Nama-nama Peserta Didik',
    'sebagaimana tersebut dalam lampiran dinyatakan LULUS dari '+( s.nama||'')+' Tahun Pelajaran '+(s.tahun_ajaran||'')+' berdasarkan analisis kriteria kelulusan.')
  diktum('Ketiga    :', 'Apabila dikemudian hari terdapat kekeliruan',
    'dalam keputusan ini akan diperbaiki sebagaimana mestinya.')
  diktum('Keempat   :', 'Keputusan ini berlaku sejak tanggal ditetapkan.', null)

  y += 8
  // ── TANDA TANGAN ──────────────────────────────────────────────────────────
  const ttdX = pw/2+10, ttdW = cw/2-15
  doc.font('Helvetica').fontSize(9.5)
    .text(`Ditetapkan di : ${s.kota||'..........'}`, ml, y)
  y += 11
  doc.text(`Pada tanggal  : ${fmtTgl(s.tgl_lulus)}`, ml, y)
  y += 8
  doc.font('Helvetica').fontSize(9.5)
    .text('Kepala,', ttdX, y, { width:ttdW, align:'center' })
  y += 38
  doc.moveTo(ttdX,y+4).lineTo(ttdX+ttdW,y+4).lineWidth(0.5).stroke('#000')
  doc.font('Helvetica-Bold').fontSize(9)
    .text(s.kepala||'................................', ttdX, y, { width:ttdW, align:'center', underline:true })
  doc.font('Helvetica').fontSize(8.5)
    .text(`NIP. ${s.nip||'-'}`, ttdX, y+12, { width:ttdW, align:'center' })

  // ── HALAMAN 2: LAMPIRAN DAFTAR SISWA ────────────────────────────────────
  doc.addPage()
  let y2 = 28

  doc.font('Helvetica-Bold').fontSize(10)
    .text('LAMPIRAN SURAT KEPUTUSAN KEPALA', ml, y2, { width:cw, align:'center' })
  y2 += 12
  doc.font('Helvetica').fontSize(9)
    .text(`Nomor  : ${s.no_sk||'...................................'}`, ml, y2, { width:cw, align:'center' })
  y2 += 10
  doc.text(`Tanggal : ${fmtTgl(s.tgl_lulus)}`, ml, y2, { width:cw, align:'center' })
  y2 += 16

  doc.font('Helvetica-Bold').fontSize(10)
    .text('DAFTAR NAMA PESERTA DIDIK YANG DINYATAKAN LULUS', ml, y2, { width:cw, align:'center' })
  y2 += 10
  doc.font('Helvetica').fontSize(9)
    .text(`${(s.nama||'').toUpperCase()} — TAHUN PELAJARAN ${s.tahun_ajaran||''}`, ml, y2, { width:cw, align:'center' })
  y2 += 14

  // Header tabel
  const noW=22, nismW=50, nisnW=55, namaW=cw-noW-nismW-nisnW-30, sklW=30
  const rowH = 8

  const tblHeader = (yy) => {
    doc.rect(ml, yy, cw, rowH+2).fill('#1D4ED8')
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7)
      .text('No',    ml+1,       yy+2, { width:noW-2,   align:'center' })
      .text('NISM',  ml+noW+1,   yy+2, { width:nismW-2, align:'center' })
      .text('NISN',  ml+noW+nismW+1, yy+2, { width:nisnW-2, align:'center' })
      .text('Nama Peserta Didik', ml+noW+nismW+nisnW+1, yy+2, { width:namaW-2 })
      .text('Ket.',  ml+noW+nismW+nisnW+namaW+1, yy+2, { width:sklW-2, align:'center' })
    doc.fillColor('#000')
    return yy + rowH + 2
  }

  y2 = tblHeader(y2)

  siswaList.forEach((s2, i) => {
    if (y2 > ph - 50) { doc.addPage(); y2 = tblHeader(28) }
    const bg = i%2===0 ? '#fff' : '#F9FAFB'
    doc.rect(ml, y2, cw, rowH).fill(bg).stroke('#E5E7EB')
    doc.fillColor('#111').font('Helvetica').fontSize(7)
      .text(String(i+1)+'.', ml+1, y2+1, { width:noW-2, align:'center' })
      .text(s2.nism||'-',    ml+noW+1, y2+1, { width:nismW-2 })
      .text(s2.nisn||'-',    ml+noW+nismW+1, y2+1, { width:nisnW-2 })
      .text(s2.nama||'-',    ml+noW+nismW+nisnW+1, y2+1, { width:namaW-2 })
      .text('LULUS',         ml+noW+nismW+nisnW+namaW+1, y2+1, { width:sklW-2, align:'center' })
    doc.fillColor('#000')
    y2 += rowH
  })

  // TTD di lampiran
  y2 += 16
  if (y2 > ph - 80) { doc.addPage(); y2 = 28 }
  doc.font('Helvetica').fontSize(9)
    .text(`${s.kota||'........'}, ${fmtTgl(s.tgl_lulus)}`, ttdX, y2, { width:ttdW, align:'center' })
  y2 += 11
  doc.text('Kepala,', ttdX, y2, { width:ttdW, align:'center' })
  y2 += 36
  doc.moveTo(ttdX,y2+4).lineTo(ttdX+ttdW,y2+4).lineWidth(0.5).stroke('#000')
  doc.font('Helvetica-Bold').fontSize(9)
    .text(s.kepala||'................................', ttdX, y2, { width:ttdW, align:'center', underline:true })
  doc.font('Helvetica').fontSize(8.5)
    .text(`NIP. ${s.nip||'-'}`, ttdX, y2+12, { width:ttdW, align:'center' })

  doc.end()
  return filePath
}

module.exports = { generateSKL, generateDKN, generateNilaiIjazah, exportExcelAngkatan, generateIjazah, generateTranskrip, generateSKKelulusan }
