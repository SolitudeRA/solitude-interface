// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    initDockNavigationGuard,
    isCurrentDockDestination,
    normalizeDockPathname,
} from './dockNavigationGuard';

beforeAll(() => {
    initDockNavigationGuard();
});

beforeEach(() => {
    document.dispatchEvent(new Event('astro:after-swap'));
    window.history.replaceState(null, '', '/zh/post-view?view=list&archive=years');
    document.body.innerHTML = '';
});

describe('dock navigation guard', () => {
    it('normalizes trailing slashes without changing the root path', () => {
        expect(normalizeDockPathname('/zh/post-view/')).toBe('/zh/post-view');
        expect(normalizeDockPathname('/')).toBe('/');
    });

    it('treats the same pathname as current regardless of query or hash', () => {
        expect(
            isCurrentDockDestination(
                new URL('https://example.com/zh/post-view?view=list'),
                new URL('https://example.com/zh/post-view#top')
            )
        ).toBe(true);
    });

    it('does not match a different route or origin', () => {
        const current = new URL('https://example.com/zh/post-view');
        expect(isCurrentDockDestination(current, new URL('https://example.com/zh/about'))).toBe(
            false
        );
        expect(isCurrentDockDestination(current, new URL('https://other.test/zh/post-view'))).toBe(
            false
        );
    });

    it('prevents the current Dock route from navigating', () => {
        document.body.innerHTML = '<a data-dock-route href="/zh/post-view">Posts</a>';
        const link = document.querySelector<HTMLAnchorElement>('a')!;
        const event = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true });

        link.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(window.location.pathname).toBe('/zh/post-view');
        expect(window.location.search).toBe('?view=list&archive=years');
    });

    it('shows pending feedback for another Dock route until the page swaps', () => {
        document.body.innerHTML = '<a data-dock-route href="/zh/about">About</a>';
        const link = document.querySelector<HTMLAnchorElement>('a')!;
        let guardPreventedNavigation = false;
        link.addEventListener('click', (event) => {
            guardPreventedNavigation = event.defaultPrevented;
            event.preventDefault();
        });

        const clickEvent = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true });
        link.dispatchEvent(clickEvent);

        expect(guardPreventedNavigation).toBe(false);
        expect(document.documentElement.dataset.dockNavigationPending).toBe('true');
        expect(link.dataset.dockNavigationPending).toBe('true');
        expect(link.getAttribute('aria-busy')).toBe('true');

        document.dispatchEvent(new Event('astro:after-swap'));

        expect(document.documentElement.dataset.dockNavigationPending).toBeUndefined();
        expect(link.dataset.dockNavigationPending).toBeUndefined();
        expect(link.hasAttribute('aria-busy')).toBe(false);
    });

    it('does not let an aborted earlier navigation clear a newer pending route', () => {
        document.body.innerHTML = `
            <a data-dock-route href="/zh/about">About</a>
            <a data-dock-route href="/zh/contact">Contact</a>
        `;
        const [aboutLink, contactLink] = Array.from(
            document.querySelectorAll<HTMLAnchorElement>('a')
        );
        const firstNavigation = new AbortController();
        const secondNavigation = new AbortController();
        const dispatchPreparation = (signal: AbortSignal) => {
            const event = new Event('astro:before-preparation');
            Object.defineProperty(event, 'signal', { value: signal });
            document.dispatchEvent(event);
        };

        aboutLink!.addEventListener('click', (event) => event.preventDefault());
        contactLink!.addEventListener('click', (event) => event.preventDefault());

        aboutLink!.dispatchEvent(
            new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
        );
        dispatchPreparation(firstNavigation.signal);
        contactLink!.dispatchEvent(
            new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
        );
        dispatchPreparation(secondNavigation.signal);

        firstNavigation.abort();

        expect(document.documentElement.dataset.dockNavigationPending).toBe('true');
        expect(contactLink!.dataset.dockNavigationPending).toBe('true');
        expect(contactLink!.getAttribute('aria-busy')).toBe('true');

        secondNavigation.abort();

        expect(document.documentElement.dataset.dockNavigationPending).toBeUndefined();
        expect(contactLink!.dataset.dockNavigationPending).toBeUndefined();
        expect(contactLink!.hasAttribute('aria-busy')).toBe(false);
    });
});
