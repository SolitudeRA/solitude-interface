import {
    clearPostArchiveScroll,
    clearPostInputModality,
    clearPostReturnUrl,
    readPostArchiveScroll,
    readPostDestination,
    readPostInputModality,
    readPostReturnUrl,
    readPostViewScroll,
    rememberPostArchiveScroll,
    rememberPostDestination,
    rememberPostInputModality,
    rememberPostReturnUrl,
    rememberPostViewScroll,
    type PostArchiveScrollState,
    type PostInputModality,
} from './navigationState';
import { POST_ARCHIVE_RENDER_EVENT } from './postArchiveStateController';
import {
    getPostViewMode,
    isPostViewPath,
    toPathWithSearchAndHash,
    type PostViewMode,
} from './routeModel';
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

type PendingMainFocus = {
    destination: string;
};

type PendingPostReturnFocus = {
    selectedPath: string;
    preferredView: PostViewMode;
};

const POST_TRANSITION_MEDIA_SELECTOR = '[data-post-transition-media]';
const POST_TRANSITION_NAMED_SELECTOR = '[data-post-transition-media], [data-post-transition-title]';
const POST_TRANSITION_SOURCE_SELECTOR = 'a[data-post-transition-source]';
const SITE_MAIN_SELECTOR = '[data-site-main-content]';
let pendingPostArchiveScroll: PostArchiveScrollState | null = null;
let pendingMainFocus: PendingMainFocus | null = null;
let pendingPostReturnFocus: PendingPostReturnFocus | null = null;
let postReturnFocusScheduled = false;
let postArchiveFocusReady = false;
let currentInputModality: PostInputModality = 'pointer';

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

function rememberArchiveScroll(link: HTMLAnchorElement): void {
    const archiveRoot = link.closest<HTMLElement>('[data-post-list-root]');
    const layout = archiveRoot?.dataset.archiveLayout?.trim();
    const page = Number.parseInt(archiveRoot?.dataset.archivePage ?? '', 10);
    if (!archiveRoot || !layout || !Number.isSafeInteger(page) || page < 1) {
        rememberPostArchiveScroll(null);
        return;
    }

    const outerScroll = archiveRoot.querySelector<HTMLElement>('[data-archive-scroll-root]');
    const group = link.dataset.archiveGroupKey?.trim() || null;
    const groupList = group
        ? Array.from(archiveRoot.querySelectorAll<HTMLElement>('[data-archive-group-list]')).find(
              (element) => element.dataset.archiveGroupList === group
          )
        : null;

    rememberPostArchiveScroll({
        layout,
        page,
        outerTop: outerScroll?.scrollTop ?? 0,
        group,
        groupTop: groupList?.scrollTop ?? 0,
    });
}

function prepareMainFocus(event: BeforePreparationEvent, skip: boolean): void {
    pendingMainFocus = null;

    const destination = event.to;
    if (skip || !destination || destination.origin !== window.location.origin) return;
    if (destination.hash) return;
    if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
    ) {
        return;
    }

    const request = { destination: `${destination.pathname}${destination.search}` };
    pendingMainFocus = request;
    event.signal?.addEventListener(
        'abort',
        () => {
            if (pendingMainFocus === request) pendingMainFocus = null;
        },
        { once: true }
    );
}

function handleKeyboardInput(): void {
    currentInputModality = 'keyboard';
}

function handlePointerInput(): void {
    currentInputModality = 'pointer';
}

function handlePostSourceClick(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest<HTMLAnchorElement>(POST_TRANSITION_SOURCE_SELECTOR);
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin) return;

    pendingPostArchiveScroll = null;
    clearPostTransitionSource();
    armPostTransitionSource(link);

    const isPostSource = Boolean(document.querySelector('[data-page-stage="posts"]'));
    if (isPostSource) {
        setSiteTransition(SITE_TRANSITIONS.postForward);
    }

    rememberPostDestination(destination.pathname);
    if (!isPostSource) return;

    rememberPostInputModality(currentInputModality);

    const returnUrl = new URL(window.location.href);
    const archiveGroup = link.dataset.archiveGroupKey?.trim();
    const archiveGroupPage = Number.parseInt(link.dataset.archiveGroupPage ?? '', 10);
    if (archiveGroup) {
        returnUrl.searchParams.set('archiveGroup', archiveGroup);
        if (Number.isFinite(archiveGroupPage) && archiveGroupPage > 1) {
            returnUrl.searchParams.set('archiveGroupPage', String(archiveGroupPage));
        } else {
            returnUrl.searchParams.delete('archiveGroupPage');
        }
    } else {
        returnUrl.searchParams.delete('archiveGroup');
        returnUrl.searchParams.delete('archiveGroupPage');
    }
    rememberPostReturnUrl(toPathWithSearchAndHash(returnUrl));
    const scrollContainer = link.closest<HTMLElement>('[data-post-view-scroll]');
    rememberPostViewScroll(scrollContainer?.scrollLeft ?? null);
    rememberArchiveScroll(link);
}

function handleBeforePreparation(event: BeforePreparationEvent): void {
    const isPostReturn = Boolean(
        document.querySelector('.solitude-article-meta-motion-media') &&
        event.to &&
        isPostViewPath(event.to.pathname)
    );
    const isPostForward = getActiveTransition() === SITE_TRANSITIONS.postForward;
    prepareMainFocus(event, isPostReturn || isPostForward);

    if (!isPostReturn) {
        pendingPostReturnFocus = null;
        postArchiveFocusReady = false;
    }

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

function findReturnTarget(
    newDocument: Document,
    selectedPath: string,
    preferredView?: PostViewMode
): HTMLAnchorElement | null {
    const candidateLinks = Array.from(
        newDocument.querySelectorAll<HTMLAnchorElement>(POST_TRANSITION_SOURCE_SELECTOR)
    );
    const storedDestination = parseStoredLocalUrl(readPostReturnUrl());
    const resolvedPreferredView =
        preferredView ?? (storedDestination ? getPostViewMode(storedDestination) : 'gallery');
    const preferredSection = newDocument.querySelector(
        `[data-view-section="${resolvedPreferredView}"]`
    );
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

function focusMainContentAfterNavigation(): void {
    const request = pendingMainFocus;
    if (!request) return;
    const currentLocation = `${window.location.pathname}${window.location.search}`;
    if (request.destination !== currentLocation) return;

    pendingMainFocus = null;
    if (isSiteTransition(getActiveTransition())) return;

    const mainContent = document.querySelector<HTMLElement>(SITE_MAIN_SELECTOR);
    mainContent?.focus({ preventScroll: true });
}

function focusPendingPostReturnTarget(): void {
    const pendingFocus = pendingPostReturnFocus;
    if (!pendingFocus) return;

    const target = findReturnTarget(
        document,
        pendingFocus.selectedPath,
        pendingFocus.preferredView
    );
    if (!target) return;

    const targetSection = target.closest<HTMLElement>('[data-view-section]');
    if (targetSection?.hidden) return;
    if (target.closest('[data-post-list-root]') && !postArchiveFocusReady) return;

    target.focus({ preventScroll: true });
    pendingPostReturnFocus = null;
}

function schedulePostReturnFocus(): void {
    if (!pendingPostReturnFocus || postReturnFocusScheduled) return;
    postReturnFocusScheduled = true;

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            postReturnFocusScheduled = false;
            focusPendingPostReturnTarget();
        });
    });
}

function preparePostReturnFocus(): void {
    const inputModality = readPostInputModality();
    const selectedPath = readPostDestination();
    const storedDestination = parseStoredLocalUrl(readPostReturnUrl());
    clearPostInputModality();

    pendingPostReturnFocus =
        inputModality === 'keyboard' && selectedPath
            ? {
                  selectedPath,
                  preferredView: storedDestination ? getPostViewMode(storedDestination) : 'gallery',
              }
            : null;
    schedulePostReturnFocus();
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

    pendingPostArchiveScroll = readPostArchiveScroll();
    postArchiveFocusReady = false;
    restorePendingPostArchiveScroll();
    preparePostReturnFocus();

    clearPostReturnUrl();
}

function restoreScrollTop(element: HTMLElement, scrollTop: number): void {
    const previousScrollBehavior = element.style.scrollBehavior;
    element.style.scrollBehavior = 'auto';
    element.scrollTop = scrollTop;
    void element.offsetWidth;

    window.requestAnimationFrame(() => {
        if (previousScrollBehavior) {
            element.style.scrollBehavior = previousScrollBehavior;
        } else {
            element.style.removeProperty('scroll-behavior');
        }
    });
}

function restorePendingPostArchiveScroll(): void {
    const snapshot = pendingPostArchiveScroll;
    if (!snapshot) return;

    const archiveRoot = document.querySelector<HTMLElement>('[data-post-list-root]');
    const page = Number.parseInt(archiveRoot?.dataset.archivePage ?? '', 10);
    if (
        !archiveRoot ||
        archiveRoot.dataset.archiveLayout !== snapshot.layout ||
        page !== snapshot.page
    ) {
        return;
    }

    const outerScroll = archiveRoot.querySelector<HTMLElement>('[data-archive-scroll-root]');
    const groupList = snapshot.group
        ? Array.from(archiveRoot.querySelectorAll<HTMLElement>('[data-archive-group-list]')).find(
              (element) => element.dataset.archiveGroupList === snapshot.group
          )
        : null;
    if (!outerScroll || (snapshot.group && !groupList)) return;

    restoreScrollTop(outerScroll, snapshot.outerTop);
    if (groupList) restoreScrollTop(groupList, snapshot.groupTop);
    pendingPostArchiveScroll = null;
    clearPostArchiveScroll();
}

function handlePostArchiveRender(): void {
    restorePendingPostArchiveScroll();
    postArchiveFocusReady = true;
    schedulePostReturnFocus();
}

export function initSiteNavigationMotion(): void {
    const siteMotionWindow = window as SiteMotionWindow;
    if (siteMotionWindow.__solitudeSiteMotionReady) return;

    siteMotionWindow.__solitudeSiteMotionReady = true;
    document.addEventListener('keydown', handleKeyboardInput, { capture: true });
    document.addEventListener('pointerdown', handlePointerInput, { capture: true });
    document.addEventListener('click', handlePostSourceClick, { capture: true });
    document.addEventListener('astro:before-preparation', (event) =>
        handleBeforePreparation(event as BeforePreparationEvent)
    );
    document.addEventListener('astro:before-swap', (event) =>
        handleBeforeSwap(event as BeforeSwapEvent)
    );
    document.addEventListener('astro:after-swap', restorePostViewScroll);
    document.addEventListener('astro:page-load', applyPostReturnHref);
    document.addEventListener('astro:page-load', focusMainContentAfterNavigation);
    document.addEventListener('astro:page-load', schedulePostReturnFocus);
    window.addEventListener(POST_ARCHIVE_RENDER_EVENT, handlePostArchiveRender);
    window.addEventListener('post-view-change', schedulePostReturnFocus);
    applyPostReturnHref();
}
