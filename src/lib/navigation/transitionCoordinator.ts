import {
    clearPostReturnUrl,
    readPostDestination,
    readPostReturnUrl,
    readPostViewScroll,
    rememberPostDestination,
    rememberPostReturnUrl,
    rememberPostViewScroll,
} from './navigationState';
import { getPostViewMode, isPostViewPath, toPathWithSearchAndHash } from './routeModel';
import {
    isSiteTransition,
    SITE_TRANSITION_ATTRIBUTE,
    SITE_TRANSITIONS,
    type SiteTransition,
} from './transitionRegistry';

type SiteMotionWindow = Window & {
    __solitudeSiteMotionReady?: boolean;
};

type BeforePreparationEvent = Event & {
    to?: URL;
    signal?: AbortSignal;
};

type BeforeSwapEvent = Event & {
    newDocument?: Document;
    viewTransition?: ViewTransition;
};

const POST_TRANSITION_MEDIA_SELECTOR = '[data-post-transition-media]';
const POST_TRANSITION_NAMED_SELECTOR = '[data-post-transition-media], [data-post-transition-title]';
const POST_TRANSITION_SOURCE_SELECTOR = 'a[data-post-transition-source]';

function getActiveTransition(): string | null {
    return document.documentElement.getAttribute(SITE_TRANSITION_ATTRIBUTE);
}

function setSiteTransition(transition: SiteTransition): void {
    document.documentElement.setAttribute(SITE_TRANSITION_ATTRIBUTE, transition);
}

function clearSiteTransition(expectedTransition?: SiteTransition): void {
    const activeTransition = getActiveTransition();
    if (!expectedTransition || activeTransition === expectedTransition) {
        document.documentElement.removeAttribute(SITE_TRANSITION_ATTRIBUTE);
    }
}

function clearPostTransitionSource(root: Document | Element = document): void {
    root.querySelectorAll<HTMLElement>(POST_TRANSITION_NAMED_SELECTOR).forEach((element) =>
        element.style.removeProperty('view-transition-name')
    );
}

function parseStoredLocalUrl(value: string | null): URL | null {
    if (!value) return null;

    try {
        const url = new URL(value, window.location.origin);
        return url.origin === window.location.origin ? url : null;
    } catch {
        return null;
    }
}

function armPostTransitionSource(link: HTMLAnchorElement): void {
    const destinationPath = new URL(link.href, window.location.origin).pathname;
    const root = link.ownerDocument;
    const scope = link.closest('[data-view-section]') ?? root;
    const directMedia = link.querySelector<HTMLElement>(POST_TRANSITION_MEDIA_SELECTOR);
    const fallbackMedia = Array.from(
        scope.querySelectorAll<HTMLAnchorElement>(POST_TRANSITION_SOURCE_SELECTOR)
    )
        .find(
            (candidate) =>
                new URL(candidate.href, window.location.origin).pathname === destinationPath &&
                candidate.querySelector(POST_TRANSITION_MEDIA_SELECTOR)
        )
        ?.querySelector<HTMLElement>(POST_TRANSITION_MEDIA_SELECTOR);
    const media =
        directMedia ??
        (window.matchMedia('(min-width: 1024px)').matches ? fallbackMedia : undefined);

    media?.style.setProperty('view-transition-name', 'post-focus-media');
}

function handlePostSourceClick(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest<HTMLAnchorElement>(POST_TRANSITION_SOURCE_SELECTOR);
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin) return;

    clearPostTransitionSource();
    armPostTransitionSource(link);

    const isPostSource = Boolean(document.querySelector('[data-page-stage="posts"]'));
    if (isPostSource) {
        setSiteTransition(SITE_TRANSITIONS.postForward);
    }

    rememberPostDestination(destination.pathname);
    if (!isPostSource) return;

    rememberPostReturnUrl(`${window.location.pathname}${window.location.search}`);
    const scrollContainer = link.closest<HTMLElement>('[data-post-view-scroll]');
    rememberPostViewScroll(scrollContainer?.scrollLeft ?? null);
}

function handleBeforePreparation(event: BeforePreparationEvent): void {
    const isPostReturn = Boolean(
        document.querySelector('.solitude-article-meta-motion-media') &&
        event.to &&
        isPostViewPath(event.to.pathname)
    );

    if (!isPostReturn) {
        clearSiteTransition(SITE_TRANSITIONS.postReturn);
        if (getActiveTransition() === SITE_TRANSITIONS.postForward) {
            event.signal?.addEventListener(
                'abort',
                () => clearSiteTransition(SITE_TRANSITIONS.postForward),
                { once: true }
            );
        }
        return;
    }

    const storedDestination = parseStoredLocalUrl(readPostReturnUrl());
    if (storedDestination && isPostViewPath(storedDestination.pathname)) {
        event.to = storedDestination;
    }

    setSiteTransition(SITE_TRANSITIONS.postReturn);
    event.signal?.addEventListener(
        'abort',
        () => clearSiteTransition(SITE_TRANSITIONS.postReturn),
        { once: true }
    );
}

function finishTransition(activeTransition: SiteTransition): void {
    clearSiteTransition(activeTransition);
    clearPostTransitionSource();
}

function findReturnTarget(newDocument: Document, selectedPath: string): HTMLAnchorElement | null {
    const candidateLinks = Array.from(
        newDocument.querySelectorAll<HTMLAnchorElement>(POST_TRANSITION_SOURCE_SELECTOR)
    );
    const storedDestination = parseStoredLocalUrl(readPostReturnUrl());
    const preferredView = storedDestination ? getPostViewMode(storedDestination) : 'gallery';
    const preferredSection = newDocument.querySelector(`[data-view-section="${preferredView}"]`);
    const matchesSelectedPath = (link: HTMLAnchorElement) =>
        new URL(link.href, window.location.origin).pathname === selectedPath;

    return (
        candidateLinks.find(
            (link) => preferredSection?.contains(link) && matchesSelectedPath(link)
        ) ??
        candidateLinks.find(matchesSelectedPath) ??
        null
    );
}

function handleBeforeSwap(event: BeforeSwapEvent): void {
    const newDocument = event.newDocument;
    if (!newDocument) return;

    const activeTransition = getActiveTransition();
    if (isSiteTransition(activeTransition)) {
        newDocument.documentElement.setAttribute(SITE_TRANSITION_ATTRIBUTE, activeTransition);
        if (event.viewTransition) {
            void event.viewTransition.finished.then(
                () => finishTransition(activeTransition),
                () => finishTransition(activeTransition)
            );
        } else {
            finishTransition(activeTransition);
        }
    }

    if (!document.querySelector('.solitude-article-meta-motion-media')) return;

    const selectedPath = readPostDestination();
    if (!selectedPath) return;

    const matchingLink = findReturnTarget(newDocument, selectedPath);
    if (!matchingLink) return;

    clearPostTransitionSource(newDocument);
    armPostTransitionSource(matchingLink);
}

function applyPostReturnHref(): void {
    const backLink = document.querySelector<HTMLAnchorElement>('.article-back-link');
    if (!backLink) return;

    const destination = parseStoredLocalUrl(readPostReturnUrl());
    if (!destination) return;
    if (!isPostViewPath(destination.pathname)) return;

    backLink.href = toPathWithSearchAndHash(destination);
}

function restorePostViewScroll(): void {
    if (getActiveTransition() !== SITE_TRANSITIONS.postReturn) return;

    const scrollLeft = readPostViewScroll();
    const scrollContainer = document.querySelector<HTMLElement>('[data-post-view-scroll]');
    if (scrollContainer && scrollLeft !== null) {
        const previousScrollBehavior = scrollContainer.style.scrollBehavior;
        const previousScrollSnapType = scrollContainer.style.scrollSnapType;

        scrollContainer.dataset.postViewRestoring = 'true';
        scrollContainer.style.scrollBehavior = 'auto';
        scrollContainer.style.scrollSnapType = 'none';
        scrollContainer.scrollLeft = scrollLeft;
        void scrollContainer.offsetWidth;

        window.requestAnimationFrame(() => {
            if (previousScrollSnapType) {
                scrollContainer.style.scrollSnapType = previousScrollSnapType;
            } else {
                scrollContainer.style.removeProperty('scroll-snap-type');
            }

            window.requestAnimationFrame(() => {
                if (previousScrollBehavior) {
                    scrollContainer.style.scrollBehavior = previousScrollBehavior;
                } else {
                    scrollContainer.style.removeProperty('scroll-behavior');
                }
                delete scrollContainer.dataset.postViewRestoring;
            });
        });
    }

    clearPostReturnUrl();
}

export function initSiteNavigationMotion(): void {
    const siteMotionWindow = window as SiteMotionWindow;
    if (siteMotionWindow.__solitudeSiteMotionReady) return;

    siteMotionWindow.__solitudeSiteMotionReady = true;
    document.addEventListener('click', handlePostSourceClick, { capture: true });
    document.addEventListener('astro:before-preparation', (event) =>
        handleBeforePreparation(event as BeforePreparationEvent)
    );
    document.addEventListener('astro:before-swap', (event) =>
        handleBeforeSwap(event as BeforeSwapEvent)
    );
    document.addEventListener('astro:after-swap', restorePostViewScroll);
    document.addEventListener('astro:page-load', applyPostReturnHref);
    applyPostReturnHref();
}
