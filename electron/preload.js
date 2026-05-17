const { contextBridge, ipcRenderer } = require('electron')
const invoke = (ch, ...a) => ipcRenderer.invoke(ch, ...a)

contextBridge.exposeInMainWorld('api', {
  auth:     { login: (e,p) => invoke('auth:login',e,p) },
  sekolah:  {
    get:         ()      => invoke('sekolah:get'),
    save:        d       => invoke('sekolah:save', d),
    uploadLogo:  field   => invoke('sekolah:upload_logo', field),
    removeLogo:  field   => invoke('sekolah:remove_logo', field),
  },
  semester: {
    list:    ()        => invoke('semester:list'),
    add:     d         => invoke('semester:add',d),
    update:  (id,d)    => invoke('semester:update',id,d),
    delete:  id        => invoke('semester:delete',id),
    reorder: ids       => invoke('semester:reorder',ids),
  },
  siswa: {
    list:         q          => invoke('siswa:list',q),
    get:          id         => invoke('siswa:get',id),
    add:          d          => invoke('siswa:add',d),
    update:       (id,d)     => invoke('siswa:update',id,d),
    delete:       id         => invoke('siswa:delete',id),
    generateNoSkl:(opts)     => invoke('siswa:generate_no_skl', opts),
    updateNoSkl:  (id,v)     => invoke('siswa:update_no_skl', id, v),
    uploadFoto:   (id)       => invoke('siswa:upload_foto', id),
    removeFoto:   (id)       => invoke('siswa:remove_foto', id),
    importExcel:  ()         => invoke('siswa:import_excel'),
    stats:  ()         => invoke('siswa:stats'),
  },
  mapel: {
    list:        ()    => invoke('mapel:list'),
    add:         d     => invoke('mapel:add',d),
    update:      (id,d)=> invoke('mapel:update',id,d),
    delete:      id    => invoke('mapel:delete',id),
    reorder:     ids   => invoke('mapel:reorder',ids),
    seedDefault: ()    => invoke('mapel:seed_default'),
  },
  nilai: {
    getSiswa:  id      => invoke('nilai:get_siswa',id),
    saveBatch: rows    => invoke('nilai:save_batch',rows),
    rekap:     ()      => invoke('nilai:rekap'),
  },
  angkatan: {
    list:        ()          => invoke('angkatan:list'),
    add:         d           => invoke('angkatan:add',d),
    update:      (id,d)      => invoke('angkatan:update',id,d),
    delete:      id          => invoke('angkatan:delete',id),
    getSiswa:    id          => invoke('angkatan:siswa',id),
    tambahSiswa: (id,ids)    => invoke('angkatan:tambah_siswa',id,ids),
    hapusSiswa:  (id,ids)    => invoke('angkatan:hapus_siswa',id,ids),
  },
  export: {
    excelAngkatan: (angkatan_id) => invoke('export:excel_angkatan', angkatan_id),
  },
  pdf: {
    skl:         ()    => invoke('pdf:skl'),
    dkn:         ()    => invoke('pdf:dkn'),
    nilaiIjazah: ()    => invoke('pdf:nilai_ijazah'),
    ijazah:      ()    => invoke('pdf:ijazah'),
    transkrip:   ()    => invoke('pdf:transkrip'),
    skKelulusan: ()    => invoke('pdf:sk_kelulusan'),
  },
  db: {
    backup:  ()  => invoke('db:backup'),
    restore: ()  => invoke('db:restore'),
  },
  app: {
    getPaths:   () => invoke('app:get_paths'),
    openOutput: () => invoke('app:open_output'),
    stats:      () => invoke('stats:dashboard'),
  },
})
