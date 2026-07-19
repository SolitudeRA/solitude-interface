// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PostArchiveNavbar from './PostArchiveNavbar';
import PostArchiveSearch from './PostArchiveSearch';

let root: Root;

beforeAll(() => {
    (
        globalThis as typeof globalThis & {
            IS_REACT_ACT_ENVIRONMENT: boolean;
        }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn().mockImplementation(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    });
});

beforeEach(() => {
    window.history.replaceState(
        null,
        '',
        '/zh/post-view?view=list&archive=years&category=tech&q=server'
    );
    document.body.innerHTML = '<div id="archive-chrome-root"></div>';
    root = createRoot(document.getElementById('archive-chrome-root')!);
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
});

describe('post archive URL hydration', () => {
    it('synchronizes static navbar and search props with the live deep link on mount', async () => {
        await act(async () => {
            root.render(
                <>
                    <PostArchiveNavbar
                        locale="zh"
                        categories={[{ slug: 'tech', label: '技术', count: 8 }]}
                        initialLayout="ledger"
                    />
                    <PostArchiveSearch locale="zh" />
                </>
            );
        });

        expect(
            document
                .querySelector('[data-archive-layout-button="years"]')
                ?.getAttribute('aria-selected')
        ).toBe('true');
        expect(document.querySelector('button[aria-pressed="true"]')?.textContent?.trim()).toBe(
            '技术'
        );

        const searchPanel = document.querySelector<HTMLElement>('[data-archive-search-panel]');
        const searchInput = searchPanel?.querySelector<HTMLInputElement>('input');
        expect(searchPanel?.dataset.open).toBe('false');
        expect(searchPanel?.hasAttribute('inert')).toBe(true);
        expect(searchInput?.disabled).toBe(true);

        await act(async () => {
            document.querySelector<HTMLButtonElement>('[data-archive-search-button]')?.click();
        });
        expect(searchPanel?.dataset.open).toBe('true');
        expect(searchPanel?.hasAttribute('inert')).toBe(false);
        expect(searchInput?.disabled).toBe(false);
        expect(searchInput?.value).toBe('server');
        expect(document.activeElement).toBe(searchInput);

        await act(async () => {
            searchInput?.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
            );
        });
        expect(searchPanel?.dataset.open).toBe('false');
        expect(searchInput?.disabled).toBe(true);
        expect(document.activeElement).toBe(
            document.querySelector<HTMLButtonElement>('[data-archive-search-button]')
        );
    });
});
