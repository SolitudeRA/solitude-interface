// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let initPostViewModeController!: () => void;

function setPath(path: string): void {
    window.history.replaceState(null, '', path);
}

function renderPostView(): void {
    document.body.innerHTML = `
        <nav role="tablist">
            <button type="button" role="tab" data-view-toggle="gallery">Featured</button>
            <button type="button" role="tab" data-view-toggle="list">All</button>
        </nav>
        <section data-view-section="gallery">
            <div data-view-motion-content>
                Gallery
                <a href="?view=list" data-view-switch="list">View all</a>
            </div>
        </section>
        <section data-view-section="list" hidden>
            <div data-view-motion-content>List</div>
        </section>
    `;
}

function dispatchPageLoad(): void {
    document.dispatchEvent(new Event('astro:page-load'));
}

beforeAll(async () => {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
    ({ initPostViewModeController } = await import('./postViewModeController'));
    initPostViewModeController();
});

beforeEach(() => {
    setPath('/zh/post-view');
    document.documentElement.removeAttribute('data-post-view-mode');
    document.documentElement.removeAttribute('data-post-view-transitioning');
    renderPostView();
});

describe('post view mode controller lifecycle', () => {
    it('hydrates the selected mode from the URL and updates accessibility state', () => {
        setPath('/zh/post-view?view=list');

        dispatchPageLoad();

        const gallery = document.querySelector<HTMLElement>('[data-view-section="gallery"]')!;
        const list = document.querySelector<HTMLElement>('[data-view-section="list"]')!;
        const galleryToggle = document.querySelector<HTMLElement>('[data-view-toggle="gallery"]')!;
        const listToggle = document.querySelector<HTMLElement>('[data-view-toggle="list"]')!;
        expect(document.documentElement.dataset.postViewMode).toBe('list');
        expect(gallery.hidden).toBe(true);
        expect(list.hidden).toBe(false);
        expect(galleryToggle.getAttribute('aria-selected')).toBe('false');
        expect(listToggle.getAttribute('aria-selected')).toBe('true');
        expect(galleryToggle.tabIndex).toBe(-1);
        expect(listToggle.tabIndex).toBe(0);
    });

    it('binds replacement DOM once and pushes one history entry per user selection', () => {
        const pushState = vi.spyOn(window.history, 'pushState');
        dispatchPageLoad();
        dispatchPageLoad();
        const listToggle = document.querySelector<HTMLButtonElement>('[data-view-toggle="list"]')!;

        listToggle.click();

        expect(listToggle.dataset.viewBound).toBe('1');
        expect(pushState).toHaveBeenCalledTimes(1);
        expect(window.location.pathname).toBe('/zh/post-view');
        expect(window.location.search).toBe('?view=list');
        pushState.mockRestore();
    });

    it('restores the view from browser history and emits the shared view-change event', () => {
        const onViewChange = vi.fn();
        window.addEventListener('post-view-change', onViewChange);
        dispatchPageLoad();
        setPath('/zh/post-view?view=list');

        window.dispatchEvent(new PopStateEvent('popstate'));

        expect(document.documentElement.dataset.postViewMode).toBe('list');
        expect(document.querySelector<HTMLElement>('[data-view-section="list"]')?.hidden).toBe(
            false
        );
        expect(onViewChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ detail: { view: 'list' } })
        );
        window.removeEventListener('post-view-change', onViewChange);
    });

    it('supports roving focus with arrow, Home, and End keys', () => {
        dispatchPageLoad();
        const galleryToggle = document.querySelector<HTMLButtonElement>(
            '[data-view-toggle="gallery"]'
        )!;
        const listToggle = document.querySelector<HTMLButtonElement>('[data-view-toggle="list"]')!;

        galleryToggle.focus();
        galleryToggle.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
        );

        expect(document.activeElement).toBe(listToggle);
        expect(window.location.search).toBe('?view=list');
        expect(listToggle.getAttribute('aria-selected')).toBe('true');

        listToggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        expect(document.activeElement).toBe(galleryToggle);
        expect(window.location.search).toBe('');

        galleryToggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        expect(document.activeElement).toBe(listToggle);
        expect(window.location.search).toBe('?view=list');
    });

    it('moves focus to the active tab before hiding a focused outgoing panel', () => {
        dispatchPageLoad();
        const viewAll = document.querySelector<HTMLAnchorElement>('[data-view-switch="list"]')!;
        const listToggle = document.querySelector<HTMLButtonElement>('[data-view-toggle="list"]')!;
        const focus = vi.spyOn(listToggle, 'focus');

        viewAll.focus();
        viewAll.click();

        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(document.activeElement).toBe(listToggle);
        expect(document.querySelector<HTMLElement>('[data-view-section="gallery"]')?.hidden).toBe(
            true
        );
    });

    it('does not push history when the selected tab is already active', () => {
        const pushState = vi.spyOn(window.history, 'pushState');
        dispatchPageLoad();
        document.querySelector<HTMLButtonElement>('[data-view-toggle="gallery"]')?.click();

        expect(pushState).not.toHaveBeenCalled();
        pushState.mockRestore();
    });

    it('does not bind controls or write post-view state on unrelated routes', () => {
        setPath('/zh/about');
        document.documentElement.removeAttribute('data-post-view-mode');

        dispatchPageLoad();

        expect(document.documentElement.dataset.postViewMode).toBeUndefined();
        expect(
            document.querySelector<HTMLElement>('[data-view-toggle="gallery"]')?.dataset.viewBound
        ).toBeUndefined();
    });
});
