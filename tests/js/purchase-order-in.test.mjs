import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createLatestRequest,
    getBusinessDate,
    getPaginationRange,
    readPoInResponse,
} from '../../resources/js/lib/purchase-order-in.js';

test('tanggal bisnis mengikuti pergantian hari dan tahun di WITA', () => {
    assert.equal(
        getBusinessDate(new Date('2026-10-21T15:59:59Z')),
        '2026-10-21',
    );
    assert.equal(
        getBusinessDate(new Date('2026-10-21T16:00:00Z')),
        '2026-10-22',
    );
    assert.equal(
        getBusinessDate(new Date('2026-12-31T17:00:00Z')),
        '2027-01-01',
    );
});

test('rentang pagination benar untuk halaman pertama, terakhir, dan data kosong', () => {
    assert.deepEqual(getPaginationRange({ total: 23, page: 1, per_page: 10 }), {
        from: 1,
        to: 10,
        total: 23,
    });
    assert.deepEqual(getPaginationRange({ total: 23, page: 3, per_page: 10 }), {
        from: 21,
        to: 23,
        total: 23,
    });
    assert.deepEqual(getPaginationRange({ total: 0, page: 1, per_page: 5 }), {
        from: 0,
        to: 0,
        total: 0,
    });
});

test('pilihan Semua menghasilkan rentang penuh tanpa NaN', () => {
    assert.deepEqual(
        getPaginationRange({ total: '23', page: 1, per_page: 'all' }),
        { from: 1, to: 23, total: 23 },
    );
    assert.deepEqual(getPaginationRange({ total: 0, per_page: 'all' }), {
        from: 0,
        to: 0,
        total: 0,
    });
    assert.deepEqual(getPaginationRange({}, 'all'), {
        from: 0,
        to: 0,
        total: 0,
    });
});

test('request baru membatalkan request sebelumnya dan menolak respons terlambat', async () => {
    const requests = createLatestRequest();
    const first = requests.start();
    let resolveOld;
    let displayed;
    const oldResponse = new Promise((resolve) => {
        resolveOld = resolve;
    }).then((value) => {
        if (first.isCurrent()) displayed = value;
    });
    const second = requests.start();
    assert.equal(first.signal.aborted, true);
    assert.equal(first.isCurrent(), false);
    assert.equal(second.isCurrent(), true);
    displayed = 'PO terbaru';
    resolveOld('PO sebelumnya');
    await oldResponse;
    assert.equal(displayed, 'PO terbaru');
});

test('penutupan modal membatalkan request termasuk saat respons sudah diterima', () => {
    const requests = createLatestRequest();
    const pending = requests.start();
    requests.cancel();
    assert.equal(pending.signal.aborted, true);
    assert.equal(pending.isCurrent(), false);
    assert.equal(requests.start().isCurrent(), true);
});

test('respons HTTP gagal dan JSON tidak valid menjadi error yang dapat dicoba lagi', async () => {
    await assert.rejects(
        readPoInResponse({ ok: false }, 'Gagal memuat'),
        /Gagal memuat/,
    );
    await assert.rejects(
        readPoInResponse(
            {
                ok: true,
                json: async () => {
                    throw new SyntaxError();
                },
            },
            'Gagal memuat',
        ),
        /Gagal memuat/,
    );
    await assert.rejects(
        readPoInResponse({ ok: true, json: async () => null }, 'Gagal memuat'),
        /Gagal memuat/,
    );
    assert.deepEqual(
        await readPoInResponse(
            {
                ok: true,
                json: async () => ({
                    purchaseOrderIns: [],
                    pagination: { total: 0 },
                }),
            },
            'Gagal memuat',
        ),
        { purchaseOrderIns: [], pagination: { total: 0 } },
    );
});
