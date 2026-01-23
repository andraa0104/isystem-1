import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    getMainItemKey,
    getSectionItemKey,
    mainMenuItems,
    menuSections,
} from '@/data/menu-sections';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    {
        title: 'Privilege access',
        href: '/settings/privilege-access',
    },
];

export default function PrivilegeAccess() {
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [users, setUsers] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [menuAccess, setMenuAccess] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const fetchUsers = () => {
        setLoading(true);
        setLoadError('');
        const params = new URLSearchParams();
        params.set(
            'per_page',
            pageSize === Infinity ? 'all' : String(pageSize)
        );
        params.set('page', String(currentPage));
        fetch(`/settings/privilege-access/data?${params.toString()}`, {
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
    }, [pageSize, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        fetchPrivileges(selectedUser);
        setSaveMessage('');
    }, [selectedUser]);

    const selectedLabel = useMemo(() => {
        if (!selectedUser) return 'Belum dipilih';
        return `${selectedUser.nm_user ?? '-'} (${selectedUser.tingkat ?? '-'})`;
    }, [selectedUser]);

    const toggleAccess = (key) => {
        setMenuAccess((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const setGroupAccess = (keys, checked) => {
        setMenuAccess((prev) => {
            const next = { ...prev };
            keys.forEach((key) => {
                next[key] = checked;
            });
            return next;
        });
    };

    const fetchPrivileges = (user) => {
        if (!user?.kd_user) {
            setMenuAccess({});
            return;
        }
        fetch(
            `/settings/privilege-access/privileges?kd_user=${encodeURIComponent(
                user.kd_user
            )}`,
            { headers: { Accept: 'application/json' } }
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setMenuAccess(data?.data ?? {});
            })
            .catch(() => {
                setMenuAccess({});
            });
    };

    const handleSave = () => {
        if (!selectedUser?.kd_user) {
            return;
        }
        setSaving(true);
        setSaveMessage('');
        fetch('/settings/privilege-access/privileges', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                kd_user: selectedUser.kd_user,
                menus: menuAccess,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setSaveMessage(data?.message ?? 'Privilege berhasil disimpan.');
            })
            .catch(() => {
                setSaveMessage('Gagal menyimpan privilege.');
            })
            .finally(() => setSaving(false));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Privilege access" />

            <h1 className="sr-only">Privilege Access</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Privilege access"
                        description="Manage access per role and module"
                    />

                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
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
                            <div className="text-sm">
                                User terpilih: {selectedLabel}
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            Nama
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Level
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={3}
                                            >
                                                Memuat data user...
                                            </td>
                                        </tr>
                                    )}
                                    {!loading && loadError && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-rose-600"
                                                colSpan={3}
                                            >
                                                {loadError}
                                            </td>
                                        </tr>
                                    )}
                                    {!loading &&
                                        !loadError &&
                                        users.length === 0 && (
                                            <tr>
                                                <td
                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                    colSpan={3}
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
                                                    {user.nm_user ?? '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {user.tingkat ?? '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                            <Button
                                                size="sm"
                                                variant={
                                                    selectedUser?.kd_user ===
                                                    user.kd_user
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                onClick={() =>
                                                    setSelectedUser(user)
                                                }
                                            >
                                                Pilih
                                            </Button>
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

                    <form className="space-y-6">
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium">Main</h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {mainMenuItems.map((item) => {
                                        const key = getMainItemKey(item.title);
                                        return (
                                            <div
                                                key={key}
                                                className="flex items-center gap-3"
                                            >
                                                <Checkbox
                                                    id={key}
                                                    checked={!!menuAccess[key]}
                                                    onCheckedChange={() =>
                                                        toggleAccess(key)
                                                    }
                                                />
                                                <Label htmlFor={key}>
                                                    {item.title}
                                                </Label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {menuSections.map((group) => (
                                <div key={group.title} className="space-y-3">
                                    {(() => {
                                        const groupKeys = group.items.map(
                                            (item) =>
                                                getSectionItemKey(
                                                    group.title,
                                                    item.title
                                                )
                                        );
                                        const allChecked =
                                            groupKeys.length > 0 &&
                                            groupKeys.every(
                                                (key) => menuAccess[key]
                                            );
                                        const someChecked = groupKeys.some(
                                            (key) => menuAccess[key]
                                        );
                                        const groupState = allChecked
                                            ? true
                                            : someChecked
                                            ? 'indeterminate'
                                            : false;

                                        return (
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id={`group-${group.title}`}
                                                    checked={groupState}
                                                    onCheckedChange={(value) =>
                                                        setGroupAccess(
                                                            groupKeys,
                                                            value === true
                                                        )
                                                    }
                                                />
                                                <Label
                                                    htmlFor={`group-${group.title}`}
                                                    className="text-sm font-medium"
                                                >
                                                    {group.title}
                                                </Label>
                                            </div>
                                        );
                                    })()}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {group.items.map((item) => {
                                            const key = getSectionItemKey(
                                                group.title,
                                                item.title
                                            );
                                            return (
                                                <div
                                                    key={key}
                                                    className="flex items-center gap-3"
                                                >
                                                    <Checkbox
                                                        id={key}
                                                        checked={
                                                            !!menuAccess[key]
                                                        }
                                                        onCheckedChange={() =>
                                                            toggleAccess(key)
                                                        }
                                                    />
                                                    <Label htmlFor={key}>
                                                        {item.title}
                                                    </Label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-4">
                            <Button
                                type="button"
                                disabled={!selectedUser || saving}
                                onClick={handleSave}
                            >
                                {saving ? 'Menyimpan...' : 'Save privilege'}
                            </Button>
                            {saveMessage && (
                                <span className="text-sm text-muted-foreground">
                                    {saveMessage}
                                </span>
                            )}
                        </div>
                    </form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
