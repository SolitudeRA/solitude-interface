export type PostViewMode = 'gallery' | 'list';

const POST_VIEW_PATH_PATTERN = /^\/(?:[^/]+\/)?post-view\/?$/;

export function isPostViewPath(pathname: string): boolean {
    return POST_VIEW_PATH_PATTERN.test(pathname);
}

export function getPostViewMode(url: URL): PostViewMode {
    return url.searchParams.get('view') === 'list' ? 'list' : 'gallery';
}

export function isPostViewMode(value: string | null): value is PostViewMode {
    return value === 'gallery' || value === 'list';
}

export function buildPostViewPath(url: URL, view: PostViewMode): string {
    const params = new URLSearchParams(url.search);
    if (view === 'list') params.set('view', 'list');
    else params.delete('view');

    const query = params.toString();
    return query ? `${url.pathname}?${query}` : url.pathname;
}

export function toPathWithSearchAndHash(url: URL): string {
    return `${url.pathname}${url.search}${url.hash}`;
}
