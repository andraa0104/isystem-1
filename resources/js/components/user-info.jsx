import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
export function UserInfo({ user, showName = true, showEmail = false, }) {
    const getInitials = useInitials();
    const name = user?.name ?? 'Guest';
    const email = user?.email ?? '';
    const avatar = user?.avatar ?? '';
    return (<>
            <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                <AvatarImage src={avatar} alt={name}/>
                <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                    {getInitials(name)}
                </AvatarFallback>
            </Avatar>
            {showName && (<div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    {showEmail && (<span className="truncate text-xs text-muted-foreground">
                            {email}
                        </span>)}
                </div>)}
        </>);
}
