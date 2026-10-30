import { Button } from '@/components/ui/button';
import { canAccessMenuAction, menuKeyForPath } from '@/lib/menu-permissions';
import { usePage } from '@inertiajs/react';

// Gate the whole control so denied actions have no button, link, or tooltip.
// The server still enforces permissions on every mutation request.
export function MenuAction({ action, menu, as: Component = Button, ...props }) {
    const { props: pageProps, url } = usePage();
    const menuKey = menu ?? menuKeyForPath(url);

    return canAccessMenuAction(pageProps.auth?.user, menuKey, action) ? (
        <Component {...props} />
    ) : null;
}
