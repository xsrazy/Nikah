# Undangan Pernikahan Usra & Siapa

Website undangan pernikahan digital pribadi: **Usra & Siapa**, Sabtu, 03 Februari 2032.

Live: https://nikah.xsrazy.web.id

> **Proyek ini adalah modifikasi** dari template undangan open source [dewanakl/undangan](https://github.com/dewanakl/undangan) (MIT). Perubahan utamanya ada di backend: API bawaan template diganti backend sendiri. Daftar lengkap perubahannya ada di bagian [Modifikasi](#modifikasi-dari-template-asli).

## Tentang

Dibangun dari template undangan open source [dewanakl/undangan](https://github.com/dewanakl/undangan) (via fork pemudakoding/undangan), dengan satu perubahan besar: backend komentar tidak lagi memakai API pihak ketiga. Semua fitur ucapan, RSVP, dan like berjalan di backend sendiri.

## Fitur

- Cover undangan dengan nama tamu (`?to=Nama Tamu`)
- Countdown, jadwal akad dan resepsi, dress code, galeri
- Kartun pengantin adat Minangkabau (suntiang dan destar)
- Musik latar River Flows in You
- Love Gift (SeaBank dan DANA), ucapan dan doa (komentar bertingkat + balasan)
- RSVP presensi, like komentar ala Instagram (double tap)
- Tombol bagikan ke WhatsApp, Telegram, Facebook, dan X, plus salin link
- Dashboard admin: statistik, moderasi komentar, ganti nama/password, regenerasi access key, unduh CSV
- Generator link tamu di dashboard: buat link personal `?to=Nama`, kirim langsung via WhatsApp, dan kelola daftar tamu tersimpan

## Arsitektur

- Frontend: HTML statis + Bootstrap 5 + Vanilla JS (dari template asli)
- Backend: Vercel Functions di folder `api/` (Node.js, tanpa framework, tanpa dependensi)
- Database: satu dokumen JSON di private Vercel Blob store (komen, like, pengaturan, akun admin)
- Auth tamu: header `x-access-key` (key tertanam di `index.html`, sama seperti desain template asli)
- Auth admin: JWT (HMAC-SHA256) dari `POST /api/session`

## API

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/config` | Konfigurasi publik (nama, izin reply/edit/delete) |
| GET | `/api/comment?per=10&next=0` | Daftar komentar (paginasi offset) |
| POST | `/api/comment` | Kirim komentar / balasan |
| GET | `/api/comment/:uuid` | Ambil satu komentar |
| PUT | `/api/comment/:own` | Edit komentar sendiri |
| DELETE | `/api/comment/:own` | Hapus komentar sendiri |
| POST | `/api/comment/:uuid` | Like komentar |
| PATCH | `/api/comment/:likeUuid` | Batal like |
| POST | `/api/session` | Login admin |
| GET/PATCH | `/api/user` | Profil dan pengaturan admin |
| GET | `/api/stats` | Statistik komentar |
| PUT | `/api/key` | Regenerasi access key |
| GET | `/api/download` | Unduh komentar sebagai CSV |
| GET | `/api/guest` | Daftar tamu tersimpan (admin) |
| POST | `/api/guest` | Simpan tamu baru (admin) |
| DELETE | `/api/guest/:id` | Hapus tamu (admin) |

## Environment Variables (Vercel)

- `BLOB_READ_WRITE_TOKEN` (otomatis dari Blob store)
- `AUTH_SECRET` (penandatangan JWT)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed akun admin saat database pertama dibuat)
- `INITIAL_ACCESS_KEY` (seed access key pertama)

## Modifikasi dari Template Asli

- **Backend sendiri**: API komentar bawaan template (api.ulems.my.id, sudah tidak aktif) diganti Vercel Functions di folder `api/` + database JSON di private Vercel Blob store
- **Dashboard terhubung ke backend sendiri** (alamat datanya diganti dari API lama ke backend ini)
- **Generator link tamu** di dashboard (tab Tamu) dengan endpoint `/api/guest`
- **Tombol bagikan** ke media sosial di halaman undangan
- **Logo pembayaran dilokalkan** (SeaBank dan DANA, file SVG di `assets/images/`)
- **Perbaikan loader**: kesalahan memuat satu gambar tidak lagi menghentikan seluruh proses loading
- **URL bersih**: dashboard dapat dibuka di `/dashboard` tanpa akhiran `.html` (cleanUrls)
- **Personalisasi**: nama Usra & Siapa, kartun pengantin adat Minangkabau, musik River Flows in You, venue Monas Jakarta

## Kredit

Template asli oleh [Dewanakl](https://github.com/dewanakl/undangan), lisensi MIT. Lihat file `LICENSE`.
