/**
 * post-view 列表视图的纯逻辑：分面提取、筛选、分页、URL 状态序列化。
 * 全部为纯函数，无副作用，便于单测（见 postBrowse.test.ts）。
 * 数据源是构建期注入的全量文章元数据，筛选/分页一律在客户端即时计算。
 */

/**
 * 筛选/分面只读取的最小结构子集——完整的 `Post` 与注入岛的精简
 * `PostListItem`（不含庞大的 html）都满足它，故纯逻辑两者通用。
 */
export interface BrowsePost {
    title: string;
    excerpt: string;
    post_type: string;
    post_type_label?: string;
    post_category: string;
    post_category_label?: string;
    post_series?: string;
    post_series_label?: string;
}

export interface FacetOption {
    /** 分面取值（分类/类型的 slug） */
    slug: string;
    /** 展示用本地化标签（缺失时回退为 title-case 的 slug） */
    label: string;
    /** 该取值下的文章数 */
    count: number;
}

export interface Facets {
    categories: FacetOption[];
    types: FacetOption[];
}

export interface BrowseFilters {
    category?: string | null;
    type?: string | null;
    query?: string;
}

export type BrowseView = 'gallery' | 'list';

export interface BrowseState {
    view: BrowseView;
    category: string | null;
    type: string | null;
    query: string;
    page: number;
}

export interface PaginationResult<T> {
    items: T[];
    page: number;
    totalPages: number;
    total: number;
}

export const DEFAULT_BROWSE_STATE: BrowseState = {
    view: 'gallery',
    category: null,
    type: null,
    query: '',
    page: 1,
};

/** 是否为有效的分面取值：非空且不是 default 占位 */
function isFacetValue(value: string | null | undefined): value is string {
    if (!value) return false;
    const trimmed = value.trim();
    return trimmed !== '' && trimmed.toLowerCase() !== 'default';
}

/** 把 slug 转成可读标签（缺本地化标签时的回退）：open-source -> Open Source */
function titleCaseSlug(slug: string): string {
    return slug
        .trim()
        .replace(/[-_]+/g, ' ')
        .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function collectFacet(
    posts: readonly BrowsePost[],
    getSlug: (post: BrowsePost) => string | undefined,
    getLabel: (post: BrowsePost) => string | undefined
): FacetOption[] {
    const bySlug = new Map<string, FacetOption>();

    for (const post of posts) {
        const slug = getSlug(post);
        if (!isFacetValue(slug)) continue;

        const existing = bySlug.get(slug);
        if (existing) {
            existing.count += 1;
            continue;
        }

        const rawLabel = getLabel(post);
        bySlug.set(slug, {
            slug,
            label: isFacetValue(rawLabel) ? rawLabel.trim() : titleCaseSlug(slug),
            count: 1,
        });
    }

    // 数量降序，数量相同按 slug 升序（保证确定性）
    return [...bySlug.values()].sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

/** 从全量文章里提取可筛选的分类 / 类型分面（带计数，已排序） */
export function extractFacets(posts: readonly BrowsePost[]): Facets {
    return {
        categories: collectFacet(
            posts,
            (post) => post.post_category,
            (post) => post.post_category_label
        ),
        types: collectFacet(
            posts,
            (post) => post.post_type,
            (post) => post.post_type_label
        ),
    };
}

/** 按分类 / 类型 / 关键词（标题 + 摘要子串，大小写无关）做 AND 筛选 */
export function filterPosts<T extends BrowsePost>(
    posts: readonly T[],
    filters: BrowseFilters
): T[] {
    const category = filters.category ?? null;
    const type = filters.type ?? null;
    const query = filters.query?.trim().toLowerCase() ?? '';

    return posts.filter((post) => {
        if (category && post.post_category !== category) return false;
        if (type && post.post_type !== type) return false;
        if (query) {
            const haystack =
                `${post.title} ${post.excerpt} ${post.post_series ?? ''} ${post.post_series_label ?? ''}`.toLowerCase();
            if (!haystack.includes(query)) return false;
        }
        return true;
    });
}

/** 客户端分页；page 越界自动夹紧到 [1, totalPages]，空集视为单个空页 */
export function paginate<T>(items: T[], page: number, perPage: number): PaginationResult<T> {
    const total = items.length;
    const size = Math.max(1, Math.floor(perPage));
    const totalPages = Math.max(1, Math.ceil(total / size));
    const clampedPage = Math.min(Math.max(Math.floor(page), 1), totalPages);
    const start = (clampedPage - 1) * size;

    return {
        items: items.slice(start, start + size),
        page: clampedPage,
        totalPages,
        total,
    };
}

function normalizeParam(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

/** URLSearchParams -> BrowseState；非法 view / page 回退默认 */
export function parseBrowseParams(params: URLSearchParams): BrowseState {
    const view: BrowseView = params.get('view') === 'list' ? 'list' : 'gallery';
    const pageRaw = Number.parseInt(params.get('page') ?? '', 10);

    return {
        view,
        category: normalizeParam(params.get('category')),
        type: normalizeParam(params.get('type')),
        query: params.get('q') ?? '',
        page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
    };
}

/** BrowseState -> query 字符串（不含 `?`）；只写出非默认值，保持 URL 简洁 */
export function serializeBrowseParams(state: BrowseState): string {
    const params = new URLSearchParams();

    if (state.view === 'list') params.set('view', 'list');
    if (state.category) params.set('category', state.category);
    if (state.type) params.set('type', state.type);
    if (state.query.trim() !== '') params.set('q', state.query);
    if (state.page > 1) params.set('page', String(state.page));

    return params.toString();
}
