// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    readPostDestination,
    readPostReturnUrl,
    readPostViewScroll,
    rememberPostDestination,
    rememberPostReturnUrl,
    rememberPostViewScroll,
} from './navigationState';
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

    it('adds the active archive page to the remembered return URL', () => {
        setPath('/zh/post-view?view=list&archive=years');
        document.body.innerHTML = `
            <main data-page-stage="posts">
                <div data-post-list-root data-archive-active-page="3">
                    <a href="/zh/p/homeserver-6" data-post-transition-source>
                        <img data-post-transition-media alt="" />
                    </a>
                </div>
            </main>
        `;
        const link = document.querySelector<HTMLAnchorElement>('a[data-post-transition-source]')!;
        link.addEventListener('click', (event) => event.preventDefault());

        link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        expect(readPostReturnUrl()).toBe('/zh/post-view?view=list&archive=years&page=3');
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
});
