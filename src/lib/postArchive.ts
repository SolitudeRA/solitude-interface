import { parseBrowseParams, type BrowsePost } from './postBrowse';

export interface PostArchiveItem extends BrowsePost {
    id: string;
    url: string;
    feature_image: string | null;
    feature_image_srcset?: string;
    feature_image_sizes?: string;
    published_at: string;
    post_series: string;
    post_series_slug?: string;
    post_series_label?: string;
    post_series_number?: string;
}

export type ArchiveLayout = 'ledger' | 'series' | 'years';

export interface ArchiveFilters {
    category: string | null;
    type: string | null;
    query: string;
    page: number;
}

export interface ArchiveGroup {
    key: string;
    label: string;
    posts: PostArchiveItem[];
    isStandalone?: boolean;
}

export const INITIAL_ARCHIVE_FILTERS: ArchiveFilters = {
    category: null,
    type: null,
    query: '',
    page: 1,
};
export const DEFAULT_ARCHIVE_LAYOUT: ArchiveLayout = 'ledger';
export const ARCHIVE_LAYOUTS: readonly ArchiveLayout[] = ['ledger', 'series', 'years'];

function isVisible(value: string | null | undefined): value is string {
    const normalized = value?.trim().toLowerCase();
    return Boolean(normalized && normalized !== 'default');
}

export function formatArchiveDate(value: string): string {
    return value?.split('T')[0] ?? '';
}

export function formatArchiveMonthDay(value: string): string {
    return formatArchiveDate(value).slice(5).replace('-', '.');
}

export function formatArchiveYear(value: string): string {
    return formatArchiveDate(value).slice(0, 4);
}

export function getArchiveCategoryLabel(post: PostArchiveItem): string {
    if (isVisible(post.post_category_label)) return post.post_category_label.trim();
    return isVisible(post.post_category) ? post.post_category.trim() : '';
}

export function getArchiveSeriesLabel(post: PostArchiveItem): string | null {
    if (isVisible(post.post_series_label)) return post.post_series_label.trim();
    return isVisible(post.post_series) ? post.post_series.trim() : null;
}

export function parseArchiveParams(params: URLSearchParams): {
    filters: ArchiveFilters;
    layout: ArchiveLayout;
} {
    const parsed = parseBrowseParams(params);
    const rawLayout = params.get('archive') as ArchiveLayout | null;

    return {
        filters: {
            category: parsed.category,
            type: parsed.type,
            query: parsed.query,
            page: parsed.page,
        },
        layout:
            rawLayout && ARCHIVE_LAYOUTS.includes(rawLayout) ? rawLayout : DEFAULT_ARCHIVE_LAYOUT,
    };
}

export function serializeArchiveParams(
    currentParams: URLSearchParams,
    filters: ArchiveFilters,
    layout: ArchiveLayout
): string {
    const params = new URLSearchParams(currentParams);
    const set = (key: string, value: string | null) => {
        if (value?.trim()) params.set(key, value);
        else params.delete(key);
    };

    set('category', filters.category);
    set('type', filters.type);
    set('q', filters.query);
    set('page', filters.page > 1 ? String(filters.page) : null);
    set('archive', layout === DEFAULT_ARCHIVE_LAYOUT ? null : layout);

    return params.toString();
}

export function groupArchivePostsByYear(posts: readonly PostArchiveItem[]): ArchiveGroup[] {
    const groups = new Map<string, PostArchiveItem[]>();
    posts.forEach((post) => {
        const year = formatArchiveYear(post.published_at) || '—';
        groups.set(year, [...(groups.get(year) ?? []), post]);
    });

    return [...groups.entries()]
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([year, items]) => ({ key: year, label: year, posts: items }));
}

export function groupArchivePostsBySeries(
    posts: readonly PostArchiveItem[],
    standaloneLabel: string
): ArchiveGroup[] {
    const groups = new Map<string, ArchiveGroup>();
    posts.forEach((post) => {
        const label = getArchiveSeriesLabel(post);
        const isStandalone = label === null;
        const key = isStandalone
            ? '__standalone__'
            : isVisible(post.post_series_slug)
              ? post.post_series_slug.trim()
              : label;
        const group = groups.get(key) ?? {
            key,
            label: label ?? standaloneLabel,
            posts: [],
            isStandalone,
        };
        group.posts.push(post);
        groups.set(key, group);
    });

    groups.forEach((group) => {
        group.posts.sort((left, right) => {
            const leftNumber = Number.parseInt(
                left.post_series_number?.match(/\d+/)?.[0] ?? '',
                10
            );
            const rightNumber = Number.parseInt(
                right.post_series_number?.match(/\d+/)?.[0] ?? '',
                10
            );
            if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
                return leftNumber - rightNumber;
            }
            if (Number.isFinite(leftNumber)) return -1;
            if (Number.isFinite(rightNumber)) return 1;
            return right.published_at.localeCompare(left.published_at);
        });
    });

    return [...groups.values()].sort((left, right) => {
        if (left.isStandalone !== right.isStandalone) return left.isStandalone ? 1 : -1;
        return right.posts.length - left.posts.length || left.label.localeCompare(right.label);
    });
}
