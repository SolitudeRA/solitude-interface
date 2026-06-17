import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@components/common/lib/utils';
import { useHorizontalScroll } from '@components/common/lib/useHorizontalScroll';
import { getUIText, type Locale } from '@lib/i18n';
import {
    extractFacets,
    filterPosts,
    parseBrowseParams,
    type BrowsePost,
    type FacetOption,
} from '@lib/postBrowse';

/**
 * 注入岛的精简文章元数据：去掉庞大的 html，URL 一律转成字符串，
 * 字段名与 BrowsePost 对齐，故可直接喂给 filterPosts / extractFacets。
 */
export interface PostListItem extends BrowsePost {
    id: string;
    url: string;
    feature_image: string | null;
    published_at: string;
}

type PostViewKey =
    | 'galleryView'
    | 'listView'
    | 'viewAll'
    | 'category'
    | 'type'
    | 'all'
    | 'searchPlaceholder'
    | 'clear'
    | 'resultCount'
    | 'empty'
    | 'prevPage'
    | 'nextPage';

interface PostListViewProps {
    posts: PostListItem[];
    locale: Locale;
}

const RAIL_GAP = 16;
const RAIL_CARD_FALLBACK_WIDTH = 320;

interface ListFilters {
    category: string | null;
    type: string | null;
    query: string;
    page: number;
}

const INITIAL_FILTERS: ListFilters = { category: null, type: null, query: '', page: 1 };

/** 从当前 URL 读取筛选态（view 由页面脚本管理，这里忽略） */
function readFiltersFromUrl(): ListFilters {
    const state = parseBrowseParams(new URLSearchParams(window.location.search));
    return { category: state.category, type: state.type, query: state.query, page: state.page };
}

/** 写回 URL，只动自己的键，保留 view 等其它参数 */
function writeFiltersToUrl(filters: ListFilters): void {
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, value: string | null) => {
        if (value && value.trim() !== '') params.set(key, value);
        else params.delete(key);
    };
    set('category', filters.category);
    set('type', filters.type);
    set('q', filters.query);
    set('page', filters.page > 1 ? String(filters.page) : null);

    const qs = params.toString();
    window.history.replaceState(
        null,
        '',
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );
}

function formatDate(value: string): string {
    return value?.split('T')[0] ?? '';
}

export default function PostListView({ posts, locale }: PostListViewProps) {
    const [filters, setFilters] = useState<ListFilters>(INITIAL_FILTERS);

    // 挂载后从 URL 读取（深链）；SSR 用默认态，避免 hydration 不一致
    useEffect(() => {
        setFilters(readFiltersFromUrl());
        const onPopState = () => setFilters(readFiltersFromUrl());
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const facets = useMemo(() => extractFacets(posts), [posts]);

    const filtered = useMemo(
        () =>
            filterPosts(posts, {
                category: filters.category,
                type: filters.type,
                query: filters.query,
            }),
        [posts, filters.category, filters.type, filters.query]
    );

    const commit = useCallback((next: ListFilters) => {
        setFilters(next);
        writeFiltersToUrl(next);
    }, []);

    const setCategory = (slug: string | null) =>
        commit({ ...filters, category: filters.category === slug ? null : slug, page: 1 });
    const setType = (slug: string | null) =>
        commit({ ...filters, type: filters.type === slug ? null : slug, page: 1 });
    const setQuery = (query: string) => commit({ ...filters, query, page: 1 });
    const clearAll = () => commit(INITIAL_FILTERS);

    const {
        containerRef,
        canScrollLeft,
        canScrollRight,
        setIsHovering,
        handleWheel,
        scrollByPage,
        scrollToIndex,
    } = useHorizontalScroll<HTMLUListElement>({
        itemSelector: '.post-list-rail-card',
        itemGap: RAIL_GAP,
        fallbackItemWidth: RAIL_CARD_FALLBACK_WIDTH,
        requireHover: false,
        pageScrollRatio: 0.78,
        observeMutations: true,
        dependencyKey: `${filtered.length}:${filters.category ?? ''}:${filters.type ?? ''}:${filters.query}`,
    });

    useEffect(() => {
        scrollToIndex(0);
    }, [filtered.length, filters.category, filters.type, filters.query, scrollToIndex]);

    const hasActiveFilter =
        filters.category !== null || filters.type !== null || filters.query.trim() !== '';

    const t = (key: PostViewKey) => getUIText('postView', key, locale);
    const resultText = t('resultCount')
        .replace('{total}', String(posts.length))
        .replace('{count}', String(filtered.length));

    return (
        <div
            data-post-list-root
            className="flex h-[75svh] min-h-[520px] w-full flex-col overflow-hidden pt-[11.5rem] sm:pt-[10.75rem] md:pt-24 2xl:pt-3"
        >
            <FilterBar
                facets={facets}
                filters={filters}
                locale={locale}
                totalCount={posts.length}
                matchCount={filtered.length}
                onCategory={setCategory}
                onType={setType}
                onQuery={setQuery}
                onClear={clearAll}
                hasActiveFilter={hasActiveFilter}
                resultText={resultText}
            />

            {filtered.length > 0 ? (
                <div
                    className="group/list relative min-h-0 flex-1"
                    onPointerEnter={() => setIsHovering(true)}
                    onPointerLeave={() => setIsHovering(false)}
                >
                    {canScrollLeft && (
                        <div className="pointer-events-none absolute top-0 bottom-4 left-0 z-10 hidden w-20 bg-gradient-to-r from-[var(--background)]/70 to-transparent opacity-90 sm:block" />
                    )}
                    {canScrollRight && (
                        <div className="pointer-events-none absolute top-0 right-0 bottom-4 z-10 hidden w-20 bg-gradient-to-l from-[var(--background)]/70 to-transparent opacity-90 sm:block" />
                    )}

                    {canScrollLeft && (
                        <button
                            type="button"
                            onClick={() => scrollByPage('left')}
                            aria-label={t('prevPage')}
                            className="border-border/70 bg-background/70 text-foreground hover:bg-background absolute top-1/2 left-3 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border opacity-0 shadow-xl backdrop-blur-md transition-[opacity,background-color,transform] group-focus-within/list:opacity-100 group-hover/list:opacity-100 hover:scale-105 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:inline-flex"
                        >
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                    )}
                    {canScrollRight && (
                        <button
                            type="button"
                            onClick={() => scrollByPage('right')}
                            aria-label={t('nextPage')}
                            className="border-border/70 bg-background/70 text-foreground hover:bg-background absolute top-1/2 right-3 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border opacity-0 shadow-xl backdrop-blur-md transition-[opacity,background-color,transform] group-focus-within/list:opacity-100 group-hover/list:opacity-100 hover:scale-105 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:inline-flex"
                        >
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                    )}

                    <ul
                        data-post-list-rail
                        ref={containerRef}
                        onWheel={handleWheel}
                        className="post-list-rail grid h-full touch-pan-x snap-x snap-mandatory [scroll-padding-inline:clamp(1rem,5vw,60px)] auto-cols-[minmax(18rem,82vw)] grid-flow-col grid-rows-[repeat(var(--post-flow-rows),minmax(0,var(--post-flow-row-height)))] content-center gap-4 overflow-x-auto overflow-y-hidden scroll-smooth [padding-inline:clamp(1rem,5vw,60px)] [--post-flow-rows:1] [-ms-overflow-style:none] [scrollbar-width:none] sm:auto-cols-[22rem] sm:[--post-flow-rows:2] lg:auto-cols-[23rem] xl:auto-cols-[24rem] 2xl:auto-cols-[25rem] [&_.post-list-rail-card]:snap-center [&::-webkit-scrollbar]:hidden"
                        aria-label="全部文章"
                    >
                        {filtered.map((post) => (
                            <li key={post.id} className="post-list-rail-card flex min-h-0 w-full">
                                <PostListCard post={post} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-muted-foreground border-border/70 bg-card/55 flex min-h-0 flex-1 items-center justify-center rounded-2xl border px-5 py-10 text-center text-sm shadow-2xl backdrop-blur-xl">
                    {t('empty')}
                </p>
            )}
        </div>
    );
}

interface FilterBarProps {
    facets: { categories: FacetOption[]; types: FacetOption[] };
    filters: ListFilters;
    locale: Locale;
    totalCount: number;
    matchCount: number;
    onCategory: (slug: string | null) => void;
    onType: (slug: string | null) => void;
    onQuery: (query: string) => void;
    onClear: () => void;
    hasActiveFilter: boolean;
    resultText: string;
}

function FilterBar({
    facets,
    filters,
    locale,
    totalCount,
    matchCount,
    onCategory,
    onType,
    onQuery,
    onClear,
    hasActiveFilter,
    resultText,
}: FilterBarProps) {
    const t = (key: PostViewKey) => getUIText('postView', key, locale);
    const showTypeFilters = facets.types.length > 1 || filters.type !== null;

    return (
        <div
            data-post-filter-bar
            className="pointer-events-none fixed inset-x-2 top-[calc(12svh+0.45rem)] z-[65] flex justify-center sm:inset-x-4 sm:top-[calc(13svh+0.45rem)] md:inset-x-6 md:top-[calc(14svh+0.5rem)] 2xl:top-0 2xl:right-[clamp(22rem,22vw,28rem)] 2xl:left-[clamp(36rem,34vw,43rem)] 2xl:h-[14svh] 2xl:items-center"
        >
            <div className="pointer-events-auto w-full max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] md:max-w-[min(72vw,68rem)] 2xl:max-w-[56rem]">
                <div
                    data-post-filter-shell
                    className="border-border/70 bg-background/80 rounded-[1.65rem] border p-1.5 shadow-[0_16px_42px_rgba(0,0,0,0.2)] backdrop-blur-xl md:rounded-full"
                >
                    <div className="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center">
                        <div className="flex min-w-0 items-center gap-1.5 md:w-[17rem] md:flex-none lg:w-[19rem]">
                            <label className="border-border/60 bg-card/35 focus-within:ring-ring/70 relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors focus-within:ring-2">
                                <Search
                                    className="text-muted-foreground h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                />
                                <input
                                    type="search"
                                    value={filters.query}
                                    onChange={(event) => onQuery(event.target.value)}
                                    placeholder={t('searchPlaceholder')}
                                    aria-label={t('searchPlaceholder')}
                                    className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
                                />
                            </label>

                            <FilterActions
                                className="md:hidden"
                                matchCount={matchCount}
                                totalCount={totalCount}
                                resultText={resultText}
                                clearLabel={t('clear')}
                                hasActiveFilter={hasActiveFilter}
                                onClear={onClear}
                            />
                        </div>

                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <div
                                data-post-filter-strip
                                className="border-border/55 bg-card/25 min-w-0 flex-1 rounded-full border px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                            >
                                <div className="flex min-w-0 items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    {facets.categories.length > 0 && (
                                        <ChipRow
                                            label={t('category')}
                                            options={facets.categories}
                                            selected={filters.category}
                                            allLabel={t('all')}
                                            allCount={totalCount}
                                            onSelect={onCategory}
                                        />
                                    )}
                                    {showTypeFilters && (
                                        <ChipRow
                                            label={t('type')}
                                            options={facets.types}
                                            selected={filters.type}
                                            allLabel={t('all')}
                                            allCount={totalCount}
                                            onSelect={onType}
                                        />
                                    )}
                                </div>
                            </div>

                            <FilterActions
                                className="hidden md:flex"
                                matchCount={matchCount}
                                totalCount={totalCount}
                                resultText={resultText}
                                clearLabel={t('clear')}
                                hasActiveFilter={hasActiveFilter}
                                onClear={onClear}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FilterActions({
    className,
    matchCount,
    totalCount,
    resultText,
    clearLabel,
    hasActiveFilter,
    onClear,
}: {
    className?: string;
    matchCount: number;
    totalCount: number;
    resultText: string;
    clearLabel: string;
    hasActiveFilter: boolean;
    onClear: () => void;
}) {
    return (
        <div className={cn('flex shrink-0 items-center gap-1.5', className)} aria-live="polite">
            <span
                className="border-border/55 bg-card/30 text-muted-foreground inline-flex h-9 items-center rounded-full border px-2.5 text-[0.72rem] font-semibold tabular-nums"
                aria-label={resultText}
            >
                {matchCount}/{totalCount}
            </span>
            {hasActiveFilter && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label={clearLabel}
                    className="border-border/60 bg-card/30 text-muted-foreground hover:border-foreground/30 hover:bg-card/55 hover:text-foreground focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2"
                >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

interface ChipRowProps {
    label: string;
    options: FacetOption[];
    selected: string | null;
    allLabel: string;
    allCount: number;
    onSelect: (slug: string | null) => void;
}

function ChipRow({ label, options, selected, allLabel, allCount, onSelect }: ChipRowProps) {
    return (
        <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-muted-foreground/85 shrink-0 px-1.5 text-[0.68rem] font-semibold">
                {label}
            </span>
            <div className="flex shrink-0 items-center gap-1">
                <Chip active={selected === null} onClick={() => onSelect(null)}>
                    {allLabel}
                    <span className="ml-1.5 opacity-65">{allCount}</span>
                </Chip>
                {options.map((option) => (
                    <Chip
                        key={option.slug}
                        active={selected === option.slug}
                        onClick={() => onSelect(option.slug)}
                    >
                        {option.label}
                        <span className="ml-1.5 opacity-65">{option.count}</span>
                    </Chip>
                ))}
            </div>
        </div>
    );
}

function Chip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'focus-visible:ring-ring inline-flex h-8 shrink-0 items-center rounded-full border px-2.5 text-[0.72rem] font-semibold transition-[border-color,background-color,color,box-shadow] focus:outline-none focus-visible:ring-2',
                active
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(0,0,0,0.18)]'
                    : 'text-muted-foreground hover:border-border/70 hover:bg-card/55 hover:text-foreground border-transparent'
            )}
        >
            {children}
        </button>
    );
}

function PostListCard({ post }: { post: PostListItem }) {
    const hasImage = Boolean(post.feature_image && post.feature_image.length > 0);
    const date = formatDate(post.published_at);
    const typeLabel =
        post.post_type_label && post.post_type_label.toLowerCase() !== 'default'
            ? post.post_type_label
            : '';
    const categoryLabel =
        post.post_category_label && post.post_category_label.toLowerCase() !== 'default'
            ? post.post_category_label
            : '';
    const excerpt = post.excerpt?.trim() ?? '';

    return (
        <a
            href={post.url}
            aria-label={post.title}
            className={cn(
                'group focus-visible:ring-ring relative flex h-full w-full flex-col overflow-hidden rounded-2xl border sm:flex-row',
                'border-border/70 bg-card/50 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300',
                'hover:border-foreground/30 hover:bg-card/70 hover:shadow-[0_24px_70px_rgba(0,0,0,0.28)] focus:outline-none focus-visible:ring-2'
            )}
        >
            <div className="bg-muted relative h-[44%] min-h-[8rem] shrink-0 overflow-hidden sm:h-full sm:min-h-0 sm:w-[42%]">
                {hasImage ? (
                    <img
                        src={post.feature_image ?? ''}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
                    />
                ) : (
                    <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,var(--card-image-fallback-highlight),transparent_32%),linear-gradient(135deg,var(--card-image-fallback-start),var(--card-image-fallback-end))]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent opacity-80 transition-opacity group-hover:opacity-60" />
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3.5">
                {(typeLabel || categoryLabel) && (
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        {typeLabel && (
                            <span className="text-foreground/85 rounded-full border border-cyan-200/40 bg-cyan-300/12 px-2 py-0.5 text-[0.68rem] font-semibold">
                                {typeLabel}
                            </span>
                        )}
                        {categoryLabel && (
                            <span className="text-foreground/85 rounded-full border border-lime-200/35 bg-lime-300/12 px-2 py-0.5 text-[0.68rem] font-semibold">
                                {categoryLabel}
                            </span>
                        )}
                    </div>
                )}
                <h3 className="text-foreground line-clamp-2 text-[0.95rem] leading-snug font-semibold">
                    {post.title}
                </h3>
                {excerpt && (
                    <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-relaxed">
                        {excerpt}
                    </p>
                )}
                {date && (
                    <time
                        className="text-muted-foreground mt-auto pt-4 text-xs font-medium"
                        dateTime={date}
                    >
                        {date}
                    </time>
                )}
            </div>
        </a>
    );
}
