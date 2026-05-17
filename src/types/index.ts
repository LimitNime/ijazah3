export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'operator'
}

export interface Sekolah {
  id: number
  nama: string
  nss: string
  npsn: string
  kepala: string
  nip: string
  alamat: string
  kota: string
  provinsi: string
  kode_pos: string
  telp: string
  email_sekolah: string
  website: string
  tahun_ajaran: string
  tgl_lulus: string
  bobot_raport: number
  bobot_ujian: number
  jenjang: string
}

export interface Semester {
  id: number
  label: string
  urutan: number
  is_ujian: number
}

export interface Siswa {
  id: number
  no_urut: number
  nism: string
  nisn: string
  nama: string
  jk: 'Laki-laki' | 'Perempuan'
  tempat_lahir: string
  tgl_lahir: string
  ortu: string
  peserta_am: string
  blanko: string
  no_skl?: string
  jml_nilai?: number
}

export interface Mapel {
  id: number
  nama: string
  kelompok: 'A' | 'B'
  urutan: number
  is_mulok: number
  jml_nilai?: number
}

export interface Nilai {
  id: number
  siswa_id: number
  mapel_id: number
  semester_id: number
  nilai_p: number | null
  nilai_k: number | null
  nilai_ujian: number | null
}

export interface Angkatan {
  id: number
  nama: string
  tahun_lulus: string
  keterangan: string
  is_aktif: number
  jml_siswa?: number
}
