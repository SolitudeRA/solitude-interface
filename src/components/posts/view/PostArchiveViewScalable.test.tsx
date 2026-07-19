// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostArchiveItem } from '@lib/postArchive';
import PostArchiveView from './PostArchiveViewScalable';

vi.mock('motion/react', async () => {
    const React = await import('react');
    type MotionProps = Record<string, unknown> & { children?: ReactNode };
    const motionOnlyProps = [
        'animate',
        'custom',
        'exit',
        'initial',
        'layout',
        'transition',
        'variants',
    ];
    const createMotionElement = (tag: string) =>
        function MotionElement({ children, ...props }: MotionProps) {
            motionOnlyProps.forEach((prop) => delete props[prop]);
            return React.createElement(tag, props, children);
        };

    return {
        AnimatePresence: ({ children }: { children?: ReactNode }) => children,
        MotionConfig: ({ children }: { children?: ReactNode }) => children,
        motion: {
            button: createMotionElement('button'),
            div: createMotionElement('div'),
            ol: createMotionElement('ol'),
        },
    };
});

const ARCHIVE_PATH = '/zh/post-view?view=list&archive=series';

function makeSeriesPosts(count: number): PostArchiveItem[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `part-${index + 1}`,
        title: `Part ${index + 1}`,
        excerpt: '',
        url: `/zh/p/part-${index + 1}`,
        feature_image: null,
        published_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
        post_type: 'article',
        post_category: 'tech',
        post_series: 'guide',
        post_series_slug: 'guide',
        post_series_label: 'Guide',
        post_series_number: `#${index + 1}`,
    }));
}

function makePosts(count: number, groupBy: 'series' | 'year'): PostArchiveItem[] {
    return Array.from({ length: count }, (_, index) => {
        const groupIndex = index;
        const year = 2026 - groupIndex;
        return {
            id: `post-${index + 1}`,
            title: `Post ${index + 1}`,
            excerpt: '',
            url: `/zh/p/post-${index + 1}`,
            feature_image: null,
            published_at: `${groupBy === 'year' ? year : 2026}-01-01T00:00:00.000Z`,
            post_type: 'article',
            post_category: 'tech',
            post_series: groupBy === 'series' ? `series-${groupIndex + 1}` : '',
            ...(groupBy === 'series'
                ? {
                      post_series_slug: `series-${groupIndex + 1}`,
                      post_series_label: `Series ${groupIndex + 1}`,
                  }
                : {}),
        };
    });
}

function makeSeriesCatalog(seriesCount = 14, chaptersPerSeries = 13): PostArchiveItem[] {
    return Array.from({ length: seriesCount }, (_, seriesIndex) => {
        const seriesNumber = String(seriesIndex + 1).padStart(2, '0');
        return Array.from({ length: chaptersPerSeries }, (_, chapterIndex) => {
            const chapterNumber = String(chapterIndex + 1).padStart(2, '0');
            return {
                id: `series-${seriesNumber}-part-${chapterNumber}`,
                title: `Series ${seriesNumber} · Part ${chapterNumber}`,
                excerpt: `Series ${seriesNumber} description`,
                url: `/zh/p/series-${seriesNumber}-part-${chapterNumber}`,
                feature_image: chapterIndex === 0 ? `/covers/series-${seriesNumber}.webp` : null,
                published_at: `2026-01-${chapterNumber}T00:00:00.000Z`,
                post_type: 'article',
                post_category: 'tech',
                post_series: `series-${seriesNumber}`,
                post_series_slug: `series-${seriesNumber}`,
                post_series_label: `Series ${seriesNumber}`,
                post_series_number: chapterNumber,
            } satisfies PostArchiveItem;
        });
    }).flat();
}

function getSeriesEntries(): HTMLButtonElement[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('[data-archive-series-entry]'));
}

function getSeriesEntryKeys(): string[] {
    return getSeriesEntries().map((entry) => entry.dataset.archiveSeriesKey!);
}

function getDirectory(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-archive-series-directory]')!;
}

function getDirectoryPostIds(): string[] {
    return Array.from(getDirectory().querySelectorAll<HTMLElement>('[data-archive-post-id]')).map(
        (post) => post.dataset.archivePostId!
    );
}

function getSeriesPreview(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-archive-series-preview]')!;
}

function getDockPager(): HTMLElement {
    return document.querySelector<HTMLElement>(
        '#post-archive-pagination-host [data-archive-pagination]'
    )!;
}

async function renderSeriesCatalog(): Promise<void> {
    await act(async () => {
        root.render(
            <PostArchiveView posts={makeSeriesCatalog()} locale="zh" initialLayout="series" />
        );
    });
}

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
    Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        value: vi.fn(() => 1),
    });
    Object.defineProperty(globalThis, 'CSS', {
        configurable: true,
        value: { escape: (value: string) => value },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        value: vi.fn(),
    });
});

beforeEach(() => {
    window.history.replaceState(null, '', ARCHIVE_PATH);
    document.body.innerHTML = `
        <div id="post-archive-pagination-host"></div>
        <div id="archive-root"></div>
    `;
    root = createRoot(document.getElementById('archive-root')!);
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
});

describe('PostArchiveView scalable group pagination', () => {
    it('shows seven peer series per Dock batch without introducing a featured entry', async () => {
        await renderSeriesCatalog();

        expect(getSeriesEntryKeys()).toEqual(
            Array.from({ length: 7 }, (_, index) => `series-${String(index + 1).padStart(2, '0')}`)
        );
        expect(getDockPager().textContent).toContain('01 / 02');
        expect(document.querySelectorAll('[data-archive-series-preview]')).toHaveLength(1);
        expect(document.querySelector('[data-archive-series-featured]')).toBeNull();

        await act(async () => {
            getDockPager().querySelectorAll('button')[1]!.click();
        });

        expect(getSeriesEntryKeys()).toEqual(
            Array.from({ length: 7 }, (_, index) => `series-${String(index + 8).padStart(2, '0')}`)
        );
        expect(getDockPager().textContent).toContain('02 / 02');
        expect(new URLSearchParams(window.location.search).get('archivePage')).toBe('2');
    });

    it('changes only the series preview on pointer hover and keyboard focus', async () => {
        await renderSeriesCatalog();
        const initialUrl = window.location.href;
        const initialDirectoryKey = getDirectory().dataset.archiveSeriesKey;

        await act(async () => {
            getSeriesEntries()[1]!.focus();
        });
        expect(getSeriesPreview().dataset.archiveSeriesKey).toBe('series-02');
        expect(getDirectory().dataset.archiveSeriesKey).toBe(initialDirectoryKey);

        await act(async () => {
            getSeriesEntries()[2]!.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
        });
        expect(getSeriesPreview().dataset.archiveSeriesKey).toBe('series-03');
        expect(getDirectory().dataset.archiveSeriesKey).toBe(initialDirectoryKey);
        expect(window.location.href).toBe(initialUrl);
    });

    it('selects a series on click, preserves entry order, and serializes page one without groupPage', async () => {
        await renderSeriesCatalog();
        const initialOrder = getSeriesEntryKeys();

        await act(async () => {
            getSeriesEntries()[2]!.click();
        });

        const params = new URLSearchParams(window.location.search);
        expect(params.get('archiveGroup')).toBe('series-03');
        expect(params.has('archiveGroupPage')).toBe(false);
        expect(getDirectory().dataset.archiveSeriesKey).toBe('series-03');
        expect(getSeriesEntryKeys()).toEqual(initialOrder);
        expect(getSeriesEntries()[2]!.dataset.selected).toBe('true');
    });

    it('paginates the selected directory in six-post slices and keeps its active preview scoped', async () => {
        await renderSeriesCatalog();
        await act(async () => {
            getSeriesEntries()[2]!.click();
        });

        expect(getDirectoryPostIds()).toEqual(
            Array.from(
                { length: 6 },
                (_, index) => `series-03-part-${String(index + 1).padStart(2, '0')}`
            )
        );
        expect(
            getDirectory().querySelector('[data-archive-group-pagination]')?.textContent
        ).toContain('01 / 03');
        expect(document.querySelector<HTMLAnchorElement>('a[aria-label]')?.ariaLabel).toBe(
            'Series 03 · Part 01'
        );

        const secondPost =
            getDirectory().querySelectorAll<HTMLAnchorElement>('[data-archive-post-id]')[1]!;
        await act(async () => {
            secondPost.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
        });
        expect(document.querySelector<HTMLAnchorElement>('a[aria-label]')?.ariaLabel).toBe(
            'Series 03 · Part 02'
        );

        await act(async () => {
            getDirectory()
                .querySelector<HTMLElement>('[data-archive-group-pagination]')!
                .querySelectorAll('button')[1]!
                .click();
        });
        expect(getDirectoryPostIds()).toEqual(
            Array.from(
                { length: 6 },
                (_, index) => `series-03-part-${String(index + 7).padStart(2, '0')}`
            )
        );
        const params = new URLSearchParams(window.location.search);
        expect(params.get('archiveGroup')).toBe('series-03');
        expect(params.get('archiveGroupPage')).toBe('2');
        expect(document.querySelector<HTMLAnchorElement>('a[aria-label]')?.ariaLabel).toBe(
            'Series 03 · Part 07'
        );
    });

    it('switches between the mobile atlas and focus view without losing the selection', async () => {
        await renderSeriesCatalog();
        const panel = document.getElementById('archive-panel-series')!;
        expect(panel.dataset.mobileView).toBe('atlas');

        await act(async () => {
            getSeriesEntries()[1]!.click();
        });
        expect(panel.dataset.mobileView).toBe('focus');
        expect(getDirectory().dataset.archiveSeriesKey).toBe('series-02');

        await act(async () => {
            Array.from(getDirectory().querySelectorAll('button'))
                .find((button) => button.textContent?.includes('全部系列'))!
                .click();
        });
        expect(panel.dataset.mobileView).toBe('atlas');
        expect(getDirectory().dataset.archiveSeriesKey).toBe('series-02');
        expect(new URLSearchParams(window.location.search).get('archiveGroup')).toBe('series-02');
    });

    it('restores the outer batch, selected series, inner page, and active post on popstate', async () => {
        await renderSeriesCatalog();

        await act(async () => {
            window.history.replaceState(
                null,
                '',
                `${ARCHIVE_PATH}&archivePage=2&archiveGroup=series-10&archiveGroupPage=2`
            );
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        expect(getDockPager().textContent).toContain('02 / 02');
        expect(getSeriesEntryKeys()).toEqual(
            Array.from({ length: 7 }, (_, index) => `series-${String(index + 8).padStart(2, '0')}`)
        );
        expect(getDirectory().dataset.archiveSeriesKey).toBe('series-10');
        expect(getDirectoryPostIds()[0]).toBe('series-10-part-07');
        expect(
            getDirectory().querySelector('[data-archive-group-pagination]')?.textContent
        ).toContain('02 / 03');
        expect(getSeriesPreview().dataset.archiveSeriesKey).toBe('series-10');
        expect(document.querySelector<HTMLAnchorElement>('a[aria-label]')?.ariaLabel).toBe(
            'Series 10 · Part 07'
        );
    });

    it('restores page one from history and keeps preview return metadata in sync', async () => {
        await act(async () => {
            root.render(
                <PostArchiveView posts={makeSeriesPosts(8)} locale="zh" initialLayout="series" />
            );
        });

        const pager = document.querySelector<HTMLElement>('[data-archive-group-pagination]')!;
        const next = pager.querySelectorAll('button')[1]!;
        await act(async () => next.click());

        expect(pager.textContent).toContain('02 / 02');
        expect(new URLSearchParams(window.location.search).get('archiveGroupPage')).toBe('2');
        const preview = document.querySelector<HTMLAnchorElement>('a[aria-label="Part 7"]');
        expect(preview?.dataset.archiveGroupKey).toBe('guide');
        expect(preview?.dataset.archiveGroupPage).toBe('2');

        await act(async () => {
            window.history.replaceState(null, '', '/zh/post-view?view=list&archive=series');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        expect(pager.textContent).toContain('01 / 02');
        expect(document.querySelector('a[aria-label="Part 1"]')).not.toBeNull();
    });

    it('renders only the clamped ledger slice for a large article collection', async () => {
        window.history.replaceState(null, '', '/zh/post-view?view=list&archivePage=99');
        await act(async () => {
            root.render(
                <PostArchiveView
                    posts={makePosts(45, 'series')}
                    locale="zh"
                    initialPagination={{ page: 99, group: null, groupPage: 1 }}
                />
            );
        });

        expect(
            document.querySelector('[data-post-list-root]')?.getAttribute('data-archive-page')
        ).toBe('3');
        expect(document.querySelectorAll('[data-archive-post-id]')).toHaveLength(5);
        expect(new URLSearchParams(window.location.search).get('archivePage')).toBe('3');
    });

    it('limits year outer pages to a stable three-group capacity', async () => {
        window.history.replaceState(
            null,
            '',
            '/zh/post-view?view=list&archive=years&archivePage=3'
        );
        await act(async () => {
            root.render(
                <PostArchiveView
                    posts={makePosts(8, 'year')}
                    locale="zh"
                    initialLayout="years"
                    initialPagination={{ page: 3, group: null, groupPage: 1 }}
                />
            );
        });
        expect(document.querySelectorAll('#archive-panel-years > .archive-column')).toHaveLength(2);
    });
});
