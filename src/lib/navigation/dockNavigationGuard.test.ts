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
});
