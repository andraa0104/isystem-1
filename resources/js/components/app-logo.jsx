import AppLogoIcon from './app-logo-icon';
export default function AppLogo({ collapsed = false }) {
    return (<>
            <div className="flex aspect-square size-11 items-center justify-center">
                <AppLogoIcon className="size-full object-contain"/>
            </div>
            <div className={`ml-1 grid flex-1 text-left text-sm ${collapsed ? 'hidden' : ''}`}>
                <span className="mb-0.5 truncate leading-tight font-semibold">
                    i-System V1.0
                </span>
            </div>
        </>);
}
