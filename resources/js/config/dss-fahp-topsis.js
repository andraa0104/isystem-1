const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const clamp01 = (value) => {
    const number = toNumber(value, 0);
    if (number <= 0) return 0;
    if (number >= 1) return 1;
    return number;
};

const absRatio = (numerator, denominator) => {
    const den = Math.max(1, Math.abs(toNumber(denominator, 0)));
    return clamp01(Math.abs(toNumber(numerator, 0)) / den);
};

const normalizeBenefit = (value, min, max) => {
    const low = toNumber(min, 0);
    const high = Math.max(low + 0.000001, toNumber(max, 1));
    return clamp01((toNumber(value, 0) - low) / (high - low));
};

const normalizeCost = (value, min, max) => {
    const low = toNumber(min, 0);
    const high = Math.max(low + 0.000001, toNumber(max, 1));
    return clamp01((toNumber(value, 0) - low) / (high - low));
};

export const DSS_FAHP_LINGUISTIC_SCALE = {
    equal: [1, 1, 1],
    slight: [1, 2, 3],
    moderate: [2, 3, 4],
    strong: [4, 5, 6],
    very_strong: [6, 7, 8],
    extreme: [8, 9, 9],
};

export const DSS_FAHP_TOPSIS_CONFIG = {
    'audit-rekonsiliasi': {
        criteria: [
            {
                key: 'trx_unbalanced_ratio',
                label: 'TRX tidak seimbang',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.trx_unbalanced, ctx?.trx_total),
                recommendations: [
                    'Prioritaskan koreksi jurnal TRX yang tidak seimbang pada periode aktif sebelum closing.',
                    'Terapkan validasi seimbang saat input jurnal agar kasus tidak berulang.',
                ],
            },
            {
                key: 'ajp_unbalanced_ratio',
                label: 'AJP tidak seimbang',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.ajp_unbalanced, ctx?.ajp_total),
                recommendations: [
                    'Review dokumen AJP dengan selisih terbesar dan perbaiki pasangan debit-kreditnya.',
                    'Standarkan checklist approval AJP sebelum posting bulanan.',
                ],
            },
            {
                key: 'neraca_mismatch_ratio',
                label: 'Mismatch neraca',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.neraca_selisih, ctx?.neraca_total_aset),
                recommendations: [
                    'Investigasi mismatch neraca mulai dari akun selisih terbesar, posting akhir, dan mapping akun.',
                    'Lakukan rekonsiliasi aset vs liabilitas+ekuitas sebelum finalisasi laporan periode.',
                ],
            },
            {
                key: 'modal_mismatch_ratio',
                label: 'Mismatch perubahan modal',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.modal_diff, ctx?.modal_snapshot_ending_equity),
                recommendations: [
                    'Sinkronkan perhitungan perubahan modal dengan snapshot ekuitas agar selisih kembali dalam toleransi.',
                    'Audit akun ekuitas (prefix 3) dan laba ditahan untuk memastikan klasifikasi sudah tepat.',
                ],
            },
        ],
        pairwise: [
            ['equal', 'slight', 'inv:moderate', 'equal'],
            ['inv:slight', 'equal', 'inv:strong', 'inv:moderate'],
            ['moderate', 'strong', 'equal', 'slight'],
            ['equal', 'moderate', 'inv:slight', 'equal'],
        ],
    },

    'buku-besar': {
        criteria: [
            {
                key: 'opening_gap',
                label: 'Kelengkapan saldo awal',
                type: 'cost',
                normalize: (ctx) => (ctx?.opening_warning ? 1 : 0),
                recommendations: [
                    'Lengkapi saldo awal periode sebelumnya agar saldo berjalan akun tidak bias.',
                    'Pastikan snapshot pembuka akun tersedia sebelum analisis mutasi.',
                ],
            },
            {
                key: 'debit_kredit_gap',
                label: 'Gap debit-kredit',
                type: 'cost',
                normalize: (ctx) => {
                    const debit = toNumber(ctx?.total_debit, 0);
                    const kredit = toNumber(ctx?.total_kredit, 0);
                    return absRatio(debit - kredit, debit + kredit);
                },
                recommendations: [
                    'Tinjau transaksi dengan nominal besar untuk menurunkan gap debit-kredit bersih akun ini.',
                    'Kelompokkan mutasi per sumber (TRX/AJP) untuk menemukan penyebab utama ketidakseimbangan.',
                ],
            },
            {
                key: 'mutasi_volume',
                label: 'Kecukupan volume mutasi',
                type: 'benefit',
                normalize: (ctx) => {
                    const lineCount = toNumber(ctx?.line_count, 0);
                    return normalizeBenefit(lineCount, 0, 60);
                },
                recommendations: [
                    'Perluas periode atau longgarkan filter jika volume mutasi terlalu kecil untuk dianalisis.',
                    'Pastikan semua transaksi akun terkait sudah terposting pada periode yang dipilih.',
                ],
            },
        ],
        pairwise: [
            ['equal', 'inv:moderate', 'moderate'],
            ['moderate', 'equal', 'strong'],
            ['inv:moderate', 'inv:strong', 'equal'],
        ],
    },

    'saldo-akun': {
        criteria: [
            {
                key: 'negative_ratio',
                label: 'Rasio saldo negatif',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.negative_count, ctx?.total_accounts),
                recommendations: [
                    'Fokuskan review pada akun dengan saldo negatif terbesar untuk validasi konvensi tanda dan posting.',
                    'Susun daftar akun anomali saldo negatif sebagai agenda review periodik.',
                ],
            },
            {
                key: 'zero_ratio',
                label: 'Rasio saldo nol',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.zero_count, ctx?.total_accounts),
                recommendations: [
                    'Evaluasi akun saldo nol berkepanjangan agar struktur COA tetap efisien.',
                    'Pisahkan akun aktif dan dormant untuk memudahkan analisis manajerial.',
                ],
            },
            {
                key: 'consistency_gap',
                label: 'Konsistensi NA vs Saldo',
                type: 'cost',
                normalize: (ctx) => {
                    const left = toNumber(ctx?.na_nonzero_but_saldo_zero_count, 0);
                    const right = toNumber(ctx?.saldo_nonzero_but_na_zero_count, 0);
                    return absRatio(left + right, ctx?.total_accounts);
                },
                recommendations: [
                    'Periksa proses pembentukan saldo snapshot agar NA Debit/Kredit konsisten dengan Saldo.',
                    'Audit ETL atau script rekap untuk akun yang NA dan Saldo-nya tidak sinkron.',
                ],
            },
            {
                key: 'header_density',
                label: 'Kepadatan akun kode 00',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.marked_00_count, ctx?.total_accounts),
                recommendations: [
                    'Pastikan akun berkode 00 diperlakukan sebagai header/ringkasan dan tidak dipakai sebagai akun transaksi.',
                    'Tetapkan aturan klasifikasi akun header agar pelaporan lebih konsisten.',
                ],
            },
        ],
        pairwise: [
            ['equal', 'slight', 'inv:moderate', 'moderate'],
            ['inv:slight', 'equal', 'inv:strong', 'slight'],
            ['moderate', 'strong', 'equal', 'strong'],
            ['inv:moderate', 'inv:slight', 'inv:strong', 'equal'],
        ],
    },

    'neraca-akhir': {
        criteria: [
            {
                key: 'mismatch_ratio',
                label: 'Selisih A-(L+E)',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.selisih, ctx?.total_aset),
                recommendations: [
                    'Prioritaskan rekonsiliasi akun yang memicu selisih neraca agar posisi Aset=(Liabilitas+Ekuitas) kembali seimbang.',
                    'Cek proses closing dan penarikan snapshot neraca pada periode aktif.',
                ],
            },
            {
                key: 'leverage_ratio',
                label: 'Leverage',
                type: 'cost',
                normalize: (ctx) => normalizeCost(absRatio(ctx?.total_liabilitas, ctx?.total_aset), 0, 1),
                recommendations: [
                    'Pantau rasio liabilitas terhadap aset agar struktur pendanaan tetap sehat.',
                    'Susun rencana pengurangan kewajiban jangka pendek bila leverage meningkat.',
                ],
            },
            {
                key: 'snapshot_coverage',
                label: 'Ketersediaan snapshot',
                type: 'benefit',
                normalize: (ctx) => (toNumber(ctx?.total_aset, 0) > 0 ? 1 : 0),
                recommendations: [
                    'Pastikan snapshot neraca periode berjalan terisi lengkap sebelum analisis.',
                    'Validasi job pembentukan snapshot agar data aset tidak kosong.',
                ],
            },
        ],
        pairwise: [
            ['equal', 'strong', 'very_strong'],
            ['inv:strong', 'equal', 'moderate'],
            ['inv:very_strong', 'inv:moderate', 'equal'],
        ],
    },

    'rugi-laba': {
        criteria: [
            {
                key: 'net_margin',
                label: 'Net margin',
                type: 'benefit',
                normalize: (ctx) => normalizeBenefit(toNumber(ctx?.net_margin, 0), -0.2, 0.25),
                recommendations: [
                    'Prioritaskan perbaikan margin bersih melalui pengendalian beban dan penguatan pendapatan inti.',
                    'Tinjau akun penyumbang rugi terbesar dan siapkan aksi efisiensi.',
                ],
            },
            {
                key: 'gross_margin',
                label: 'Gross margin',
                type: 'benefit',
                normalize: (ctx) => normalizeBenefit(toNumber(ctx?.gross_margin, 0), 0, 0.5),
                recommendations: [
                    'Evaluasi HPP dan strategi harga untuk memperbaiki gross margin.',
                    'Audit akun HPP dominan untuk menemukan potensi efisiensi langsung.',
                ],
            },
            {
                key: 'opex_ratio',
                label: 'Rasio opex',
                type: 'cost',
                normalize: (ctx) => normalizeCost(toNumber(ctx?.opex_ratio, 0), 0, 1),
                recommendations: [
                    'Prioritaskan efisiensi biaya operasional yang rasio terhadap pendapatannya paling tinggi.',
                    'Tetapkan batas opex per fungsi dan monitor realisasinya per periode.',
                ],
            },
            {
                key: 'revenue_availability',
                label: 'Ketersediaan pendapatan',
                type: 'benefit',
                normalize: (ctx) => (toNumber(ctx?.pendapatan, 0) > 0 ? 1 : 0),
                recommendations: [
                    'Pastikan akun pendapatan terposting konsisten agar laporan rugi laba representatif.',
                    'Verifikasi cut-off pendapatan di akhir periode untuk mencegah under-reporting.',
                ],
            },
        ],
        pairwise: [
            ['equal', 'moderate', 'moderate', 'strong'],
            ['inv:moderate', 'equal', 'slight', 'moderate'],
            ['inv:moderate', 'inv:slight', 'equal', 'moderate'],
            ['inv:strong', 'inv:moderate', 'inv:moderate', 'equal'],
        ],
    },

    'perubahan-modal': {
        criteria: [
            {
                key: 'reconciliation_gap',
                label: 'Gap rekonsiliasi modal',
                type: 'cost',
                normalize: (ctx) => absRatio(ctx?.diff, ctx?.opening_plus_computed),
                recommendations: [
                    'Kurangi gap rekonsiliasi modal dengan menelusuri jurnal penutup dan mutasi akun ekuitas.',
                    'Fokuskan investigasi pada akun ekuitas dengan pergerakan bersih terbesar.',
                ],
            },
            {
                key: 'tolerance_fit',
                label: 'Kepatuhan toleransi',
                type: 'cost',
                normalize: (ctx) => {
                    const tolerance = Math.max(1, toNumber(ctx?.tolerance, 0) * 10);
                    return normalizeCost(Math.abs(toNumber(ctx?.diff, 0)) / tolerance, 0, 1);
                },
                recommendations: [
                    'Pastikan selisih modal berada dalam toleransi periode sebelum laporan dipublikasikan.',
                    'Perketat kontrol posting jurnal penyesuaian yang berdampak ke ekuitas.',
                ],
            },
            {
                key: 'ending_equity_coverage',
                label: 'Keterisian modal akhir',
                type: 'benefit',
                normalize: (ctx) => (Math.abs(toNumber(ctx?.computed_ending_equity, 0)) > 0 ? 1 : 0),
                recommendations: [
                    'Validasi sumber data modal akhir agar nilai akhir modal tidak kosong.',
                    'Pastikan perhitungan laba ditahan dan mutasi modal terhubung ke periode yang sama.',
                ],
            },
        ],
        pairwise: [
            ['equal', 'strong', 'very_strong'],
            ['inv:strong', 'equal', 'moderate'],
            ['inv:very_strong', 'inv:moderate', 'equal'],
        ],
    },
};

export const getDssFahpTopsisReportConfig = (reportKey) =>
    DSS_FAHP_TOPSIS_CONFIG[String(reportKey || '').trim()] ?? null;
