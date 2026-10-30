# Tampilan aksi sesuai hak akses

Tombol tambah, edit, hapus, dan simpan pada menu transaksi menggunakan `MenuAction`.
Komponen membaca `auth.user.menu_access` dari halaman Inertia saat ini. Admin
tetap memiliki seluruh aksi; izin yang tidak tersedia ditolak. Izin create,
update, dan delete berdiri sendiri. Aksi yang tidak diizinkan tidak dirender,
termasuk link, ikon, dan tooltip.

```jsx
<MenuAction action="create" onClick={openCreate}>Tambah</MenuAction>
<MenuAction action="update" as={ActionIconButton} label="Edit" onClick={edit}>
    <Pencil />
</MenuAction>
<MenuAction action="delete" as="button" onClick={remove}>Hapus</MenuAction>
```

Default komponen adalah `Button`. Gunakan `as` untuk mempertahankan komponen
asli, atau `asChild` untuk Button yang membungkus Link. Gate harus berada di
luar Button/ActionIconButton, bukan di dalam child Slot atau TooltipTrigger.
Untuk aksi lintas menu, berikan `menu` sesuai menu endpoint tujuan. Contohnya,
pembuatan kwitansi memakai izin create Faktur Penjualan sesuai route server.

Menghapus atau mengedit baris draft yang belum disimpan merupakan bagian dari
pengisian form create/update, bukan penghapusan record tersimpan. Aksi yang
langsung mengubah server tetap memakai izin endpoint. Contoh: mengosongkan
qty PO In dari form PR membutuhkan update pada menu PR.

Backend tetap memeriksa izin melalui `EnsureMenuPrivilege`; menyembunyikan
tombol tidak menggantikan otorisasi server. Request PUT/PATCH dihitung sebagai
update, DELETE sebagai delete, dan POST pembuatan sebagai create.

Verifikasi:

```sh
node --test tests/js/*.test.mjs
php artisan test --compact tests/Feature/MenuActionPermissionsTest.php
npm run build
```

Uji dengan user yang memiliki view ditambah masing-masing create saja, update
saja, delete saja, serta tanpa izin mutasi. Periksa toolbar, ikon per baris,
modal, tombol simpan, dan tombol kosong-state. Aturan bisnis yang sudah ada,
misalnya larangan hapus data yang sudah direalisasi, tetap berlaku.
