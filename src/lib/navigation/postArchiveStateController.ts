import { parseArchiveParams, serializeArchiveParams, type ArchiveState } from '@lib/postArchive';
import { toPathWithSearchAndHash } from './routeModel';

export const POST_ARCHIVE_STATE_EVENT = 'post-archive-state-change';
export const POST_ARCHIVE_RENDER_EVENT = 'post-archive-rendered';

export type ArchiveHistoryMode = 'push' | 'replace';

export function readPostArchiveState(): ArchiveState {
    return parseArchiveParams(new URLSearchParams(window.location.search));
}

export function writePostArchiveState(
    state: ArchiveState,
    mode: ArchiveHistoryMode = 'replace'
): void {
    const url = new URL(window.location.href);
    const query = serializeArchiveParams(url.searchParams, state);
    url.search = query;

    window.history[mode === 'push' ? 'pushState' : 'replaceState'](
        window.history.state,
        '',
        toPathWithSearchAndHash(url)
    );
    window.dispatchEvent(new CustomEvent(POST_ARCHIVE_STATE_EVENT));
}
