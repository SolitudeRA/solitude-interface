import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react';
import { ChevronLeft, ChevronRight, Columns3, LayoutList, LibraryBig, Search } from 'lucide-react';
import { cn } from '@components/common/lib/utils';
import {
    ArchiveRail,
    LedgerView,
    SeriesLibrary,
    YearColumns,
} from '@components/posts/view/PostArchiveLayouts';
import { getUIText, type Locale } from '@lib/i18n';
import {
    ARCHIVE_LAYOUTS,
    DEFAULT_ARCHIVE_LAYOUT,
    groupArchivePostsBySeries,
    groupArchivePostsByYear,
    INITIAL_ARCHIVE_FILTERS,
    parseArchiveParams,
    serializeArchiveParams,
    type ArchiveFilters,
    type ArchiveLayout,
    type PostArchiveItem,
} from '@lib/postArchive';
import { extractFacets, filterPosts, type FacetOption } from '@lib/postBrowse';

type PostViewKey =
    | 'category'
    | 'all'
    | 'empty'
    | 'prevPage'
    | 'nextPage'
    | 'archiveView'
    | 'archiveLedger'
    | 'archiveSeries'
    | 'archiveYears'
    | 'articleCount';

const ARCHIVE_PANEL_VARIANTS: Variants = {
    enter: (direction: number) => ({
        opacity: 0,
        x: direction * 12,
    }),
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            opacity: { duration: 0.24, ease: 'linear' },
            x: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
        },
    },
    exit: (direction: number) => ({
        opacity: 0,
        x: direction * -6,
        transition: {
            opacity: { duration: 0.24, ease: 'linear' },
            x: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
        },
    }),
};

function readUrlState(): { filters: ArchiveFilters; layout: ArchiveLayout } {
    return parseArchiveParams(new URLSearchParams(window.location.search));
}

function writeUrlState(
    filters: ArchiveFilters,
    layout: ArchiveLayout,
    mode: 'push' | 'replace' = 'replace'
): void {
    const query = serializeArchiveParams(
        new URLSearchParams(window.location.search),
        filters,
        layout
    );
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
}

export default function PostArchiveView({
    posts,
    locale,
}: {
    posts: PostArchiveItem[];
    locale: Locale;
}) {
    const [filters, setFilters] = useState<ArchiveFilters>(INITIAL_ARCHIVE_FILTERS);
    const [layout, setLayout] = useState<ArchiveLayout>(DEFAULT_ARCHIVE_LAYOUT);
    const [layoutDirection, setLayoutDirection] = useState(1);
    const layoutRef = useRef<ArchiveLayout>(DEFAULT_ARCHIVE_LAYOUT);
    const [activePostId, setActivePostId] = useState(posts[0]?.id ?? '');
    const [headerPortalHost, setHeaderPortalHost] = useState<HTMLElement | null>(null);
    const [searchPortalHost, setSearchPortalHost] = useState<HTMLElement | null>(null);
    const [paginationPortalHost, setPaginationPortalHost] = useState<HTMLElement | null>(null);
    const [isListVisible, setIsListVisible] = useState(false);

    const updateLayout = useCallback((next: ArchiveLayout) => {
        const previous = layoutRef.current;
        if (next === previous) return false;

        const direction =
            Math.sign(ARCHIVE_LAYOUTS.indexOf(next) - ARCHIVE_LAYOUTS.indexOf(previous)) || 1;
        layoutRef.current = next;
        setLayoutDirection(direction);
        setLayout(next);
        return true;
    }, []);

    useEffect(() => {
        const sync = () => {
            const state = readUrlState();
            setFilters(state.filters);
            updateLayout(state.layout);
        };
        sync();
        window.addEventListener('popstate', sync);
        return () => window.removeEventListener('popstate', sync);
    }, [updateLayout]);

    useEffect(() => {
        const syncVisibility = () => {
            setIsListVisible(new URLSearchParams(window.location.search).get('view') === 'list');
        };

        setHeaderPortalHost(document.getElementById('post-archive-header-host'));
        setSearchPortalHost(document.getElementById('post-archive-search-host'));
        setPaginationPortalHost(document.getElementById('post-archive-pagination-host'));
        syncVisibility();
        window.addEventListener('popstate', syncVisibility);
        window.addEventListener('post-view-change', syncVisibility);
        return () => {
            window.removeEventListener('popstate', syncVisibility);
            window.removeEventListener('post-view-change', syncVisibility);
        };
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
    const yearGroups = useMemo(() => groupArchivePostsByYear(filtered), [filtered]);
    const standalone = getUIText('postView', 'standalonePosts', locale);
    const seriesGroups = useMemo(
        () => groupArchivePostsBySeries(filtered, standalone),
        [filtered, standalone]
    );

    useEffect(() => {
        if (!filtered.some((post) => post.id === activePostId)) {
            setActivePostId(filtered[0]?.id ?? '');
        }
    }, [activePostId, filtered]);

    const activePost = filtered.find((post) => post.id === activePostId) ?? filtered[0] ?? null;
    const activePostIndex = activePost
        ? filtered.findIndex((post) => post.id === activePost.id)
        : -1;
    const commitFilters = useCallback(
        (next: ArchiveFilters) => {
            setFilters(next);
            writeUrlState(next, layout);
        },
        [layout]
    );
    const selectLayout = useCallback(
        (next: ArchiveLayout) => {
            if (!updateLayout(next)) return;
            writeUrlState(filters, next, 'push');
        },
        [filters, updateLayout]
    );
    const selectCategory = (slug: string | null) =>
        commitFilters({
            ...filters,
            category: filters.category === slug ? null : slug,
            page: 1,
        });
    const searchPosts = (query: string) => {
        if (!isListVisible && query.trim()) {
            document.querySelector<HTMLButtonElement>('[data-view-toggle="list"]')?.click();
        }
        commitFilters({ ...filters, query, page: 1 });
    };
    const activatePostAt = (index: number) => {
        const nextPost = filtered[index];
        if (!nextPost) return;
        setActivePostId(nextPost.id);
        window.requestAnimationFrame(() => {
            const target = document.querySelector<HTMLElement>(
                `[data-archive-post-id="${nextPost.id}"]`
            );
            target?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'auto'
                    : 'smooth',
                block: 'nearest',
                inline: 'nearest',
            });
        });
    };

    const t = (key: PostViewKey) => getUIText('postView', key, locale);
    const countLabel = (count: number) => t('articleCount').replace('{count}', String(count));

    return (
        <MotionConfig reducedMotion="user">
            {headerPortalHost &&
                isListVisible &&
                createPortal(
                    <ArchiveHeaderControls
                        layout={layout}
                        locale={locale}
                        categories={facets.categories}
                        selectedCategory={filters.category}
                        onLayout={selectLayout}
                        onCategory={selectCategory}
                    />,
                    headerPortalHost
                )}

            {searchPortalHost &&
                createPortal(
                    <ArchiveSearchControl
                        locale={locale}
                        query={filters.query}
                        onQuery={searchPosts}
                    />,
                    searchPortalHost
                )}

            {paginationPortalHost &&
                isListVisible &&
                createPortal(
                    <ArchivePagination
                        currentIndex={activePostIndex}
                        totalCount={filtered.length}
                        previousLabel={t('prevPage')}
                        nextLabel={t('nextPage')}
                        onPrevious={() => activatePostAt(activePostIndex - 1)}
                        onNext={() => activatePostAt(activePostIndex + 1)}
                    />,
                    paginationPortalHost
                )}

            <div
                data-post-list-root
                data-view-motion-content
                data-archive-layout={layout}
                className="post-view-main-viewport flex w-full max-w-full flex-col overflow-hidden"
            >
                <div className="flex min-h-0 min-w-0 flex-1 items-center overflow-x-hidden px-2 sm:px-4 md:px-6">
                    <div className="mx-auto flex h-[var(--post-view-content-height)] min-h-0 w-full max-w-[96rem] min-w-0 flex-col overflow-x-hidden">
                        <div className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden">
                            <AnimatePresence initial={false} mode="sync" custom={layoutDirection}>
                                <motion.div
                                    key={layout}
                                    custom={layoutDirection}
                                    variants={ARCHIVE_PANEL_VARIANTS}
                                    initial="enter"
                                    animate="visible"
                                    exit="exit"
                                    data-archive-motion-panel={layout}
                                    className="absolute inset-0 h-full min-h-0 w-full"
                                >
                                    {filtered.length === 0 ? (
                                        <p className="text-muted-foreground border-border/55 bg-card/45 flex h-full items-center justify-center rounded-2xl border px-5 text-center text-sm backdrop-blur-xl">
                                            {t('empty')}
                                        </p>
                                    ) : layout === 'ledger' ? (
                                        <LedgerView
                                            groups={yearGroups}
                                            activePost={activePost}
                                            onActivate={setActivePostId}
                                            countLabel={countLabel}
                                            locale={locale}
                                        />
                                    ) : (
                                        <ArchiveRail activePost={activePost} locale={locale}>
                                            {layout === 'series' ? (
                                                <SeriesLibrary
                                                    groups={seriesGroups}
                                                    activePost={activePost}
                                                    onActivate={setActivePostId}
                                                    countLabel={countLabel}
                                                />
                                            ) : (
                                                <YearColumns
                                                    groups={yearGroups}
                                                    activePost={activePost}
                                                    onActivate={setActivePostId}
                                                    countLabel={countLabel}
                                                />
                                            )}
                                        </ArchiveRail>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </MotionConfig>
    );
}

function ArchiveHeaderControls({
    layout,
    locale,
    categories,
    selectedCategory,
    onLayout,
    onCategory,
}: {
    layout: ArchiveLayout;
    locale: Locale;
    categories: FacetOption[];
    selectedCategory: string | null;
    onLayout: (layout: ArchiveLayout) => void;
    onCategory: (slug: string | null) => void;
}) {
    const t = (key: PostViewKey) => getUIText('postView', key, locale);
    const options = [
        ['ledger', t('archiveLedger'), LayoutList],
        ['series', t('archiveSeries'), LibraryBig],
        ['years', t('archiveYears'), Columns3],
    ] as const;

    return (
        <div data-archive-header-controls className="flex items-center gap-1">
            <div
                role="tablist"
                aria-label={t('archiveView')}
                className="border-border/45 bg-background/72 flex items-center gap-0.5 rounded-full border p-0.5 shadow-lg backdrop-blur-xl"
            >
                {options.map(([key, label, Icon]) => (
                    <button
                        key={key}
                        id={`archive-tab-${key}`}
                        type="button"
                        role="tab"
                        aria-label={label}
                        aria-selected={layout === key}
                        aria-controls={`archive-panel-${key}`}
                        data-archive-layout-button={key}
                        onClick={() => onLayout(key)}
                        className={cn(
                            'focus-visible:ring-ring inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 text-[0.68rem] font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus:outline-none focus-visible:ring-2 active:scale-[0.97] sm:px-2.5 xl:h-9 xl:px-3 xl:text-xs',
                            layout === key
                                ? 'border-foreground/12 bg-foreground/[0.1] text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground border-transparent'
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            <CategorySwitcher
                categories={categories}
                selected={selectedCategory}
                label={t('category')}
                allLabel={t('all')}
                onSelect={onCategory}
            />
        </div>
    );
}

function ArchiveSearchControl({
    locale,
    query,
    onQuery,
}: {
    locale: Locale;
    query: string;
    onQuery: (query: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const label = getUIText('postView', 'searchPlaceholder', locale);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    return (
        <div data-archive-search className="relative">
            <button
                type="button"
                data-archive-search-button
                aria-label={label}
                aria-expanded={isOpen}
                aria-controls="post-archive-search-panel"
                onClick={() => setIsOpen((open) => !open)}
                className={cn(
                    'border-border/45 bg-background/78 text-muted-foreground focus-visible:ring-ring hover:bg-foreground/[0.08] hover:text-foreground relative inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition-colors focus:outline-none focus-visible:ring-2',
                    isOpen && 'bg-foreground/[0.1] text-foreground'
                )}
            >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {query && (
                    <span className="bg-primary absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" />
                )}
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.label
                        id="post-archive-search-panel"
                        data-archive-search-panel
                        initial={{ opacity: 0, y: -6, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.99 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="border-border/50 bg-background/88 focus-within:ring-ring/70 absolute top-[calc(100%+0.5rem)] right-0 z-[80] flex h-11 w-[min(20rem,calc(100vw-2rem))] origin-top-right items-center gap-2 rounded-full border px-3 shadow-2xl backdrop-blur-2xl focus-within:ring-2"
                    >
                        <Search
                            className="text-muted-foreground h-4 w-4 shrink-0"
                            aria-hidden="true"
                        />
                        <input
                            ref={inputRef}
                            type="search"
                            value={query}
                            onChange={(event) => onQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') setIsOpen(false);
                            }}
                            placeholder={label}
                            aria-label={label}
                            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
                        />
                    </motion.label>
                )}
            </AnimatePresence>
        </div>
    );
}

function ArchivePagination({
    currentIndex,
    totalCount,
    previousLabel,
    nextLabel,
    onPrevious,
    onNext,
}: {
    currentIndex: number;
    totalCount: number;
    previousLabel: string;
    nextLabel: string;
    onPrevious: () => void;
    onNext: () => void;
}) {
    const position = currentIndex >= 0 ? currentIndex + 1 : 0;
    return (
        <div
            data-archive-pagination
            className="border-border/55 bg-background/72 flex items-center gap-1 rounded-full border p-1 shadow-xl backdrop-blur-xl"
        >
            <button
                type="button"
                onClick={onPrevious}
                disabled={position <= 1}
                aria-label={previousLabel}
                className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="text-muted-foreground min-w-[4.25rem] text-center text-[0.68rem] font-semibold tracking-[0.08em] tabular-nums">
                {String(position).padStart(2, '0')} / {String(totalCount).padStart(2, '0')}
            </span>
            <button
                type="button"
                onClick={onNext}
                disabled={position === 0 || position >= totalCount}
                aria-label={nextLabel}
                className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}

function CategorySwitcher({
    categories,
    selected,
    label,
    allLabel,
    onSelect,
}: {
    categories: FacetOption[];
    selected: string | null;
    label: string;
    allLabel: string;
    onSelect: (slug: string | null) => void;
}) {
    return (
        <div data-archive-category-switcher className="flex items-center">
            <select
                value={selected ?? ''}
                onChange={(event) => onSelect(event.target.value || null)}
                aria-label={label}
                className="border-border/45 bg-background/72 text-foreground h-9 max-w-[5.5rem] rounded-full border px-2.5 text-[0.7rem] font-semibold shadow-lg backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] xl:hidden"
            >
                <option value="">{allLabel}</option>
                {categories.map((option) => (
                    <option key={option.slug} value={option.slug}>
                        {option.label}
                    </option>
                ))}
            </select>
            <div
                role="group"
                aria-label={label}
                className="border-border/45 bg-background/72 hidden items-center gap-0.5 rounded-full border p-0.5 shadow-lg backdrop-blur-xl xl:flex"
            >
                <Chip active={selected === null} onClick={() => onSelect(null)}>
                    {allLabel}
                </Chip>
                {categories.map((option) => (
                    <Chip
                        key={option.slug}
                        active={selected === option.slug}
                        onClick={() => onSelect(option.slug)}
                    >
                        {option.label}
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
                'focus-visible:ring-ring inline-flex h-8 shrink-0 items-center rounded-[0.62rem] border px-2.5 text-[0.7rem] font-semibold transition-colors focus:outline-none focus-visible:ring-2',
                active
                    ? 'border-foreground/10 bg-foreground/[0.08] text-foreground'
                    : 'text-muted-foreground hover:bg-card/22 hover:text-foreground border-transparent'
            )}
        >
            {children}
        </button>
    );
}
