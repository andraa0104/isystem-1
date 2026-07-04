    const handleRemoveCustomerPo = (refPo) => {
        if (!selectedPr) return;
        
        Swal.fire({
            title: 'Hapus Customer / PO?',
            text: `Yakin ingin menghapus ${refPo} dari PR ini?`,
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

                fetch(`/marketing/purchase-requirement/${selectedPr.no_pr}/remove-po/${refPo}`, {
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
                        
                        // Refetch details
                        handleOpenModal(selectedPr); 
                        router.reload({ only: ['purchaseRequirements', 'purchaseRequirementsOutstanding', 'purchaseRequirementsSisaPo', 'purchaseRequirementsRealized'] });
                    })
                    .catch((error) => {
                        Swal.fire('Gagal!', error.message, 'error');
                    });
            }
        });
    };
