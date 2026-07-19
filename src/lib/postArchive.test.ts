import { describe, expect, it } from 'vitest';
import {
    ARCHIVE_GROUP_PAGE_SIZES,
    ARCHIVE_PAGE_SIZES,
    groupArchivePostsBySeries,
    groupArchivePostsByYear,
    paginateArchiveGroup,
    parseArchiveParams,
    serializeArchiveParams,
    type ArchiveState,
    type PostArchiveItem,
} from './postArchive';

function makePost(overrides: Partial<PostArchiveItem> = {}): PostArchiveItem {
    return {
        id: 'post',
        title: 'Post',
        excerpt: '',
        url: '/post',
        feature_image: null,
        published_at: '2026-01-01T00:00:00.000Z',
        post_type: 'article',
        post_category: 'tech',
        post_series: '',
        ...overrides,
    };
}

describe('parseArchiveParams', () => {
    it('uses the ledger layout and default filters when the query is empty', () => {
        expect(parseArchiveParams(new URLSearchParams())).toEqual({
            filters: { category: null, type: null, query: '' },
            layout: 'ledger',
            pagination: { page: 1, group: null, groupPage: 1 },
        });
    });

    it('parses browse filters and a valid archive layout', () => {
        expect(
            parseArchiveParams(
                new URLSearchParams(
                    'view=list&category=tech&type=article&q=astro&archivePage=2&archive=years&archiveGroup=2024&archiveGroupPage=3'
                )
            )
        ).toEqual({
            filters: { category: 'tech', type: 'article', query: 'astro' },
            layout: 'years',
            pagination: { page: 2, group: '2024', groupPage: 3 },
        });
    });

    it('falls back to ledger for an unknown archive layout', () => {
        expect(parseArchiveParams(new URLSearchParams('archive=unknown')).layout).toBe('ledger');
    });

    it('reads the old page key only as an archive page migration fallback', () => {
        expect(parseArchiveParams(new URLSearchParams('page=4')).pagination.page).toBe(4);
        expect(
            parseArchiveParams(new URLSearchParams('page=4&archivePage=2')).pagination.page
        ).toBe(2);
    });

    it('ignores groups for the ledger and keeps a selected series while normalizing invalid pages', () => {
        expect(
            parseArchiveParams(new URLSearchParams('archiveGroup=guide&archiveGroupPage=3'))
                .pagination
        ).toEqual({ page: 1, group: null, groupPage: 1 });
        expect(
            parseArchiveParams(
                new URLSearchParams('archive=series&archiveGroup=guide&archiveGroupPage=-2')
            ).pagination
        ).toEqual({ page: 1, group: 'guide', groupPage: 1 });
        expect(
            parseArchiveParams(
                new URLSearchParams('archive=series&archiveGroup=guide&archiveGroupPage=2x')
            ).pagination
        ).toEqual({ page: 1, group: 'guide', groupPage: 1 });
        expect(
            parseArchiveParams(
                new URLSearchParams('archive=series&archiveGroup=guide&archiveGroupPage=1')
            ).pagination
        ).toEqual({ page: 1, group: 'guide', groupPage: 1 });
    });
});

describe('serializeArchiveParams', () => {
    const state: ArchiveState = {
        filters: {
            category: 'tech',
            type: null,
            query: 'motion',
        },
        layout: 'series',
        pagination: { page: 3, group: 'home-server', groupPage: 2 },
    };

    it('preserves parameters owned by the surrounding post view', () => {
        const query = serializeArchiveParams(
            new URLSearchParams('view=list&campaign=summer'),
            state
        );
        expect(new URLSearchParams(query)).toEqual(
            new URLSearchParams(
                'view=list&campaign=summer&category=tech&q=motion&archivePage=3&archive=series&archiveGroup=home-server&archiveGroupPage=2'
            )
        );
    });

    it('removes default and empty archive parameters', () => {
        const query = serializeArchiveParams(
            new URLSearchParams('view=list&category=tech&q=old&page=4&archive=years'),
            {
                filters: { category: null, type: null, query: '' },
                layout: 'ledger',
                pagination: { page: 1, group: null, groupPage: 1 },
            }
        );
        expect(query).toBe('view=list');
    });

    it('drops group parameters when the selected layout does not support them', () => {
        const query = serializeArchiveParams(
            new URLSearchParams('view=list&archiveGroup=guide&archiveGroupPage=4'),
            {
                ...state,
                layout: 'ledger',
            }
        );

        const params = new URLSearchParams(query);
        expect(params.has('archiveGroup')).toBe(false);
        expect(params.has('archiveGroupPage')).toBe(false);
    });

    it('keeps a first-page series selection without serializing the default group page', () => {
        const firstPageState: ArchiveState = {
            ...state,
            pagination: { page: 1, group: 'home-server', groupPage: 1 },
        };
        const query = serializeArchiveParams(new URLSearchParams('view=list'), firstPageState);
        const params = new URLSearchParams(query);

        expect(params.get('archiveGroup')).toBe('home-server');
        expect(params.has('archiveGroupPage')).toBe(false);
        expect(parseArchiveParams(params)).toEqual(firstPageState);
    });

    it('round-trips a non-default state without losing the surrounding view', () => {
        const query = serializeArchiveParams(new URLSearchParams('view=list'), state);
        expect(parseArchiveParams(new URLSearchParams(query))).toEqual(state);
    });
});

describe('archive grouping', () => {
    it('groups years newest first without changing post order inside a year', () => {
        const first = makePost({ id: 'first', published_at: '2025-06-01T00:00:00.000Z' });
        const newest = makePost({ id: 'newest', published_at: '2026-01-01T00:00:00.000Z' });
        const second = makePost({ id: 'second', published_at: '2025-02-01T00:00:00.000Z' });

        const groups = groupArchivePostsByYear([first, newest, second]);

        expect(groups.map((group) => group.key)).toEqual(['2026', '2025']);
        expect(groups[1]?.posts.map((post) => post.id)).toEqual(['first', 'second']);
    });

    it('orders numbered series entries and places standalone posts last', () => {
        const groups = groupArchivePostsBySeries(
            [
                makePost({ id: 'part-2', post_series: 'guide', post_series_number: 'Part 2' }),
                makePost({ id: 'standalone', post_series: '' }),
                makePost({ id: 'part-1', post_series: 'guide', post_series_number: 'Part 1' }),
            ],
            'Standalone'
        );

        expect(groups.map((group) => group.label)).toEqual(['guide', 'Standalone']);
        expect(groups[0]?.posts.map((post) => post.id)).toEqual(['part-1', 'part-2']);
        expect(groups[1]?.isStandalone).toBe(true);
    });

    it('applies series metadata and uses its explicit order before the standalone group', () => {
        const groups = groupArchivePostsBySeries(
            [
                makePost({
                    id: 'alpha',
                    post_series: 'Raw alpha',
                    post_series_slug: 'series-alpha',
                }),
                makePost({ id: 'standalone', post_series: '' }),
                makePost({
                    id: 'beta',
                    post_series: 'Raw beta',
                    post_series_slug: 'series-beta',
                }),
            ],
            'Standalone',
            {
                'series-alpha': {
                    label: 'Alpha library',
                    description: 'Alpha description',
                    order: 20,
                },
                'series-beta': {
                    label: 'Beta library',
                    description: 'Beta description',
                    order: 10,
                    color: '#4455aa',
                },
            }
        );

        expect(groups.map((group) => group.key)).toEqual([
            'series-beta',
            'series-alpha',
            '__standalone__',
        ]);
        expect(groups[0]).toMatchObject({
            label: 'Beta library',
            description: 'Beta description',
            order: 10,
            color: '#4455aa',
        });
        expect(groups[1]).toMatchObject({
            label: 'Alpha library',
            description: 'Alpha description',
            order: 20,
        });
    });

    it('uses a stable seven-series outer page capacity', () => {
        expect(ARCHIVE_PAGE_SIZES.series).toBe(7);
    });

    it('paginates a large group without resetting its absolute item offset', () => {
        const posts = Array.from({ length: 14 }, (_, index) =>
            makePost({ id: `post-${index + 1}` })
        );
        const group = { key: 'guide', label: 'Guide', posts };
        const page = paginateArchiveGroup(group, 3, ARCHIVE_GROUP_PAGE_SIZES.series);

        expect(page.page).toBe(3);
        expect(page.totalPages).toBe(3);
        expect(page.startIndex).toBe(12);
        expect(page.visiblePosts.map((post) => post.id)).toEqual(['post-13', 'post-14']);
    });

    it('clamps a group page after its content shrinks', () => {
        const posts = Array.from({ length: 7 }, (_, index) =>
            makePost({ id: `post-${index + 1}` })
        );
        const page = paginateArchiveGroup(
            { key: '2025', label: '2025', posts },
            99,
            ARCHIVE_GROUP_PAGE_SIZES.years
        );

        expect(page.page).toBe(2);
        expect(page.visiblePosts.map((post) => post.id)).toEqual(['post-7']);
    });
});
