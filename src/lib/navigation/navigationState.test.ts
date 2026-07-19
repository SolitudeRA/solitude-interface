import { describe, expect, it } from 'vitest';
import {
    readPostArchiveScroll,
    readPostDestination,
    readPostInputModality,
    readPostReturnUrl,
    readPostViewScroll,
} from './navigationState';

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

    it('accepts only known post input modalities', () => {
        expect(readPostInputModality(storage({ 'solitude:post-input-modality': 'keyboard' }))).toBe(
            'keyboard'
        );
        expect(readPostInputModality(storage({ 'solitude:post-input-modality': 'pointer' }))).toBe(
            'pointer'
        );
        expect(readPostInputModality(storage({ 'solitude:post-input-modality': 'voice' }))).toBe(
            null
        );
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

    it('decodes and normalizes an archive scroll snapshot', () => {
        expect(
            readPostArchiveScroll(
                storage({
                    'solitude:post-archive-scroll': JSON.stringify({
                        layout: 'series',
                        page: 3,
                        outerTop: 418.5,
                        group: 'guide',
                        groupTop: -12,
                    }),
                })
            )
        ).toEqual({
            layout: 'series',
            page: 3,
            outerTop: 418.5,
            group: 'guide',
            groupTop: 0,
        });
    });

    it('rejects malformed archive scroll snapshots', () => {
        expect(
            readPostArchiveScroll(storage({ 'solitude:post-archive-scroll': '{not-json' }))
        ).toBe(null);
        expect(
            readPostArchiveScroll(
                storage({
                    'solitude:post-archive-scroll': JSON.stringify({
                        layout: 'years',
                        page: 0,
                    }),
                })
            )
        ).toBe(null);
    });
});
