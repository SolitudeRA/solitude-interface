import { describe, expect, it } from 'vitest';
import { readPostDestination, readPostReturnUrl, readPostViewScroll } from './navigationState';

function storage(values: Record<string, string>): Pick<Storage, 'getItem'> {
    return {
        getItem(key) {
            return values[key] ?? null;
        },
    };
}

describe('navigation state decoding', () => {
    it('reads the selected post and return URL', () => {
        const state = storage({
            'solitude:post-transition-path': '/zh/p/example',
            'solitude:post-return-url': '/zh/post-view?view=list',
        });

        expect(readPostDestination(state)).toBe('/zh/p/example');
        expect(readPostReturnUrl(state)).toBe('/zh/post-view?view=list');
    });

    it('normalizes a valid scroll position', () => {
        expect(readPostViewScroll(storage({ 'solitude:post-view-scroll-left': '412.5' }))).toBe(
            412.5
        );
        expect(readPostViewScroll(storage({ 'solitude:post-view-scroll-left': '-10' }))).toBe(0);
    });

    it('rejects an invalid scroll position', () => {
        expect(
            readPostViewScroll(storage({ 'solitude:post-view-scroll-left': 'not-a-number' }))
        ).toBe(null);
    });
});
