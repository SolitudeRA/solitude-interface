// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArchiveState } from '../postArchive';
import {
    POST_ARCHIVE_STATE_EVENT,
    readPostArchiveState,
    writePostArchiveState,
} from './postArchiveStateController';

const SERIES_STATE: ArchiveState = {
    filters: { category: 'tech', type: null, query: 'server' },
    layout: 'series',
    pagination: { page: 2, group: 'home-server', groupPage: 3 },
};

beforeEach(() => {
    window.history.replaceState(
        { astro: 'preserved' },
        '',
        '/zh/post-view?view=list&campaign=summer#selected'
    );
});

describe('post archive browser state', () => {
    it('writes one archive state while preserving surrounding params, history state, and hash', () => {
        const listener = vi.fn();
        window.addEventListener(POST_ARCHIVE_STATE_EVENT, listener);

        writePostArchiveState(SERIES_STATE, 'push');

        const params = new URLSearchParams(window.location.search);
        expect(params.get('view')).toBe('list');
        expect(params.get('campaign')).toBe('summer');
        expect(params.get('archive')).toBe('series');
        expect(params.get('archivePage')).toBe('2');
        expect(params.get('archiveGroup')).toBe('home-server');
        expect(params.get('archiveGroupPage')).toBe('3');
        expect(window.location.hash).toBe('#selected');
        expect(window.history.state).toEqual({ astro: 'preserved' });
        expect(listener).toHaveBeenCalledTimes(1);

        window.removeEventListener(POST_ARCHIVE_STATE_EVENT, listener);
    });

    it('reads the state written by another archive island', () => {
        writePostArchiveState(SERIES_STATE, 'replace');
        expect(readPostArchiveState()).toEqual(SERIES_STATE);
    });

    it('preserves a selected series on its first page without adding a group-page query', () => {
        const firstPageState: ArchiveState = {
            ...SERIES_STATE,
            pagination: { page: 1, group: 'home-server', groupPage: 1 },
        };

        writePostArchiveState(firstPageState, 'replace');

        const params = new URLSearchParams(window.location.search);
        expect(params.get('archiveGroup')).toBe('home-server');
        expect(params.has('archiveGroupPage')).toBe(false);
        expect(readPostArchiveState()).toEqual(firstPageState);
    });
});
