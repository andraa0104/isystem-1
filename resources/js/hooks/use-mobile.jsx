import { useSyncExternalStore } from 'react';

// Note:
// On desktop, browser zoom can reduce the viewport width (CSS px) below breakpoints,
// which would incorrectly force "mobile" navigation. We gate "mobile" to touch-like
// devices using hover/pointer media features.
const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px) and (hover: none) and (pointer: coarse)`;

const mql = typeof window === 'undefined' ? undefined : window.matchMedia(QUERY);
function mediaQueryListener(callback) {
    if (!mql) {
        return () => { };
    }
    mql.addEventListener('change', callback);
    return () => {
        mql.removeEventListener('change', callback);
    };
}
function isSmallerThanBreakpoint() {
    var _a;
    return (_a = mql === null || mql === void 0 ? void 0 : mql.matches) !== null && _a !== void 0 ? _a : false;
}
function getServerSnapshot() {
    return false;
}
export function useIsMobile() {
    return useSyncExternalStore(mediaQueryListener, isSmallerThanBreakpoint, getServerSnapshot);
}
