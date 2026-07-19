import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react';
import { ArchivePagination } from '@components/posts/view/PostArchiveControls';
import { ArchiveRail, LedgerView, YearColumns } from '@components/posts/view/PostArchiveLayouts';
import SeriesLibrary from '@components/posts/view/SeriesLibrary';
import { getUIText, type Locale } from '@lib/i18n';
import {
    ARCHIVE_GROUP_PAGE_SIZES,
    ARCHIVE_LAYOUTS,
    ARCHIVE_PAGE_SIZES,
    DEFAULT_ARCHIVE_LAYOUT,
    groupArchivePostsBySeries,
    groupArchivePostsByYear,
    INITIAL_ARCHIVE_FILTERS,
    INITIAL_ARCHIVE_PAGINATION,
    paginateArchiveGroup,
    type ArchiveFilters,
    type ArchiveGroup,
    type ArchiveGroupPage,
    type ArchiveLayout,
    type ArchivePaginationState,
    type ArchiveSeriesMetadataMap,
    type ArchiveState,
    type PostArchiveItem,
} from '@lib/postArchive';
import {
    POST_ARCHIVE_RENDER_EVENT,
    POST_ARCHIVE_STATE_EVENT,
    readPostArchiveState,
    writePostArchiveState,
} from '@lib/navigation/postArchiveStateController';
import { filterPosts, paginate, type PaginationResult } from '@lib/postBrowse';

type PostViewKey = 'empty' | 'prevPage' | 'nextPage' | 'articleCount';
type GroupLayout = Exclude<ArchiveLayout, 'ledger'>;
type GroupPageMap = Record<string, number>;
const EMPTY_SERIES_METADATA: ArchiveSeriesMetadataMap = {};

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

function getGroupPageKey(layout: GroupLayout, groupKey: string): string {
    return `${layout}:${groupKey}`;
}

function getArchiveScope(state: ArchiveState): string {
    return [
        state.layout,
        state.filters.category ?? '',
        state.filters.type ?? '',
        state.filters.query,
    ].join('\u0000');
}

function seedGroupPages(state: ArchiveState): GroupPageMap {
    if (state.layout === 'ledger' || !state.pagination.group) return {};
    return {
        [getGroupPageKey(state.layout, state.pagination.group)]: state.pagination.groupPage,
    };
}

function getRequestedGroupPage(
    layout: GroupLayout,
    groupKey: string,
    pagination: ArchivePaginationState,
    groupPages: GroupPageMap
): number {
    if (pagination.group === groupKey) return pagination.groupPage;
    return groupPages[getGroupPageKey(layout, groupKey)] ?? 1;
}

function paginateGroups(
    groups: ArchiveGroup[],
    page: number,
    perPage: number
): PaginationResult<ArchiveGroup> {
    return paginate(groups, page, perPage);
}

export default function PostArchiveView({
    posts,
    locale,
    seriesMetadata = EMPTY_SERIES_METADATA,
    initialFilters = INITIAL_ARCHIVE_FILTERS,
    initialLayout = DEFAULT_ARCHIVE_LAYOUT,
    initialPagination = INITIAL_ARCHIVE_PAGINATION,
}: {
    posts: PostArchiveItem[];
    locale: Locale;
    seriesMetadata?: ArchiveSeriesMetadataMap;
    initialFilters?: ArchiveFilters;
    initialLayout?: ArchiveLayout;
    initialPagination?: ArchivePaginationState;
}) {
    const [archiveState, setArchiveState] = useState<ArchiveState>(() => ({
        filters: initialFilters,
        layout: initialLayout,
        pagination: initialPagination,
    }));
    const [layoutDirection, setLayoutDirection] = useState(1);
    const layoutRef = useRef<ArchiveLayout>(initialLayout);
    const archiveScopeRef = useRef(getArchiveScope(archiveState));
    const [groupPages, setGroupPages] = useState<GroupPageMap>(() => seedGroupPages(archiveState));
    const [activePostId, setActivePostId] = useState('');
    const [paginationPortalHost, setPaginationPortalHost] = useState<HTMLElement | null>(null);
    const [isListVisible, setIsListVisible] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const applyArchiveState = useCallback(
        (nextState: ArchiveState, groupPageMode: 'merge' | 'replace' = 'merge') => {
            const previousLayout = layoutRef.current;
            if (nextState.layout !== previousLayout) {
                const direction =
                    Math.sign(
                        ARCHIVE_LAYOUTS.indexOf(nextState.layout) -
                            ARCHIVE_LAYOUTS.indexOf(previousLayout)
                    ) || 1;
                setLayoutDirection(direction);
                layoutRef.current = nextState.layout;
            }

            const nextScope = getArchiveScope(nextState);
            const scopeChanged = nextScope !== archiveScopeRef.current;
            setGroupPages((current) => {
                if (scopeChanged || groupPageMode === 'replace') {
                    return seedGroupPages(nextState);
                }
                if (nextState.layout === 'ledger' || !nextState.pagination.group) return current;
                return {
                    ...current,
                    [getGroupPageKey(nextState.layout, nextState.pagination.group)]:
                        nextState.pagination.groupPage,
                };
            });
            archiveScopeRef.current = nextScope;
            setArchiveState(nextState);
        },
        []
    );

    useEffect(() => {
        const syncHistory = () => applyArchiveState(readPostArchiveState(), 'replace');
        const syncStateEvent = () => applyArchiveState(readPostArchiveState());
        syncHistory();
        window.addEventListener('popstate', syncHistory);
        window.addEventListener(POST_ARCHIVE_STATE_EVENT, syncStateEvent);
        return () => {
            window.removeEventListener('popstate', syncHistory);
            window.removeEventListener(POST_ARCHIVE_STATE_EVENT, syncStateEvent);
        };
    }, [applyArchiveState]);

    useEffect(() => {
        const syncVisibility = () => {
            setIsListVisible(new URLSearchParams(window.location.search).get('view') === 'list');
        };

        setPaginationPortalHost(document.getElementById('post-archive-pagination-host'));
        syncVisibility();
        window.addEventListener('popstate', syncVisibility);
        window.addEventListener('post-view-change', syncVisibility);
        return () => {
            window.removeEventListener('popstate', syncVisibility);
            window.removeEventListener('post-view-change', syncVisibility);
        };
    }, []);

    const { filters, layout, pagination } = archiveState;
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
        () => groupArchivePostsBySeries(filtered, standalone, seriesMetadata),
        [filtered, seriesMetadata, standalone]
    );

    const activeGroups = useMemo(
        () => (layout === 'series' ? seriesGroups : layout === 'years' ? yearGroups : []),
        [layout, seriesGroups, yearGroups]
    );
    const activeGroupPageSize =
        layout === 'series' ? ARCHIVE_PAGE_SIZES.series : ARCHIVE_PAGE_SIZES.years;
    const requestedOuterPage = useMemo(() => {
        if (layout === 'ledger' || !pagination.group) return pagination.page;
        const groupIndex = activeGroups.findIndex((group) => group.key === pagination.group);
        return groupIndex >= 0 ? Math.floor(groupIndex / activeGroupPageSize) + 1 : pagination.page;
    }, [activeGroupPageSize, activeGroups, layout, pagination.group, pagination.page]);

    const ledgerPage = useMemo(
        () => paginate(filtered, requestedOuterPage, ARCHIVE_PAGE_SIZES.ledger),
        [filtered, requestedOuterPage]
    );
    const seriesPage = useMemo(
        () => paginateGroups(seriesGroups, requestedOuterPage, ARCHIVE_PAGE_SIZES.series),
        [requestedOuterPage, seriesGroups]
    );
    const yearsPage = useMemo(
        () => paginateGroups(yearGroups, requestedOuterPage, ARCHIVE_PAGE_SIZES.years),
        [requestedOuterPage, yearGroups]
    );

    const ledgerGroups = useMemo(
        () => groupArchivePostsByYear(ledgerPage.items),
        [ledgerPage.items]
    );
    const visibleSeriesGroups = useMemo<ArchiveGroupPage[]>(
        () =>
            seriesPage.items.map((group) =>
                paginateArchiveGroup(
                    group,
                    getRequestedGroupPage('series', group.key, pagination, groupPages),
                    ARCHIVE_GROUP_PAGE_SIZES.series
                )
            ),
        [groupPages, pagination, seriesPage.items]
    );
    const visibleYearGroups = useMemo<ArchiveGroupPage[]>(
        () =>
            yearsPage.items.map((group) =>
                paginateArchiveGroup(
                    group,
                    getRequestedGroupPage('years', group.key, pagination, groupPages),
                    ARCHIVE_GROUP_PAGE_SIZES.years
                )
            ),
        [groupPages, pagination, yearsPage.items]
    );
    const selectedSeriesGroup = useMemo(
        () =>
            visibleSeriesGroups.find((group) => group.key === pagination.group) ??
            visibleSeriesGroups[0] ??
            null,
        [pagination.group, visibleSeriesGroups]
    );

    const currentPage =
        layout === 'ledger'
            ? ledgerPage.page
            : layout === 'series'
              ? seriesPage.page
              : yearsPage.page;
    const totalPages =
        layout === 'ledger'
            ? ledgerPage.totalPages
            : layout === 'series'
              ? seriesPage.totalPages
              : yearsPage.totalPages;

    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent(POST_ARCHIVE_RENDER_EVENT, {
                detail: {
                    layout,
                    page: currentPage,
                    group: pagination.group,
                    groupPage: pagination.groupPage,
                },
            })
        );
    }, [currentPage, layout, pagination.group, pagination.groupPage]);

    const visiblePosts = useMemo(() => {
        if (layout === 'ledger') return ledgerPage.items;
        if (layout === 'series') return selectedSeriesGroup?.visiblePosts ?? [];
        return visibleYearGroups.flatMap((group) => group.visiblePosts);
    }, [layout, ledgerPage.items, selectedSeriesGroup, visibleYearGroups]);

    const activePost =
        visiblePosts.find((post) => post.id === activePostId) ?? visiblePosts[0] ?? null;
    const activeGroupPage = useMemo(() => {
        if (layout === 'ledger' || !activePost) return null;
        if (layout === 'series') return selectedSeriesGroup;
        return (
            visibleYearGroups.find((group) =>
                group.visiblePosts.some((post) => post.id === activePost.id)
            ) ?? null
        );
    }, [activePost, layout, selectedSeriesGroup, visibleYearGroups]);

    useEffect(() => {
        if (activePostId && visiblePosts.some((post) => post.id === activePostId)) return;
        setActivePostId(visiblePosts[0]?.id ?? '');
    }, [activePostId, visiblePosts]);

    const currentGroupPage = useMemo(() => {
        if (layout === 'ledger' || !pagination.group) return null;
        const groups = layout === 'series' ? visibleSeriesGroups : visibleYearGroups;
        return groups.find((group) => group.key === pagination.group) ?? null;
    }, [layout, pagination.group, visibleSeriesGroups, visibleYearGroups]);

    useEffect(() => {
        const groupExists =
            layout !== 'ledger' &&
            Boolean(pagination.group) &&
            activeGroups.some((group) => group.key === pagination.group);
        const preservedGroup =
            groupExists && currentGroupPage && (layout === 'series' || currentGroupPage.page > 1)
                ? currentGroupPage
                : null;
        const normalizedPagination: ArchivePaginationState = {
            page: currentPage,
            group: preservedGroup?.key ?? null,
            groupPage: preservedGroup?.page ?? 1,
        };

        if (
            pagination.page === normalizedPagination.page &&
            pagination.group === normalizedPagination.group &&
            pagination.groupPage === normalizedPagination.groupPage
        ) {
            return;
        }

        const nextState = { ...archiveState, pagination: normalizedPagination };
        applyArchiveState(nextState);
        writePostArchiveState(nextState, 'replace');
    }, [
        activeGroups,
        applyArchiveState,
        archiveState,
        currentGroupPage,
        currentPage,
        layout,
        pagination.group,
        pagination.groupPage,
        pagination.page,
    ]);

    const changeOuterPage = useCallback(
        (requestedPage: number) => {
            const page = Math.min(Math.max(requestedPage, 1), totalPages);
            if (page === currentPage) return;
            const nextState: ArchiveState = {
                ...archiveState,
                pagination: { page, group: null, groupPage: 1 },
            };
            applyArchiveState(nextState);
            writePostArchiveState(nextState, 'push');
            window.requestAnimationFrame(() => {
                rootRef.current
                    ?.querySelectorAll<HTMLElement>('[data-archive-scroll-root]')
                    .forEach((element) => element.scrollTo({ top: 0, behavior: 'auto' }));
            });
        },
        [applyArchiveState, archiveState, currentPage, totalPages]
    );

    const changeGroupPage = useCallback(
        (groupKey: string, requestedPage: number) => {
            if (layout === 'ledger') return;
            const groups = layout === 'series' ? seriesGroups : yearGroups;
            const group = groups.find((candidate) => candidate.key === groupKey);
            if (!group) return;
            const perPage = ARCHIVE_GROUP_PAGE_SIZES[layout];
            const nextGroupPage = paginateArchiveGroup(group, requestedPage, perPage);
            const mapKey = getGroupPageKey(layout, groupKey);

            setGroupPages((current) => ({ ...current, [mapKey]: nextGroupPage.page }));
            const nextState: ArchiveState = {
                ...archiveState,
                pagination: {
                    page: currentPage,
                    group: layout === 'series' || nextGroupPage.page > 1 ? groupKey : null,
                    groupPage: nextGroupPage.page,
                },
            };
            applyArchiveState(nextState);
            writePostArchiveState(nextState, 'push');

            const activeBelongsToGroup = group.posts.some((post) => post.id === activePost?.id);
            const activeRemainsVisible = nextGroupPage.visiblePosts.some(
                (post) => post.id === activePost?.id
            );
            if (activeBelongsToGroup && !activeRemainsVisible) {
                setActivePostId(nextGroupPage.visiblePosts[0]?.id ?? '');
            }

            window.requestAnimationFrame(() => {
                rootRef.current
                    ?.querySelector<HTMLElement>(
                        `[data-archive-group-list="${CSS.escape(groupKey)}"]`
                    )
                    ?.scrollTo({ top: 0, behavior: 'auto' });
            });
        },
        [
            activePost?.id,
            applyArchiveState,
            archiveState,
            currentPage,
            layout,
            seriesGroups,
            yearGroups,
        ]
    );

    const selectSeriesGroup = useCallback(
        (groupKey: string) => {
            if (layout !== 'series') return;
            const group = seriesGroups.find((candidate) => candidate.key === groupKey);
            if (!group) return;

            const nextGroupPage = paginateArchiveGroup(group, 1, ARCHIVE_GROUP_PAGE_SIZES.series);
            setActivePostId(nextGroupPage.visiblePosts[0]?.id ?? '');
            if (pagination.group === groupKey && pagination.groupPage === 1) return;

            setGroupPages((current) => ({
                ...current,
                [getGroupPageKey('series', groupKey)]: 1,
            }));
            const nextState: ArchiveState = {
                ...archiveState,
                pagination: {
                    page: currentPage,
                    group: groupKey,
                    groupPage: 1,
                },
            };
            applyArchiveState(nextState);
            writePostArchiveState(nextState, 'push');
        },
        [
            applyArchiveState,
            archiveState,
            currentPage,
            layout,
            pagination.group,
            pagination.groupPage,
            seriesGroups,
        ]
    );

    const t = (key: PostViewKey) => getUIText('postView', key, locale);
    const countLabel = (count: number) => t('articleCount').replace('{count}', String(count));

    return (
        <MotionConfig reducedMotion="user">
            {paginationPortalHost &&
                isListVisible &&
                createPortal(
                    <ArchivePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        previousLabel={t('prevPage')}
                        nextLabel={t('nextPage')}
                        onPrevious={() => changeOuterPage(currentPage - 1)}
                        onNext={() => changeOuterPage(currentPage + 1)}
                    />,
                    paginationPortalHost
                )}

            <div
                ref={rootRef}
                data-post-list-root
                data-view-motion-content
                data-archive-layout={layout}
                data-archive-page={currentPage}
                className="post-view-main-viewport flex w-full max-w-full flex-col overflow-hidden"
            >
                <div className="flex min-h-0 min-w-0 flex-1 items-center overflow-x-hidden px-2 sm:px-4 md:px-6">
                    <div className="mx-auto flex h-[var(--post-view-content-height)] min-h-0 w-full max-w-[var(--site-wide-content)] min-w-0 flex-col overflow-x-hidden">
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
                                        <p className="text-muted-foreground flex h-full items-center justify-center rounded-2xl border border-[var(--page-surface-border)] bg-[var(--page-surface-bg)] px-5 text-center text-sm shadow-[0_12px_34px_var(--page-surface-shadow)]">
                                            {t('empty')}
                                        </p>
                                    ) : layout === 'ledger' ? (
                                        <LedgerView
                                            groups={ledgerGroups}
                                            activePost={activePost}
                                            onActivate={setActivePostId}
                                            countLabel={countLabel}
                                            totalCount={filtered.length}
                                            locale={locale}
                                        />
                                    ) : (
                                        <ArchiveRail
                                            activePost={activePost}
                                            locale={locale}
                                            desktopPreviewOnly={layout === 'series'}
                                            {...(activeGroupPage
                                                ? {
                                                      activeGroupKey: activeGroupPage.key,
                                                      activeGroupPage: activeGroupPage.page,
                                                  }
                                                : {})}
                                        >
                                            {layout === 'series' ? (
                                                <SeriesLibrary
                                                    groups={visibleSeriesGroups}
                                                    selectedGroupKey={pagination.group}
                                                    activePost={activePost}
                                                    onActivate={setActivePostId}
                                                    onSelectGroup={selectSeriesGroup}
                                                    countLabel={countLabel}
                                                    previousLabel={t('prevPage')}
                                                    nextLabel={t('nextPage')}
                                                    onGroupPage={changeGroupPage}
                                                    locale={locale}
                                                />
                                            ) : (
                                                <YearColumns
                                                    groups={visibleYearGroups}
                                                    activePost={activePost}
                                                    onActivate={setActivePostId}
                                                    countLabel={countLabel}
                                                    previousLabel={t('prevPage')}
                                                    nextLabel={t('nextPage')}
                                                    onGroupPage={changeGroupPage}
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
