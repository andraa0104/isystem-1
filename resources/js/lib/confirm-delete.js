import Swal from 'sweetalert2';

export async function confirmDelete({
    title = 'Hapus data?',
    text = 'Data yang dihapus tidak bisa dikembalikan.',
    confirmText = 'Ya, hapus',
    cancelText = 'Batal',
}) {
    const prevBodyPointerEvents = document.body.style.pointerEvents;
    const result = await Swal.fire({
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        reverseButtons: true,
        heightAuto: false,
        didOpen: () => {
            const container = Swal.getContainer();
            if (container) {
                container.style.zIndex = '9999';
                container.style.pointerEvents = 'auto';
            }
            document.body.style.pointerEvents = 'auto';
        },
        willClose: () => {
            document.body.style.pointerEvents = prevBodyPointerEvents || '';
        },
    });

    return Boolean(result.isConfirmed);
}

