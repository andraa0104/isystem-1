    const uniqueCustomerPOs = useMemo(() => {
        if (!materialItems || materialItems.length === 0) return [];
        const map = new Map();
        materialItems.forEach((d) => {
            if (d.refPo && !map.has(d.refPo)) {
                map.set(d.refPo, d.forCustomer);
            }
        });
        return Array.from(map.entries()).map(([ref_po, customer]) => ({ ref_po, customer }));
    }, [materialItems]);

    const handleRemoveCustomerPo = (refPo) => {
        const noPr = purchaseRequirement?.no_pr;
        if (!noPr) return;
        
        Swal.fire({
            title: 'Hapus Customer / PO?',
            text: `Yakin ingin menghapus ${refPo} dari PR ini? Proses ini tidak dapat dibatalkan.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#3b82f6',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Memproses...',
                    text: 'Sedang menghapus data dari PR...',
                    didOpen: () => Swal.showLoading(),
                });

                fetch(`/marketing/purchase-requirement/${noPr}/remove-po/${refPo}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]')?.content,
                        Accept: 'application/json',
                    },
                })
                .then((response) => response.json().then((data) => ({ status: response.status, data })))
                .then(({ status, data }) => {
                    if (status >= 400) throw new Error(data.message || 'Gagal menghapus Customer dari PR');
                    Swal.fire('Terhapus!', 'Customer/PO berhasil dihapus dari PR.', 'success');
                    
                    // Reload the edit page to fetch the remaining records cleanly from backend state
                    router.reload({
                        only: ['purchaseRequirement', 'purchaseRequirementDetails'] 
                    });
                })
                .catch((error) => {
                    Swal.fire('Gagal!', error.message, 'error');
                });
            }
        });
    };
