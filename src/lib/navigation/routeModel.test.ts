import { describe, expect, it } from 'vitest';
import {
    buildPostViewPath,
    getPostViewMode,
    isPostViewMode,
    isPostViewPath,
    toPathWithSearchAndHash,
} from './routeModel';

describe('navigation route model', () => {
    it.each(['/post-view', '/post-view/', '/zh/post-view', '/en/post-view/'])(
        'recognizes post view path %s',
        (pathname) => {
            expect(isPostViewPath(pathname)).toBe(true);
        }
    );

    it.each(['/posts', '/zh/posts', '/zh/p/post-view', '/zh/post-view/archive'])(
        'rejects non-post-view path %s',
        (pathname) => {
            expect(isPostViewPath(pathname)).toBe(false);
        }
    );

    it('uses gallery as the default post view', () => {
        expect(getPostViewMode(new URL('https://example.com/zh/post-view'))).toBe('gallery');
    });

    it('recognizes the list query mode', () => {
        expect(getPostViewMode(new URL('https://example.com/zh/post-view?view=list'))).toBe('list');
    });

    it('validates post view modes', () => {
        expect(isPostViewMode('gallery')).toBe(true);
        expect(isPostViewMode('list')).toBe(true);
        expect(isPostViewMode('grid')).toBe(false);
        expect(isPostViewMode(null)).toBe(false);
    });

    it('builds a canonical path for each post view', () => {
        const url = new URL('https://example.com/zh/post-view?category=tech');
        expect(buildPostViewPath(url, 'list')).toBe('/zh/post-view?category=tech&view=list');
        expect(buildPostViewPath(new URL(`${url.href}&view=list`), 'gallery')).toBe(
            '/zh/post-view?category=tech'
        );
    });

    it('keeps pathname, query, and hash when serializing a local destination', () => {
        expect(
            toPathWithSearchAndHash(
                new URL('https://example.com/zh/post-view?view=list#selected-post')
            )
        ).toBe('/zh/post-view?view=list#selected-post');
    });
});
