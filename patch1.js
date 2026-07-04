    const uniqueCustomerPOs = useMemo(() => {
        if (!selectedDetails || selectedDetails.length === 0) return [];
        const map = new Map();
        selectedDetails.forEach((d) => {
            if (d.ref_po && !map.has(d.ref_po)) {
                map.set(d.ref_po, d.for_customer);
            }
        });
        return Array.from(map.entries()).map(([ref_po, customer]) => ({ ref_po, customer }));
    }, [selectedDetails]);
