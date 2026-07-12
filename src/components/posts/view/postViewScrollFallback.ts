import { isPostViewPath } from '@lib/navigation/routeModel';

type PostViewScrollWindow = Window & {
    __solitudePostViewBoundContainers?: WeakSet<HTMLElement>;
    __solitudePostViewScrollReady?: boolean;
};

const POST_VIEW_SCROLL_SELECTOR = '[data-post-view-scroll]';
const HYDRATED_DATASET_KEY = 'postViewHydrated';

function getScrollDistance(container: HTMLElement): number {
    const card = container.querySelector<HTMLElement>('.post-card-wrapper');
    const containerStyles = window.getComputedStyle(container);
    const cardWidth = card?.getBoundingClientRect().width ?? 300;
    const gap = Number.parseFloat(containerStyles.columnGap) || 60;

    return cardWidth + gap;
}

function bindContainerWheel(container: HTMLElement, reducedMotionQuery: MediaQueryList): void {
    container.addEventListener(
        'wheel',
        (event) => {
            if (container.dataset[HYDRATED_DATASET_KEY] === 'true') return;

            const dominantDelta =
                Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (dominantDelta === 0) return;

            const { scrollWidth, clientWidth, scrollLeft } = container;
            const canScroll = scrollWidth > clientWidth;
            const atStart = scrollLeft <= 0 && dominantDelta < 0;
            const atEnd = scrollLeft >= scrollWidth - clientWidth && dominantDelta > 0;
            if (!canScroll || atStart || atEnd) return;

            event.preventDefault();
            event.stopPropagation();

            const isHorizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY);
            const direction = dominantDelta > 0 ? 1 : -1;
            container.scrollBy({
                left: isHorizontalGesture ? event.deltaX : direction * getScrollDistance(container),
                behavior: isHorizontalGesture || reducedMotionQuery.matches ? 'auto' : 'smooth',
            });
        },
        { passive: false }
    );
}

function bindPostViewScroll(): void {
    if (!isPostViewPath(window.location.pathname)) return;

    const postViewWindow = window as PostViewScrollWindow;
    const boundContainers =
        postViewWindow.__solitudePostViewBoundContainers ??
        (postViewWindow.__solitudePostViewBoundContainers = new WeakSet());
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.querySelectorAll<HTMLElement>(POST_VIEW_SCROLL_SELECTOR).forEach((container) => {
        if (boundContainers.has(container)) return;
        boundContainers.add(container);
        bindContainerWheel(container, reducedMotionQuery);
    });
}

export function initPostViewScrollFallback(): void {
    const postViewWindow = window as PostViewScrollWindow;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindPostViewScroll, { once: true });
    } else {
        bindPostViewScroll();
    }

    if (!postViewWindow.__solitudePostViewScrollReady) {
        postViewWindow.__solitudePostViewScrollReady = true;
        document.addEventListener('astro:page-load', bindPostViewScroll);
    }
}
