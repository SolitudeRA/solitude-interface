import { describe, it, expect } from 'vitest';
import type { Post } from '@api/ghost/types';
import {
    extractFacets,
    filterPosts,
    paginate,
    parseBrowseParams,
    serializeBrowseParams,
    type BrowseState,
} from './postBrowse';

function makePost(overrides: Partial<Post>): Post {
    return {
        id: 'id',
        title: 'Title',
        url: new URL('https://example.com/p'),
        feature_image: null,
        published_at: '2026-01-01T00:00:00.000Z',
        comment_id: 'c',
        excerpt: '',
        html: '',
        post_type: 'default',
        post_category: '',
        post_series: '',
        ...overrides,
    } as Post;
}

describe('extractFacets', () => {
    it('groups categories by slug with counts, sorted by count descending', () => {
        const posts = [
            makePost({ post_category: 'tech', post_category_label: 'Tech' }),
            makePost({ post_category: 'tech', post_category_label: 'Tech' }),
            makePost({ post_category: 'life', post_category_label: 'Life' }),
        ];
        expect(extractFacets(posts).categories).toEqual([
            { slug: 'tech', label: 'Tech', count: 2 },
            { slug: 'life', label: 'Life', count: 1 },
        ]);
    });

    it('falls back to a title-cased slug when no label is present', () => {
        const posts = [makePost({ post_category: 'open-source' })];
        expect(extractFacets(posts).categories[0]).toEqual({
            slug: 'open-source',
            label: 'Open Source',
            count: 1,
        });
    });

    it('excludes empty and default category/type values', () => {
        const posts = [
            makePost({ post_category: '', post_type: 'default' }),
            makePost({
                post_category: 'default',
                post_type: 'article',
                post_type_label: 'Article',
            }),
        ];
        const { categories, types } = extractFacets(posts);
        expect(categories).toEqual([]);
        expect(types).toEqual([{ slug: 'article', label: 'Article', count: 1 }]);
    });

    it('extracts type facets sorted by count descending', () => {
        const posts = [
            makePost({ post_type: 'article', post_type_label: 'Article' }),
            makePost({ post_type: 'music', post_type_label: 'Music' }),
            makePost({ post_type: 'music', post_type_label: 'Music' }),
        ];
        expect(extractFacets(posts).types).toEqual([
            { slug: 'music', label: 'Music', count: 2 },
            { slug: 'article', label: 'Article', count: 1 },
        ]);
    });

    it('breaks count ties by slug ascending', () => {
        const posts = [
            makePost({ post_category: 'zeta', post_category_label: 'Zeta' }),
            makePost({ post_category: 'alpha', post_category_label: 'Alpha' }),
        ];
        expect(extractFacets(posts).categories.map((c) => c.slug)).toEqual(['alpha', 'zeta']);
    });
});

describe('filterPosts', () => {
    it('returns all posts when no filters are set', () => {
        const posts = [makePost({}), makePost({})];
        expect(filterPosts(posts, {})).toHaveLength(2);
    });

    it('filters by category slug', () => {
        const posts = [
            makePost({ id: '1', post_category: 'tech' }),
            makePost({ id: '2', post_category: 'life' }),
        ];
        expect(filterPosts(posts, { category: 'tech' }).map((p) => p.id)).toEqual(['1']);
    });

    it('filters by type slug', () => {
        const posts = [
            makePost({ id: '1', post_type: 'article' }),
            makePost({ id: '2', post_type: 'music' }),
        ];
        expect(filterPosts(posts, { type: 'music' }).map((p) => p.id)).toEqual(['2']);
    });

    it('matches query against title and excerpt, case-insensitively', () => {
        const posts = [
            makePost({ id: '1', title: 'Hello World', excerpt: '' }),
            makePost({ id: '2', title: 'Other', excerpt: 'mentions WORLD here' }),
            makePost({ id: '3', title: 'Nope', excerpt: 'nothing' }),
        ];
        expect(filterPosts(posts, { query: 'world' }).map((p) => p.id)).toEqual(['1', '2']);
    });

    it('matches query against the series label', () => {
        const posts = [
            makePost({ id: '1', title: 'Part one', post_series_label: 'Home Server Guide' }),
            makePost({ id: '2', title: 'Other', post_series_label: 'Writing Notes' }),
        ];
        expect(filterPosts(posts, { query: 'server' }).map((post) => post.id)).toEqual(['1']);
    });

    it('combines filters with AND', () => {
        const posts = [
            makePost({ id: '1', post_category: 'tech', title: 'Rust' }),
            makePost({ id: '2', post_category: 'tech', title: 'Go' }),
            makePost({ id: '3', post_category: 'life', title: 'Rust' }),
        ];
        expect(filterPosts(posts, { category: 'tech', query: 'rust' }).map((p) => p.id)).toEqual([
            '1',
        ]);
    });

    it('ignores a blank/whitespace query', () => {
        const posts = [makePost({ title: 'a' }), makePost({ title: 'b' })];
        expect(filterPosts(posts, { query: '   ' })).toHaveLength(2);
    });
});

describe('paginate', () => {
    it('returns the requested page slice with metadata', () => {
        const result = paginate([1, 2, 3, 4, 5], 2, 2);
        expect(result.items).toEqual([3, 4]);
        expect(result).toMatchObject({ page: 2, totalPages: 3, total: 5 });
    });

    it('clamps a page above range to the last page', () => {
        const result = paginate([1, 2, 3], 99, 2);
        expect(result.page).toBe(2);
        expect(result.items).toEqual([3]);
    });

    it('clamps a page below 1 to the first page', () => {
        const result = paginate([1, 2, 3], 0, 2);
        expect(result.page).toBe(1);
        expect(result.items).toEqual([1, 2]);
    });

    it('treats an empty list as a single empty page', () => {
        expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, totalPages: 1, total: 0 });
    });
});

describe('parseBrowseParams', () => {
    it('parses defaults from empty params', () => {
        expect(parseBrowseParams(new URLSearchParams(''))).toEqual({
            view: 'gallery',
            category: null,
            type: null,
            query: '',
            page: 1,
        });
    });

    it('parses a fully-specified query string', () => {
        const params = new URLSearchParams('view=list&category=tech&type=article&q=rust&page=3');
        expect(parseBrowseParams(params)).toEqual({
            view: 'list',
            category: 'tech',
            type: 'article',
            query: 'rust',
            page: 3,
        });
    });

    it('falls back to defaults for an invalid view and page', () => {
        const state = parseBrowseParams(new URLSearchParams('view=weird&page=-2'));
        expect(state.view).toBe('gallery');
        expect(state.page).toBe(1);
    });

    it('treats empty category/type params as null', () => {
        const state = parseBrowseParams(new URLSearchParams('category=&type='));
        expect(state.category).toBeNull();
        expect(state.type).toBeNull();
    });
});

describe('serializeBrowseParams', () => {
    it('emits nothing for a fully-default state', () => {
        const state: BrowseState = {
            view: 'gallery',
            category: null,
            type: null,
            query: '',
            page: 1,
        };
        expect(serializeBrowseParams(state)).toBe('');
    });

    it('emits only non-default values', () => {
        const state: BrowseState = {
            view: 'list',
            category: 'tech',
            type: null,
            query: '',
            page: 2,
        };
        expect(serializeBrowseParams(state)).toBe('view=list&category=tech&page=2');
    });

    it('round-trips a state through serialize then parse', () => {
        const state: BrowseState = {
            view: 'list',
            category: 'tech',
            type: 'article',
            query: 'hello world',
            page: 4,
        };
        const restored = parseBrowseParams(new URLSearchParams(serializeBrowseParams(state)));
        expect(restored).toEqual(state);
    });
});
