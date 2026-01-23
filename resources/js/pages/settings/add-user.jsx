import AddUserController from '@/actions/App/Http/Controllers/Settings/AddUserController';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Form, Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const breadcrumbs = [
    {
        title: 'Manage user',
        href: '/settings/add-user',
    },
];

export default function AddUser() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [users, setUsers] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchUsers = () => {
        setLoading(true);
        setLoadError('');
        const params = new URLSearchParams();
        params.set(
            'per_page',
            pageSize === Infinity ? 'all' : String(pageSize)
        );
        params.set('page', String(currentPage));
        if (debouncedSearch) {
            params.set('search', debouncedSearch);
        }
        fetch(`/settings/add-user/data?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setUsers(Array.isArray(data?.data) ? data.data : []);
                setTotalPages(Number(data?.meta?.total_pages) || 1);
            })
            .catch(() => {
                setLoadError('Gagal memuat data user.');
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchUsers();
    }, [pageSize, currentPage, debouncedSearch]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Manage user" />

            <h1 className="sr-only">Manage User</h1>

            <SettingsLayout wide>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Manage user"
                        description="Kelola data pengguna dan hak akses"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        pageSize === Infinity
                                            ? 'all'
                                            : pageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value)
                                        );
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                            <label>
                                Cari User
                                <input
                                    type="search"
                                    className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                    placeholder="Cari kode, nama, atau username..."
                                    value={searchTerm}
                                    onChange={(event) => {
                                        setSearchTerm(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </label>
                        </div>
                        <Button onClick={() => setIsModalOpen(true)}>
                            Add New User
                        </Button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        Kode User
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Full Name
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        No HP
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Username
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Password
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Level
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Sesi
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        Last Online
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td
                                            className="px-4 py-6 text-center text-muted-foreground"
                                            colSpan={8}
                                        >
                                            Memuat data user...
                                        </td>
                                    </tr>
                                )}
                                {!loading && loadError && (
                                    <tr>
                                        <td
                                            className="px-4 py-6 text-center text-rose-600"
                                            colSpan={8}
                                        >
                                            {loadError}
                                        </td>
                                    </tr>
                                )}
                                {!loading && !loadError && users.length === 0 && (
                                    <tr>
                                        <td
                                            className="px-4 py-6 text-center text-muted-foreground"
                                            colSpan={8}
                                        >
                                            Data user belum tersedia.
                                        </td>
                                    </tr>
                                )}
                                {!loading &&
                                    !loadError &&
                                    users.map((user, index) => (
                                    <tr
                                        key={`${user.kd_user}-${index}`}
                                        className="border-t border-sidebar-border/70"
                                    >
                                        <td className="px-4 py-3">
                                            {user.kd_user ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.nm_user ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.no_hp ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.pengguna ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.pass ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.tingkat ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.Sesi ?? '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.LastOnline ?? '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pageSize !== Infinity && totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>
                                Halaman {currentPage} dari {totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((page) =>
                                            Math.max(1, page - 1)
                                        )
                                    }
                                    disabled={currentPage === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((page) =>
                                            Math.min(totalPages, page + 1)
                                        )
                                    }
                                    disabled={currentPage === totalPages}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </SettingsLayout>

            {isModalOpen && (
                <Dialog
                    open={isModalOpen}
                    onOpenChange={(open) => setIsModalOpen(open)}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New User</DialogTitle>
                        </DialogHeader>
                        <Form
                            {...AddUserController.store.form()}
                            options={{
                                preserveScroll: true,
                                onSuccess: () => {
                                    setIsModalOpen(false);
                                    setCurrentPage(1);
                                    fetchUsers();
                                },
                            }}
                            className="space-y-4"
                            resetOnSuccess={['password']}
                        >
                            {({ errors, processing }) => (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            placeholder="Full name"
                                            autoComplete="name"
                                        />
                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="username">
                                            Username
                                        </Label>
                                        <Input
                                            id="username"
                                            name="username"
                                            placeholder="Username"
                                            autoComplete="username"
                                        />
                                        <InputError message={errors.username} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Nomor HP</Label>
                                        <Input
                                            id="phone"
                                            name="phone"
                                            placeholder="Nomor HP"
                                            autoComplete="tel"
                                        />
                                        <InputError message={errors.phone} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password">
                                            Password
                                        </Label>
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            placeholder="Password"
                                            autoComplete="new-password"
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="level">Level User</Label>
                                        <select
                                            id="level"
                                            name="level"
                                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                            defaultValue="User-Marketing"
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="User-Marketing">
                                                User-Marketing
                                            </option>
                                            <option value="User-Pembelian">
                                                User-Pembelian
                                            </option>
                                            <option value="User-Penjualan">
                                                User-Penjualan
                                            </option>
                                            <option value="User-Keuangan">
                                                User-Keuangan
                                            </option>
                                        </select>
                                        <InputError message={errors.level} />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setIsModalOpen(false)
                                            }
                                        >
                                            Batal
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            Simpan
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>
            )}
        </AppLayout>
    );
}
