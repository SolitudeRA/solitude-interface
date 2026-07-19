// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    readPostArchiveScroll,
    readPostDestination,
    readPostInputModality,
    readPostReturnUrl,
    readPostViewScroll,
    rememberPostDestination,
    rememberPostReturnUrl,
    rememberPostViewScroll,
} from './navigationState';
import { POST_ARCHIVE_RENDER_EVENT } from './postArchiveStateController';
import { initSiteNavigationMotion } from './transitionCoordinator';
import { SITE_TRANSITION_ATTRIBUTE, SITE_TRANSITIONS } from './transitionRegistry';

type AnimationFrameCallback = (time: number) => void;

const frameCallbacks: AnimationFrameCallback[] = [];

function dispatchLifecycleEvent(type: string, properties: Record<string, unknown> = {}): Event {
    const event = new Event(type);
    Object.entries(properties).forEach(([key, value]) => {
        Object.defineProperty(event, key, { configurable: true, writable: true, value });
    });
    document.dispatchEvent(event);
    return event;
}

function setPath(path: string): void {
    window.history.replaceState(null, '', path);
}

function flushAnimationFrames(): void {
    while (frameCallbacks.length > 0) {
        const callback = frameCallbacks.shift();
        callback?.(0);
    }
}

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        value: (callback: AnimationFrameCallback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        },
    });
    initSiteNavigationMotion();
});

beforeEach(() => {
    setPath('/zh/post-view');
    document.documentElement.removeAttribute(SITE_TRANSITION_ATTRIBUTE);
    document.documentElement.removeAttribute('data-post-view-mode');
    document.body.innerHTML = '';
    window.sessionStorage.clear();
    frameCallbacks.length = 0;
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
});

describe('site navigation motion lifecycle', () => {
    it('captures the selected article, return URL, and horizontal position on forward navigation', () => {
        setPath('/zh/post-view?view=list&archive=years');
        document.body.innerHTML = `
            <main data-page-stage="posts">
                <div data-post-view-scroll>
                    <a href="/zh/p/homeserver-1" data-post-transition-source>
                        <img data-post-transition-media alt="" />
                        <span data-post-transition-title>Home server</span>
                    </a>
                </div>
            </main>
        `;
        const scrollContainer = document.querySelector<HTMLElement>('[data-post-view-scroll]')!;
        const link = document.querySelector<HTMLAnchorElement>('a[data-post-transition-source]')!;
        scrollContainer.scrollLeft = 428;
        link.addEventListener('click', (event) => event.preventDefault());

        link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        expect(document.documentElement.getAttribute(SITE_TRANSITION_ATTRIBUTE)).toBe(
            SITE_TRANSITIONS.postForward
        );
        expect(readPostDestination()).toBe('/zh/p/homeserver-1');
        expect(readPostReturnUrl()).toBe('/zh/post-view?view=list&archive=years');
        expect(readPostViewScroll()).toBe(428);
        expect(
            link.querySelector<HTMLElement>('[data-post-transition-media]')?.style
                .viewTransitionName
        ).toBe('post-focus-media');
    });

    it('preserves the outer page and records the clicked archive group page', () => {
        setPath('/zh/post-view?view=list&archive=years&archivePage=2');
        document.body.innerHTML = `
            <main data-page-stage="posts">
                <div data-post-list-root data-archive-page="2">
                    <a href="/zh/p/homeserver-6" data-post-transition-source data-archive-group-key="2024" data-archive-group-page="3">
                        <img data-post-transition-media alt="" />
                    </a>
                </div>
            </main>
        `;
        const link = document.querySelector<HTMLAnchorElement>('a[data-post-transition-source]')!;
        link.addEventListener('click', (event) => event.preventDefault());

        link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        expect(readPostReturnUrl()).toBe(
            '/zh/post-view?view=list&archive=years&archivePage=2&archiveGroup=2024&archiveGroupPage=3'
        );
    });

    it('returns from an article to the selected series without adding its first group page', () => {
        setPath('/zh/post-view?view=list&archive=series&archivePage=2');
        document.body.innerHTML = `
            <main data-page-stage="posts">
                <div data-post-list-root data-archive-layout="series" data-archive-page="2">
                    <a href="/zh/p/homeserver-1" data-post-transition-source data-archive-group-key="home-server" data-archive-group-page="1">
                        <img data-post-transition-media alt="" />
                    </a>
                </div>
            </main>
        `;
        const link = document.querySelector<HTMLAnchorElement>('a[data-post-transition-source]')!;
        link.addEventListener('click', (event) => event.preventDefault());

        link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        expect(readPostReturnUrl()).toBe(
            '/zh/post-view?view=list&archive=series&archivePage=2&archiveGroup=home-server'
        );

        setPath('/zh/p/homeserver-1');
        document.body.innerHTML = '<div class="solitude-article-meta-motion-media"></div>';
        const event = dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/post-view', window.location.origin),
            signal: new AbortController().signal,
        }) as Event & { to: URL };

        expect(event.to.pathname).toBe('/zh/post-view');
        expect(event.to.search).toBe(
            '?view=list&archive=series&archivePage=2&archiveGroup=home-server'
        );
        expect(event.to.searchParams.has('archiveGroupPage')).toBe(false);
    });

    it('restores archive outer and group scroll after the hydrated page matches', () => {
        setPath('/zh/post-view?view=list&archive=series&archivePage=2');
        document.body.innerHTML = `
            <main data-page-stage="posts">
                <div data-post-list-root data-archive-layout="series" data-archive-page="2">
                    <div data-archive-scroll-root>
                        <section>
                            <div data-archive-group-list="guide">
                                <a href="/zh/p/guide-8" data-post-transition-source data-archive-group-key="guide" data-archive-group-page="2">Guide 8</a>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        `;
        const outer = document.querySelector<HTMLElement>('[data-archive-scroll-root]')!;
        const group = document.querySelector<HTMLElement>('[data-archive-group-list]')!;
        const link = document.querySelector<HTMLAnchorElement>('a[data-post-transition-source]')!;
        outer.scrollTop = 418;
        group.scrollTop = 92;
        link.addEventListener('click', (event) => event.preventDefault());
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        expect(readPostArchiveScroll()).toEqual({
            layout: 'series',
            page: 2,
            outerTop: 418,
            group: 'guide',
            groupTop: 92,
        });

        setPath('/zh/p/guide-8');
        document.body.innerHTML = '<div class="solitude-article-meta-motion-media"></div>';
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/post-view', window.location.origin),
            signal: new AbortController().signal,
        });
        document.body.innerHTML = `
            <div data-post-list-root data-archive-layout="ledger" data-archive-page="1">
                <div data-archive-scroll-root></div>
            </div>
        `;
        dispatchLifecycleEvent('astro:after-swap');

        document.body.innerHTML = `
            <div data-post-list-root data-archive-layout="series" data-archive-page="2">
                <div data-archive-scroll-root>
                    <div data-archive-group-list="guide"></div>
                </div>
            </div>
        `;
        window.dispatchEvent(new CustomEvent(POST_ARCHIVE_RENDER_EVENT));

        expect(document.querySelector<HTMLElement>('[data-archive-scroll-root]')?.scrollTop).toBe(
            418
        );
        expect(document.querySelector<HTMLElement>('[data-archive-group-list]')?.scrollTop).toBe(
            92
        );
        expect(readPostArchiveScroll()).toBeNull();
    });

    it('redirects article return navigation to the remembered archive state', () => {
        setPath('/zh/p/homeserver-1');
        document.body.innerHTML = '<div class="solitude-article-meta-motion-media"></div>';
        rememberPostReturnUrl('/zh/post-view?view=list&archive=series&category=tech');
        const controller = new AbortController();
        const event = dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/post-view', window.location.origin),
            signal: controller.signal,
        }) as Event & { to: URL };

        expect(event.to.pathname).toBe('/zh/post-view');
        expect(event.to.search).toBe('?view=list&archive=series&category=tech');
        expect(document.documentElement.getAttribute(SITE_TRANSITION_ATTRIBUTE)).toBe(
            SITE_TRANSITIONS.postReturn
        );

        controller.abort();
        expect(document.documentElement.hasAttribute(SITE_TRANSITION_ATTRIBUTE)).toBe(false);
    });

    it('targets the remembered article in the preferred view and restores scroll before paint', () => {
        setPath('/zh/p/homeserver-1');
        document.body.innerHTML = '<div class="solitude-article-meta-motion-media"></div>';
        rememberPostDestination('/zh/p/homeserver-1');
        rememberPostReturnUrl('/zh/post-view?view=list&archive=years');
        rememberPostViewScroll(612);
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/post-view', window.location.origin),
            signal: new AbortController().signal,
        });

        const newDocument = document.implementation.createHTMLDocument('Posts');
        newDocument.head.innerHTML = `<base href="${window.location.origin}/" />`;
        newDocument.body.innerHTML = `
            <section data-view-section="gallery">
                <a href="/zh/p/homeserver-1" data-post-transition-source>
                    <img data-post-transition-media alt="" />
                </a>
            </section>
            <section data-view-section="list">
                <a href="/zh/p/homeserver-1" data-post-transition-source>
                    <img data-post-transition-media alt="" />
                </a>
            </section>
        `;
        let finishTransition: (() => void) | undefined;
        const finished = new Promise<void>((resolve) => {
            finishTransition = resolve;
        });
        dispatchLifecycleEvent('astro:before-swap', {
            newDocument,
            viewTransition: { finished },
        });

        const galleryMedia = newDocument.querySelector<HTMLElement>(
            '[data-view-section="gallery"] [data-post-transition-media]'
        );
        const listMedia = newDocument.querySelector<HTMLElement>(
            '[data-view-section="list"] [data-post-transition-media]'
        );
        expect(galleryMedia?.style.viewTransitionName).toBe('');
        expect(listMedia?.style.viewTransitionName).toBe('post-focus-media');

        document.body.innerHTML = '<div data-post-view-scroll></div>';
        const scrollContainer = document.querySelector<HTMLElement>('[data-post-view-scroll]')!;
        scrollContainer.style.scrollBehavior = 'smooth';
        scrollContainer.style.scrollSnapType = 'x mandatory';
        dispatchLifecycleEvent('astro:after-swap');

        expect(scrollContainer.scrollLeft).toBe(612);
        expect(scrollContainer.dataset.postViewRestoring).toBe('true');
        expect(scrollContainer.style.scrollBehavior).toBe('auto');
        expect(scrollContainer.style.scrollSnapType).toBe('none');
        expect(readPostReturnUrl()).toBeNull();

        flushAnimationFrames();
        expect(scrollContainer.dataset.postViewRestoring).toBeUndefined();
        expect(scrollContainer.style.scrollBehavior).toBe('smooth');
        expect(scrollContainer.style.scrollSnapType).toBe('x mandatory');
        finishTransition?.();
    });

    it('restores keyboard focus to the originating article after restoring the list position', () => {
        document.body.innerHTML = `
            <main data-page-stage="posts">
                <div data-post-view-scroll>
                    <a href="/zh/p/homeserver-1" data-post-transition-source>Home server</a>
                </div>
            </main>
        `;
        const sourceLink = document.querySelector<HTMLAnchorElement>(
            'a[data-post-transition-source]'
        )!;
        sourceLink.addEventListener('click', (event) => event.preventDefault());
        sourceLink.focus();
        sourceLink.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        sourceLink.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        expect(readPostInputModality()).toBe('keyboard');

        setPath('/zh/p/homeserver-1');
        document.body.innerHTML = '<div class="solitude-article-meta-motion-media"></div>';
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/post-view', window.location.origin),
            signal: new AbortController().signal,
        });

        setPath('/zh/post-view');
        document.body.innerHTML = `
            <section data-view-section="gallery">
                <div data-post-view-scroll></div>
                <a href="/zh/p/homeserver-1" data-post-transition-source>Home server</a>
            </section>
        `;
        const returnTarget = document.querySelector<HTMLAnchorElement>(
            'a[data-post-transition-source]'
        )!;
        const focus = vi.spyOn(returnTarget, 'focus');

        dispatchLifecycleEvent('astro:after-swap');
        expect(focus).not.toHaveBeenCalled();
        flushAnimationFrames();

        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(readPostInputModality()).toBeNull();
    });

    it('does not force focus back to an article opened with a pointer', () => {
        document.body.innerHTML = `
            <main data-page-stage="posts">
                <a href="/zh/p/homeserver-1" data-post-transition-source>Home server</a>
            </main>
        `;
        const sourceLink = document.querySelector<HTMLAnchorElement>(
            'a[data-post-transition-source]'
        )!;
        sourceLink.addEventListener('click', (event) => event.preventDefault());
        sourceLink.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        sourceLink.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        expect(readPostInputModality()).toBe('pointer');

        setPath('/zh/p/homeserver-1');
        document.body.innerHTML = '<div class="solitude-article-meta-motion-media"></div>';
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/post-view', window.location.origin),
            signal: new AbortController().signal,
        });

        setPath('/zh/post-view');
        document.body.innerHTML = `
            <section data-view-section="gallery">
                <a href="/zh/p/homeserver-1" data-post-transition-source>Home server</a>
            </section>
        `;
        const returnTarget = document.querySelector<HTMLAnchorElement>(
            'a[data-post-transition-source]'
        )!;
        const focus = vi.spyOn(returnTarget, 'focus');

        dispatchLifecycleEvent('astro:after-swap');
        flushAnimationFrames();

        expect(focus).not.toHaveBeenCalled();
        expect(readPostInputModality()).toBeNull();
    });

    it('applies only same-origin post-view return URLs to the article back link', () => {
        setPath('/zh/p/homeserver-1');
        document.body.innerHTML = '<a class="article-back-link" href="/zh/post-view">Back</a>';
        const backLink = document.querySelector<HTMLAnchorElement>('.article-back-link')!;

        rememberPostReturnUrl('https://example.com/zh/post-view?view=list');
        dispatchLifecycleEvent('astro:page-load');
        expect(backLink.getAttribute('href')).toBe('/zh/post-view');

        rememberPostReturnUrl('/zh/post-view?view=list&archive=years#selected');
        dispatchLifecycleEvent('astro:page-load');
        expect(backLink.getAttribute('href')).toBe(
            '/zh/post-view?view=list&archive=years#selected'
        );
    });

    it('moves focus to the new main stage after an ordinary SPA navigation', () => {
        setPath('/zh/');
        const controller = new AbortController();
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/about', window.location.origin),
            signal: controller.signal,
        });

        setPath('/zh/about');
        document.body.innerHTML =
            '<main id="site-main-content" data-site-main-content tabindex="-1"></main>';
        const mainContent = document.querySelector<HTMLElement>('[data-site-main-content]')!;
        const focus = vi.spyOn(mainContent, 'focus');

        dispatchLifecycleEvent('astro:page-load');

        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('focuses only the destination that owns the latest navigation request', () => {
        setPath('/zh/');
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/about', window.location.origin),
            signal: new AbortController().signal,
        });
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/contact', window.location.origin),
            signal: new AbortController().signal,
        });

        setPath('/zh/about');
        document.body.innerHTML =
            '<main id="site-main-content" data-site-main-content tabindex="-1"></main>';
        const staleMain = document.querySelector<HTMLElement>('[data-site-main-content]')!;
        const staleFocus = vi.spyOn(staleMain, 'focus');
        dispatchLifecycleEvent('astro:page-load');

        setPath('/zh/contact');
        document.body.innerHTML =
            '<main id="site-main-content" data-site-main-content tabindex="-1"></main>';
        const currentMain = document.querySelector<HTMLElement>('[data-site-main-content]')!;
        const currentFocus = vi.spyOn(currentMain, 'focus');
        dispatchLifecycleEvent('astro:page-load');

        expect(staleFocus).not.toHaveBeenCalled();
        expect(currentFocus).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('does not move focus on the initial page load or a hash-only navigation', () => {
        document.body.innerHTML =
            '<main id="site-main-content" data-site-main-content tabindex="-1"></main>';
        const mainContent = document.querySelector<HTMLElement>('[data-site-main-content]')!;
        const focus = vi.spyOn(mainContent, 'focus');

        dispatchLifecycleEvent('astro:page-load');
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/post-view#selected', window.location.origin),
            signal: new AbortController().signal,
        });
        dispatchLifecycleEvent('astro:page-load');

        expect(focus).not.toHaveBeenCalled();
    });

    it('does not steal focus from post return restoration or an aborted navigation', () => {
        setPath('/zh/p/homeserver-1');
        document.body.innerHTML = '<div class="solitude-article-meta-motion-media"></div>';
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/post-view', window.location.origin),
            signal: new AbortController().signal,
        });

        document.body.innerHTML =
            '<main id="site-main-content" data-site-main-content tabindex="-1"></main>';
        const mainContent = document.querySelector<HTMLElement>('[data-site-main-content]')!;
        const focus = vi.spyOn(mainContent, 'focus');
        dispatchLifecycleEvent('astro:page-load');

        setPath('/zh/');
        const controller = new AbortController();
        dispatchLifecycleEvent('astro:before-preparation', {
            to: new URL('/zh/contact', window.location.origin),
            signal: controller.signal,
        });
        controller.abort();
        dispatchLifecycleEvent('astro:page-load');

        expect(focus).not.toHaveBeenCalled();
    });
});
