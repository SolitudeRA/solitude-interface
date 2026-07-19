import { paginate, parseBrowseParams, type BrowsePost } from './postBrowse';

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
}

export interface ArchivePaginationState {
    page: number;
    group: string | null;
    groupPage: number;
}

export interface ArchiveState {
    filters: ArchiveFilters;
    layout: ArchiveLayout;
    pagination: ArchivePaginationState;
}

export interface ArchiveGroup {
    key: string;
    label: string;
    posts: PostArchiveItem[];
    description?: string;
    order?: number;
    color?: string;
    isStandalone?: boolean;
}

export interface ArchiveSeriesMetadata {
    label?: string;
    description?: string;
    order?: number;
    color?: string;
}

export type ArchiveSeriesMetadataMap = Record<string, ArchiveSeriesMetadata>;

export interface ArchiveGroupPage extends ArchiveGroup {
    visiblePosts: PostArchiveItem[];
    page: number;
    totalPages: number;
    startIndex: number;
}

export const INITIAL_ARCHIVE_FILTERS: ArchiveFilters = {
    category: null,
    type: null,
    query: '',
};
export const INITIAL_ARCHIVE_PAGINATION: ArchivePaginationState = {
    page: 1,
    group: null,
    groupPage: 1,
};
export const DEFAULT_ARCHIVE_LAYOUT: ArchiveLayout = 'ledger';
export const ARCHIVE_LAYOUTS: readonly ArchiveLayout[] = ['ledger', 'series', 'years'];
/**
 * Fixed logical capacities keep deep links deterministic across viewport sizes.
 * Responsive CSS changes presentation only, never which content belongs to a page.
 */
export const ARCHIVE_PAGE_SIZES: Readonly<Record<ArchiveLayout, number>> = {
    ledger: 20,
    series: 7,
    years: 3,
};
export const ARCHIVE_GROUP_PAGE_SIZES = {
    series: 6,
    years: 6,
} as const;

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

function parsePositivePage(value: string | null): number {
    const normalized = value?.trim() ?? '';
    if (!/^\d+$/.test(normalized)) return 1;
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function normalizeParam(value: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

export function parseArchiveParams(params: URLSearchParams): ArchiveState {
    const parsed = parseBrowseParams(params);
    const rawLayout = params.get('archive') as ArchiveLayout | null;
    const layout =
        rawLayout && ARCHIVE_LAYOUTS.includes(rawLayout) ? rawLayout : DEFAULT_ARCHIVE_LAYOUT;
    const supportsGroupPagination = layout === 'series' || layout === 'years';
    const rawGroup = supportsGroupPagination ? normalizeParam(params.get('archiveGroup')) : null;
    const groupPage = rawGroup ? parsePositivePage(params.get('archiveGroupPage')) : 1;
    const preservesFirstGroupPage = layout === 'series';

    return {
        filters: {
            category: parsed.category,
            type: parsed.type,
            query: parsed.query,
        },
        layout,
        pagination: {
            // `page` was the pre-foundation active-article cursor. Read it only as a
            // migration fallback; all new URLs use the unambiguous archivePage key.
            page: parsePositivePage(params.get('archivePage') ?? params.get('page')),
            group: preservesFirstGroupPage || groupPage > 1 ? rawGroup : null,
            groupPage,
        },
    };
}

export function serializeArchiveParams(
    currentParams: URLSearchParams,
    state: ArchiveState
): string {
    const params = new URLSearchParams(currentParams);
    const set = (key: string, value: string | null) => {
        if (value?.trim()) params.set(key, value);
        else params.delete(key);
    };
    const supportsGroupPagination = state.layout === 'series' || state.layout === 'years';
    const hasGroup =
        supportsGroupPagination &&
        Boolean(state.pagination.group) &&
        (state.layout === 'series' || state.pagination.groupPage > 1);

    set('category', state.filters.category);
    set('type', state.filters.type);
    set('q', state.filters.query);
    params.delete('page');
    set('archivePage', state.pagination.page > 1 ? String(state.pagination.page) : null);
    set('archive', state.layout === DEFAULT_ARCHIVE_LAYOUT ? null : state.layout);
    set('archiveGroup', hasGroup ? state.pagination.group : null);
    set(
        'archiveGroupPage',
        hasGroup && state.pagination.groupPage > 1 ? String(state.pagination.groupPage) : null
    );

    return params.toString();
}

export function groupArchivePostsByYear(posts: readonly PostArchiveItem[]): ArchiveGroup[] {
    const groups = new Map<string, PostArchiveItem[]>();
    posts.forEach((post) => {
        const year = formatArchiveYear(post.published_at) || '—';
        const group = groups.get(year);
        if (group) group.push(post);
        else groups.set(year, [post]);
    });

    return [...groups.entries()]
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([year, items]) => ({ key: year, label: year, posts: items }));
}

export function paginateArchiveGroup(
    group: ArchiveGroup,
    page: number,
    perPage: number
): ArchiveGroupPage {
    const result = paginate(group.posts, page, perPage);
    return {
        ...group,
        visiblePosts: result.items,
        page: result.page,
        totalPages: result.totalPages,
        startIndex: (result.page - 1) * Math.max(1, Math.floor(perPage)),
    };
}

export function groupArchivePostsBySeries(
    posts: readonly PostArchiveItem[],
    standaloneLabel: string,
    metadata: ArchiveSeriesMetadataMap = {}
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
        const seriesMetadata = metadata[key];
        const group = groups.get(key) ?? {
            key,
            label: seriesMetadata?.label || label || standaloneLabel,
            posts: [],
            ...(seriesMetadata?.description ? { description: seriesMetadata.description } : {}),
            ...(seriesMetadata?.order !== undefined ? { order: seriesMetadata.order } : {}),
            ...(seriesMetadata?.color ? { color: seriesMetadata.color } : {}),
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
        const leftOrder = left.order ?? Number.POSITIVE_INFINITY;
        const rightOrder = right.order ?? Number.POSITIVE_INFINITY;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.label.localeCompare(right.label);
    });
}
