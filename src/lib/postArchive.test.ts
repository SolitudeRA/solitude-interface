import { describe, expect, it } from 'vitest';
import {
    groupArchivePostsBySeries,
    groupArchivePostsByYear,
    parseArchiveParams,
    serializeArchiveParams,
    type ArchiveFilters,
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
            filters: { category: null, type: null, query: '', page: 1 },
            layout: 'ledger',
        });
    });

    it('parses browse filters and a valid archive layout', () => {
        expect(
            parseArchiveParams(
                new URLSearchParams(
                    'view=list&category=tech&type=article&q=astro&page=2&archive=years'
                )
            )
        ).toEqual({
            filters: { category: 'tech', type: 'article', query: 'astro', page: 2 },
            layout: 'years',
        });
    });

    it('falls back to ledger for an unknown archive layout', () => {
        expect(parseArchiveParams(new URLSearchParams('archive=unknown')).layout).toBe('ledger');
    });
});

describe('serializeArchiveParams', () => {
    const filters: ArchiveFilters = {
        category: 'tech',
        type: null,
        query: 'motion',
        page: 3,
    };

    it('preserves parameters owned by the surrounding post view', () => {
        const query = serializeArchiveParams(
            new URLSearchParams('view=list&campaign=summer'),
            filters,
            'series'
        );
        expect(new URLSearchParams(query)).toEqual(
            new URLSearchParams(
                'view=list&campaign=summer&category=tech&q=motion&page=3&archive=series'
            )
        );
    });

    it('removes default and empty archive parameters', () => {
        const query = serializeArchiveParams(
            new URLSearchParams('view=list&category=tech&q=old&page=4&archive=years'),
            { category: null, type: null, query: '', page: 1 },
            'ledger'
        );
        expect(query).toBe('view=list');
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
});
