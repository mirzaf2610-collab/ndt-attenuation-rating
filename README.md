# NDT Attenuation Rating

Web tool untuk menghitung rating atenuasi ultrasonik (A/B1/B2/C/NT) dari file
export OmniPC, per pabrik/reformer → Row → Tube. Data tersimpan di Supabase
(Postgres), backend Node/Express, deploy di Railway.

Arsitektur sama seperti PSP Tennis Rank / Bicycle Miniature Tracker.

## 1. Buat project Supabase

1. Buka https://supabase.com/dashboard → **New project**.
2. Pilih nama, password database, region (Singapore paling dekat ke Indonesia).
3. Setelah project jadi, buka **SQL Editor** → jalankan isi file
   `supabase/schema.sql` di repo ini (buat tabel `plants`, `rows_`, `tubes`).
4. Buka **Project Settings → API** — catat:
   - `Project URL` → jadi `SUPABASE_URL`
   - `anon` / `publishable` key → jadi `SUPABASE_KEY`
   (RLS policy di schema ini sudah "allow all", jadi anon key cukup untuk tool internal ini)

## 2. Buat GitHub repo

```bash
# di dalam folder project ini
git init
git add .
git commit -m "Initial commit: NDT attenuation rating tool"
git branch -M main
git remote add origin https://github.com/<username>/ndt-attenuation-rating.git
git push -u origin main
```

(Buat repo kosong dulu di github.com/new dengan nama `ndt-attenuation-rating`,
tanpa README/gitignore supaya tidak konflik saat push pertama.)

## 3. Deploy ke Railway

1. Buka https://railway.app/new → **Deploy from GitHub repo** → pilih repo
   `ndt-attenuation-rating`.
2. Railway otomatis detect Node.js dan menjalankan `npm install` + `npm start`.
3. Buka tab **Variables**, tambahkan:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   (isi dari langkah 1)
4. Railway akan kasih domain publik `xxxx.up.railway.app` — buka, tool-nya
   sudah bisa dipakai.
5. (Opsional) Sambungkan ke subdomain sendiri lewat tab **Settings → Networking
   → Custom Domain**, lalu tambahkan CNAME di DNS provider (Hostinger dsb).

## Struktur data

- **plants** — satu baris per pabrik/reformer, menyimpan kriteria rating
  (threshold A/B1/B2/justifikasi) masing-masing.
- **rows_** — Row (A, B, C, ...) di bawah satu plant, dengan `total_tubes`
  yang menentukan berapa banyak NT otomatis dipadding di tabel & rekap.
- **tubes** — hasil per tube: file yang diupload, persentase tiap rating,
  dan justifikasi rating akhir.

## Menjalankan lokal (opsional, untuk testing sebelum deploy)

```bash
npm install
cp .env.example .env   # isi SUPABASE_URL & SUPABASE_KEY
npm start
# buka http://localhost:3000
```
