type DockNavigationWindow = Window & {
    __solitudeDockNavigationGuardReady?: boolean;
};

const DOCK_ROUTE_SELECTOR = 'a[data-dock-route]';
const DOCK_NAVIGATION_PENDING_ATTRIBUTE = 'data-dock-navigation-pending';
let pendingDockRoute: HTMLAnchorElement | null = null;

type BeforePreparationEvent = Event & {
    signal?: AbortSignal;
};

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

function clearDockNavigationPending(expectedRoute?: HTMLAnchorElement): void {
    if (expectedRoute && pendingDockRoute !== expectedRoute) return;

    document.documentElement.removeAttribute(DOCK_NAVIGATION_PENDING_ATTRIBUTE);
    pendingDockRoute?.removeAttribute(DOCK_NAVIGATION_PENDING_ATTRIBUTE);
    pendingDockRoute?.removeAttribute('aria-busy');
    pendingDockRoute = null;
}

function markDockNavigationPending(link: HTMLAnchorElement): void {
    clearDockNavigationPending();
    pendingDockRoute = link;
    document.documentElement.setAttribute(DOCK_NAVIGATION_PENDING_ATTRIBUTE, 'true');
    link.setAttribute(DOCK_NAVIGATION_PENDING_ATTRIBUTE, 'true');
    link.setAttribute('aria-busy', 'true');
}

function handleBeforePreparation(event: BeforePreparationEvent): void {
    const routeForNavigation = pendingDockRoute;
    if (!routeForNavigation) return;
    event.signal?.addEventListener('abort', () => clearDockNavigationPending(routeForNavigation), {
        once: true,
    });
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
        return;
    }

    if (current.origin === destination.origin) markDockNavigationPending(link);
}

export function initDockNavigationGuard(): void {
    const dockWindow = window as DockNavigationWindow;
    if (dockWindow.__solitudeDockNavigationGuardReady) return;

    dockWindow.__solitudeDockNavigationGuardReady = true;
    document.addEventListener('click', handleDockRouteClick, { capture: true });
    document.addEventListener('astro:before-preparation', (event) =>
        handleBeforePreparation(event as BeforePreparationEvent)
    );
    document.addEventListener('astro:after-swap', () => clearDockNavigationPending());
    document.addEventListener('astro:page-load', () => clearDockNavigationPending());
}
