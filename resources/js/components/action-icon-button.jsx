import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ActionIconButton({
    label,
    children,
    tooltipSide = 'top',
    ...buttonProps
}) {
    const isAsChild = Boolean(buttonProps.asChild);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label={label}
                    title={label}
                    type={isAsChild ? undefined : 'button'}
                    {...buttonProps}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>{label}</TooltipContent>
        </Tooltip>
    );
}
