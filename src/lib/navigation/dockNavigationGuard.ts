type DockNavigationWindow = Window & {
    __solitudeDockNavigationGuardReady?: boolean;
};

const DOCK_ROUTE_SELECTOR = 'a[data-dock-route]';

export function normalizeDockPathname(pathname: string): string {
    const normalized = pathname.replace(/\/+$/, '');
    return normalized || '/';
}

export function isCurrentDockDestination(current: URL, destination: URL): boolean {
    return (
        current.origin === destination.origin &&
        normalizeDockPathname(current.pathname) === normalizeDockPathname(destination.pathname)
    );
}

function handleDockRouteClick(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest<HTMLAnchorElement>(DOCK_ROUTE_SELECTOR);
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const current = new URL(window.location.href);
    const destination = new URL(link.href, current);
    if (isCurrentDockDestination(current, destination)) {
        event.preventDefault();
    }
}

export function initDockNavigationGuard(): void {
    const dockWindow = window as DockNavigationWindow;
    if (dockWindow.__solitudeDockNavigationGuardReady) return;

    dockWindow.__solitudeDockNavigationGuardReady = true;
    document.addEventListener('click', handleDockRouteClick, { capture: true });
}
