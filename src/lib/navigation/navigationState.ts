const POST_TRANSITION_PATH_KEY = 'solitude:post-transition-path';
const POST_RETURN_URL_KEY = 'solitude:post-return-url';
const POST_VIEW_SCROLL_KEY = 'solitude:post-view-scroll-left';

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

export type { StorageReader };
