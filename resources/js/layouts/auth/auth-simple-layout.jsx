import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import { Link } from '@inertiajs/react';
export default function AuthSimpleLayout({ children, title, description, }) {
    return (<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-1">
            <div className="w-full max-w-sm">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col items-center gap-0.5">
                        <Link href={home()} className="flex flex-col items-center gap-6 font-medium">
                            <div className="flex size-40 items-center justify-center rounded-md">
                                <AppLogoIcon className="size-full object-contain"/>
                            </div>
                            <span className="sr-only">{title}</span>
                        </Link>
                        <div className="rounded-full bg-muted px-6 py-1.5 text-center text-sm font-semibold tracking-wide text-muted-foreground">
                            <div className="whitespace-nowrap">Enterprise Resource Planning (ERP) i-System</div>
                            <div>Version 1.0</div>
                        </div>

                        <div className="space-y-2 text-center">
                            <h1 className="text-xl font-medium">{title}</h1>
                            <p className="text-center text-sm text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>);
}
