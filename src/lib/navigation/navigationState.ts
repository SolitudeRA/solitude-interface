const POST_TRANSITION_PATH_KEY = 'solitude:post-transition-path';
const POST_RETURN_URL_KEY = 'solitude:post-return-url';
const POST_VIEW_SCROLL_KEY = 'solitude:post-view-scroll-left';
const POST_ARCHIVE_SCROLL_KEY = 'solitude:post-archive-scroll';
const POST_INPUT_MODALITY_KEY = 'solitude:post-input-modality';

export type PostInputModality = 'keyboard' | 'pointer';

export interface PostArchiveScrollState {
    layout: string;
    page: number;
    outerTop: number;
    group: string | null;
    groupTop: number;
}

interface StorageReader {
    getItem(key: string): string | null;
}

function withSessionStorage<T>(fallback: T, read: (storage: Storage) => T): T {
    try {
        return read(window.sessionStorage);
    } catch {
        return fallback;
    }
}

export function rememberPostDestination(pathname: string): void {
    withSessionStorage(undefined, (storage) => storage.setItem(POST_TRANSITION_PATH_KEY, pathname));
}

export function readPostDestination(storage?: StorageReader): string | null {
    if (storage) return storage.getItem(POST_TRANSITION_PATH_KEY);
    return withSessionStorage(null, (session) => session.getItem(POST_TRANSITION_PATH_KEY));
}

export function rememberPostReturnUrl(url: string): void {
    withSessionStorage(undefined, (storage) => storage.setItem(POST_RETURN_URL_KEY, url));
}

export function readPostReturnUrl(storage?: StorageReader): string | null {
    if (storage) return storage.getItem(POST_RETURN_URL_KEY);
    return withSessionStorage(null, (session) => session.getItem(POST_RETURN_URL_KEY));
}

export function clearPostReturnUrl(): void {
    withSessionStorage(undefined, (storage) => storage.removeItem(POST_RETURN_URL_KEY));
}

export function rememberPostInputModality(modality: PostInputModality): void {
    withSessionStorage(undefined, (storage) => storage.setItem(POST_INPUT_MODALITY_KEY, modality));
}

export function readPostInputModality(storage?: StorageReader): PostInputModality | null {
    const value = storage
        ? storage.getItem(POST_INPUT_MODALITY_KEY)
        : withSessionStorage(null, (session) => session.getItem(POST_INPUT_MODALITY_KEY));
    return value === 'keyboard' || value === 'pointer' ? value : null;
}

export function clearPostInputModality(): void {
    withSessionStorage(undefined, (storage) => storage.removeItem(POST_INPUT_MODALITY_KEY));
}

export function rememberPostViewScroll(scrollLeft: number | null): void {
    withSessionStorage(undefined, (storage) => {
        if (scrollLeft === null) {
            storage.removeItem(POST_VIEW_SCROLL_KEY);
            return;
        }
        storage.setItem(POST_VIEW_SCROLL_KEY, String(scrollLeft));
    });
}

export function readPostViewScroll(storage?: StorageReader): number | null {
    const value = storage
        ? storage.getItem(POST_VIEW_SCROLL_KEY)
        : withSessionStorage(null, (session) => session.getItem(POST_VIEW_SCROLL_KEY));
    if (value === null) return null;

    const scrollLeft = Number(value);
    return Number.isFinite(scrollLeft) ? Math.max(scrollLeft, 0) : null;
}

function normalizeScrollValue(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function parsePostArchiveScroll(value: string | null): PostArchiveScrollState | null {
    if (!value) return null;

    try {
        const parsed = JSON.parse(value) as Partial<PostArchiveScrollState>;
        if (typeof parsed.layout !== 'string' || !parsed.layout.trim()) return null;
        const page = typeof parsed.page === 'number' ? parsed.page : Number.NaN;
        if (!Number.isSafeInteger(page) || page < 1) return null;
        return {
            layout: parsed.layout,
            page,
            outerTop: normalizeScrollValue(parsed.outerTop),
            group: typeof parsed.group === 'string' && parsed.group.trim() ? parsed.group : null,
            groupTop: normalizeScrollValue(parsed.groupTop),
        };
    } catch {
        return null;
    }
}

export function rememberPostArchiveScroll(state: PostArchiveScrollState | null): void {
    withSessionStorage(undefined, (storage) => {
        if (!state) {
            storage.removeItem(POST_ARCHIVE_SCROLL_KEY);
            return;
        }
        storage.setItem(POST_ARCHIVE_SCROLL_KEY, JSON.stringify(state));
    });
}

export function readPostArchiveScroll(storage?: StorageReader): PostArchiveScrollState | null {
    const value = storage
        ? storage.getItem(POST_ARCHIVE_SCROLL_KEY)
        : withSessionStorage(null, (session) => session.getItem(POST_ARCHIVE_SCROLL_KEY));
    return parsePostArchiveScroll(value);
}

export function clearPostArchiveScroll(): void {
    withSessionStorage(undefined, (storage) => storage.removeItem(POST_ARCHIVE_SCROLL_KEY));
}

export type { StorageReader };
