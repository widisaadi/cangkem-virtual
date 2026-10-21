<p align="center">
  <img src="resources/readme-banner.png" alt="Ilustrasi Cawal: suara dari mulut mengalir ke laptop yang sedang mengetik" width="100%">
</p>

# Cawal — Cangkem Virtual

Versi 1.6.0 menghadirkan UI pengaturan baru berbahasa Inggris, onboarding
pertama kali, dan indikator API key tersimpan berupa titik-titik tanpa tombol
untuk menampilkan key. Onboarding meliputi koneksi Groq, pemilihan shortcut,
dan latihan dictation yang dapat dilewati. Pengguna lama tidak perlu mengulangnya.

[Download installer Windows v1.6.0](https://github.com/widisaadi/cangkem-virtual/releases/download/v1.6.0/Cawal-Setup-1.6.0.exe)

Dictation sederhana untuk Windows. Tampilan Quiet Graphite dengan aksen
`#ffdd33` dan logo line art mulut berbicara. Hanya Groq.
Jendela desktop khusus pengaturan **General** dan **Connection**; dictation lewat shortcut.

Tekan shortcut yang tertera di Cawal (bawaan **Ctrl + Shift + Spasi**), bicara,
lalu tekan lagi. Shortcut dapat diganti lewat **General → Dictation shortcut → Edit shortcut**:
tekan kombinasi pilihanmu lalu **Save**. Jika shortcut bawaan dipakai aplikasi
lain, Cawal memilih kombinasi alternatif. Shortcut kustom yang bentrok akan
menampilkan pesan agar kamu memilih kombinasi lain. Cawal mentranskripsikan
suara dan menempelkan hasil ke aplikasi yang aktif saat rekaman dimulai.
**Esc** membatalkan rekaman atau pemrosesan.

## Yang tersedia

- Dictation: `whisper-large-v3-turbo` (bawaan) atau `whisper-large-v3`.
- Perapihan opsional: `qwen/qwen3.8-27b`, tanpa thinking atau tools.
  Prompt khusus merapikan kalimat, tanda baca, tanda petik untuk ucapan langsung,
  dan paragraf saat topik berubah. Dictation singkat tetap satu paragraf;
  gaya santai, sisipan Inggris, nama, angka, dan maksud ucapan dipertahankan.
  Pertanyaan langsung memakai tanda tanya; pernyataan dan instruksi selesai
  memakai titik. Klausa sambungan memakai koma sesuai struktur kalimat.
  Qwen hanya membaca transkrip, bukan audio, sehingga intonasi yang ambigu
  tidak bisa dipastikan dari teks saja. Kalimat terpotong tidak dilengkapi AI.
- Satu API key Groq, tersimpan terenkripsi menggunakan perlindungan Windows.
- Konteks ejaan untuk Qwen, Muse, Flow, Omni Flash, Grok, dan Groq, termasuk
  nomor versi dan ukuran parameter yang diucapkan. Nama tidak ditukar hanya
  berdasarkan bunyi yang mirip. Tidak ada menu kamus atau pembaruan kosakata otomatis.
- Indonesia + Inggris sebagai bawaan. Pilihan Cirebon di dropdown Bahasa menambahkan
  deteksi bahasa otomatis dengan konteks Cirebon, Indonesia, dan Inggris.
  Kosakata pribadi mencakup ira, bobad, kirik-kirikiin, moregan bae, mengkono tah,
  dan bol. Qwen mempertahankan dialek, sapaan, kata ganti, dan campuran bahasa.
  Bol dipahami sebagai sapaan seperti bro, tetapi tetap ditulis bol.
- Mikrofon, shortcut kustom, dan mulai bersama Windows.
- Indikator rekaman kecil, salin ulang saat paste gagal, dan coba ulang saat error.
- Jika mikrofon terputus atau tidak tersedia, rekaman dihentikan, wave ditutup,
  dan jendela pengaturan menawarkan Gunakan mikrofon default atau pilih perangkat
  lain. Mulai rekaman baru lewat shortcut setelah perangkat siap.

Tidak ada akun Cawal, langganan aplikasi, meeting, notes, chat, agent, upload,
provider lain, model lokal, sinkronisasi, telemetry, atau updater OpenWhispr.
Biaya dan batas penggunaan API mengikuti akun Groq milik pengguna.

## Pakai

1. Pasang `Cawal-Setup-1.6.0.exe` dari [GitHub Releases](https://github.com/widisaadi/cangkem-virtual/releases/tag/v1.6.0).
2. Saat pertama dibuka, pilih **Get started**, masukkan API key Groq, lalu **Save & continue**.
   Tautan **Get a Groq API key** membuka halaman key resmi Groq di browser.
3. Pilih shortcut dan coba dictation di area latihan, atau pilih **Skip for now**.
   Pengguna lama langsung masuk Settings; key dan preferensi tetap tersimpan.
   Pilih mikrofon di **General** bila perlu. Letakkan kursor pada kolom teks aplikasi tujuan.
4. Tekan shortcut untuk mulai dan selesai bicara.
5. Opsional: di dropdown **Language**, pilih **Cirebon**. Pilihan bawaan **Indonesia**.
   Konteks campuran bahasa tetap dipertahankan; label pilihan dibuat ringkas.

Di **Connection**, key tersimpan ditandai titik-titik, tanpa menampilkan key asli.
Ketik key baru dan pilih **Save** untuk menggantinya. Gunakan **Test connection**
untuk menguji koneksi atau **Remove key** untuk menghapus key.

Setelah API key tersimpan, pembukaan berikutnya langsung berjalan di background.
Tombol minimize dan tutup menyembunyikan Cawal ke tray. Klik dua kali ikon tray
untuk membuka pengaturan; pilih **Quit** pada menu tray untuk berhenti sepenuhnya.
Aktifkan **Start with Windows** jika ingin Cawal mulai bersama Windows.
Pendaftaran memakai lokasi executable terpasang dan argumen --hidden, lalu
dibaca kembali dari Windows. Setiap aplikasi dibuka, preferensi startup disinkronkan
lagi untuk memperbaiki entri yang hilang setelah update installer. Jika Windows
menolak pendaftaran, aplikasi menampilkan error. Status switch mengikuti entri Windows.

Tekan shortcut dari aplikasi mana pun: ikon gelombang kecil (88 × 56 piksel)
muncul di bawah monitor aplikasi tempat kamu mengetik, meskipun pointer mouse
berada di monitor lain. Flow Line berupa satu garis #ffdd33 pada latar hitam,
mengalir mengikuti level suara mikrofon dengan respons halus dan peluruhan
170 ms. Garis merata saat hening, tanpa teks, durasi, atau tombol. Ikon tidak
mengambil fokus maupun menghalangi klik ke aplikasi di bawahnya. Shortcut lagi
menyelesaikan rekaman; Esc membatalkannya. Ikon diam saat memproses dan
menghilang setelah selesai. Pesan pemulihan saat paste gagal atau error tersedia
di jendela pengaturan. Tidak ada dashboard atau panel transkrip.
Mikrofon hanya aktif selama rekaman, bukan selama Cawal menunggu di background.
Rekaman dibatasi lima menit dan 24 MB. Internet diperlukan.
Mode bawaan memakai konteks Indonesia + Inggris dan kode bahasa Indonesia.
Saat Bahasa Cirebon aktif, Whisper mendeteksi bahasa secara otomatis dan Qwen
memakai prompt pribadi Cirebon. Contoh gaya:
“Kita pengennya sih ke sini, tapi ira-nya ke sana.” dan “Aja bobad, bol.”
Kata kita, ira, dan bol tidak diganti ke saya, Anda, atau bro.
Tidak ada penggantian kata otomatis berbasis kamus atau pelatihan model baru.
Akurasi dialek dan campuran bahasa tetap bergantung pada audio
dan model; perapihan AI tidak dapat memulihkan ucapan yang hilang dari transkrip.
Konteks transkripsi mengikuti [panduan prompting Groq](https://console.groq.com/docs/speech-to-text#prompting-guidelines).
Jika AI gagal, teks asli Whisper tetap digunakan. Jika transkripsi gagal,
rekaman disimpan sementara di memori untuk dicoba ulang. Coba ulang hanya
menyalin hasil ke clipboard, karena aplikasi tujuan awal bisa sudah berubah.

Hasil terakhir dan audio tidak disimpan ke disk oleh Cawal. Keduanya hilang
saat aplikasi keluar. Teks yang sudah disalin tetap ada di clipboard Windows sampai diganti.
Pengaturan dan API key terenkripsi ada di `%APPDATA%/Cawal/settings.json`,
terpisah dari data OpenWhispr. Audio dikirim ke Groq; jika AI diaktifkan,
transkrip juga dikirim ke Groq untuk dirapikan.

Qwen 3.8 berstatus preview di Groq. Jika model tidak tersedia untuk akunmu,
matikan Rapikan dengan AI untuk memakai Whisper saja. Tidak ada pergantian
otomatis ke model atau provider lain.

Paste otomatis menggunakan Windows SendInput. Aplikasi yang berjalan sebagai
administrator atau tidak menerima paste mungkin perlu Ctrl+V secara manual.
Untuk terminal yang dikenali, helper menggunakan Ctrl+Shift+V.

## Pengembangan

Windows x64, Node.js 24+, dan .NET Framework 4.x (compiler bawaan Windows).

```powershell
npm install
npm run dev
```

```powershell
npm run check        # typecheck, unit/integration tests, renderer build
npm run test:desktop # Electron smoke test with a fake microphone; no API call
npm run build:win    # Windows installer
```

Struktur: `app/` untuk Electron dan Groq, `renderer/` untuk antarmuka,
`native/Paste.cs` untuk paste Windows, `tests/` untuk pengujian.
Build tidak mengunduh mesin/model AI atau layanan tambahan. Installer lokal
tidak ditandatangani; Windows dapat menampilkan peringatan penerbit belum dikenal.

## Lisensi

Cawal merupakan penyederhanaan proyek OpenWhispr. Hak cipta dan lisensi MIT
OpenWhispr dipertahankan di `LICENSE`. Helper paste mengadaptasi perilaku
deteksi terminal dan pemulihan fokus dari helper Windows OpenWhispr.
