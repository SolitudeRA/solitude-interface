import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react';
import {
    ArchiveHeaderControls,
    ArchivePagination,
    ArchiveSearchControl,
} from '@components/posts/view/PostArchiveControls';
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
import { extractFacets, filterPosts } from '@lib/postBrowse';

type PostViewKey = 'empty' | 'prevPage' | 'nextPage' | 'articleCount';

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
