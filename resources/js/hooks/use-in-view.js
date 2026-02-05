import { useEffect, useRef, useState } from 'react';

export default function useInView(options = {}) {
    const {
        root = null,
        rootMargin = '200px',
        threshold = 0,
        once = true,
    } = options;

    const ref = useRef(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (!ref.current) return;
        if (inView && once) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry) return;
                if (entry.isIntersecting) {
                    setInView(true);
                    if (once) observer.disconnect();
                } else if (!once) {
                    setInView(false);
                }
            },
            { root, rootMargin, threshold },
        );

        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [root, rootMargin, threshold, once, inView]);

    return { ref, inView };
}

