import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSetAtom, useAtomValue } from 'jotai';
import { cn } from '@components/common/lib/utils';
import { useHorizontalScroll } from '@components/common/lib/useHorizontalScroll';
import { postViewAtom, postViewScrollAtom, scrollToPostAtom } from '@stores/postViewAtom';
import PostViewPagination from './PostViewPagination';
import PostViewOverview from './PostViewOverview';

interface PostViewScrollContainerProps {
    children: React.ReactNode;
    /** 各文章的发布日期数组 */
    postDates?: string[];
    className?: string;
}

const LAYOUT_CONFIG = {
    gap: 60,
    fallbackCardWidth: 300,
};

const POST_VIEW_SCROLL_KEY = 'solitude:post-view-scroll-left';

interface ScrollMetrics {
    totalPosts: number;
    itemWidth: number;
    itemGap: number;
    stride: number;
    paddingLeft: number;
    clientWidth: number;
}

function areNumberArraysEqual(a: number[], b: number[]) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
}

function clampIndex(index: number, total: number) {
    return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}

export default function PostViewScrollContainer({
    children,
    postDates = [],
    className,
}: PostViewScrollContainerProps) {
    const setPostViewState = useSetAtom(postViewAtom);
    const setPostViewScroll = useSetAtom(postViewScrollAtom);
    const scrollToPostRequest = useAtomValue(scrollToPostAtom);
    const setScrollToPostRequest = useSetAtom(scrollToPostAtom);
    const postCountHint = postDates.length || React.Children.count(children);
    const scrollMetricsRef = React.useRef<ScrollMetrics | null>(null);
    const scrollIdleTimerRef = React.useRef<number | null>(null);

    const getScrollMetrics = useCallback(
        (container: HTMLDivElement): ScrollMetrics => {
            const cachedMetrics = scrollMetricsRef.current;
            const totalPosts =
                container.querySelectorAll<HTMLElement>('.post-card-wrapper').length ||
                postCountHint;

            if (
                cachedMetrics &&
                cachedMetrics.totalPosts === totalPosts &&
                cachedMetrics.clientWidth === container.clientWidth
            ) {
                return cachedMetrics;
            }

            const card = container.querySelector<HTMLElement>('.post-card-wrapper');
            const containerStyles = window.getComputedStyle(container);
            const itemWidth =
                card?.getBoundingClientRect().width || LAYOUT_CONFIG.fallbackCardWidth;
            const itemGap = Number.parseFloat(containerStyles.columnGap) || LAYOUT_CONFIG.gap;
            const paddingLeft = Number.parseFloat(containerStyles.paddingLeft) || 0;

            const nextMetrics = {
                totalPosts,
                itemWidth,
                itemGap,
                stride: itemWidth + itemGap,
                paddingLeft,
                clientWidth: container.clientWidth,
            };

            scrollMetricsRef.current = nextMetrics;
            return nextMetrics;
        },
        [postCountHint]
    );

    const updateVisiblePosts = useCallback(
        (container: HTMLDivElement) => {
            const metrics = getScrollMetrics(container);
            const visibleIndices: number[] = [];
            const scrollLeft = container.scrollLeft;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;
            const viewportLeft = scrollLeft;
            const viewportRight = viewportLeft + clientWidth;
            const viewportCenter = viewportLeft + clientWidth / 2;
            const firstCardCenter = metrics.paddingLeft + metrics.itemWidth / 2;
            const closestIndex =
                metrics.totalPosts > 0
                    ? clampIndex(
                          Math.round((viewportCenter - firstCardCenter) / metrics.stride),
                          metrics.totalPosts
                      )
                    : 0;

            for (let index = 0; index < metrics.totalPosts; index += 1) {
                const cardLeft = metrics.paddingLeft + index * metrics.stride;
                const cardRight = cardLeft + metrics.itemWidth;
                const visibleLeft = Math.max(cardLeft, viewportLeft);
                const visibleRight = Math.min(cardRight, viewportRight);
                const visibleWidth = Math.max(0, visibleRight - visibleLeft);
                const visibilityRatio = visibleWidth / metrics.itemWidth;

                if (visibilityRatio > 0.3) visibleIndices.push(index);
            }

            setPostViewState((prev) => {
                const nextPostDates = postDates.length > 0 ? postDates : prev.postDates;
                const nextActiveIndex = metrics.totalPosts > 0 ? closestIndex : 0;

                if (
                    prev.totalPosts === metrics.totalPosts &&
                    prev.activeIndex === nextActiveIndex &&
                    prev.postDates === nextPostDates &&
                    areNumberArraysEqual(prev.visibleIndices, visibleIndices)
                ) {
                    return prev;
                }

                return {
                    ...prev,
                    totalPosts: metrics.totalPosts,
                    visibleIndices,
                    activeIndex: nextActiveIndex,
                    postDates: nextPostDates,
                };
            });

            // 滚动度量单独写入(供 minimap),仅在数值变化时更新以减少重渲染
            setPostViewScroll((prev) => {
                if (
                    prev.scrollLeft === scrollLeft &&
                    prev.scrollWidth === scrollWidth &&
                    prev.clientWidth === clientWidth
                ) {
                    return prev;
                }
                return { scrollLeft, scrollWidth, clientWidth };
            });
        },
        [getScrollMetrics, postDates, setPostViewState, setPostViewScroll]
    );

    const markContainerScrolling = useCallback((container: HTMLDivElement) => {
        container.dataset.postViewScrolling = 'true';

        if (scrollIdleTimerRef.current !== null) {
            window.clearTimeout(scrollIdleTimerRef.current);
        }

        scrollIdleTimerRef.current = window.setTimeout(() => {
            delete container.dataset.postViewScrolling;
            scrollIdleTimerRef.current = null;
        }, 160);
    }, []);

    const handleScrollUpdate = useCallback(
        (container: HTMLDivElement) => {
            markContainerScrolling(container);
            updateVisiblePosts(container);
        },
        [markContainerScrolling, updateVisiblePosts]
    );

    const {
        containerRef,
        canScrollLeft,
        canScrollRight,
        isHovering,
        setIsHovering,
        prefersReducedMotion,
        handleWheel,
        scrollByPage,
        scrollToIndex,
    } = useHorizontalScroll<HTMLDivElement>({
        itemSelector: '.post-card-wrapper',
        itemGap: LAYOUT_CONFIG.gap,
        fallbackItemWidth: LAYOUT_CONFIG.fallbackCardWidth,
        requireHover: false,
        observeMutations: true,
        onScrollUpdate: handleScrollUpdate,
        // 追踪内容而非仅长度:postDates 引用变更(即便长度不变)也应重建观察器
        dependencyKey: `${postCountHint}:${postDates.join('|')}`,
    });

    const fadeMotion = prefersReducedMotion
        ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

    const leftButtonMotion = prefersReducedMotion
        ? { initial: false as const, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 0 } }
        : {
              initial: { opacity: 0, x: 10 },
              animate: { opacity: 1, x: 0 },
              exit: { opacity: 0, x: 10 },
          };

    const rightButtonMotion = prefersReducedMotion
        ? { initial: false as const, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 0 } }
        : {
              initial: { opacity: 0, x: -10 },
              animate: { opacity: 1, x: 0 },
              exit: { opacity: 0, x: -10 },
          };

    const transition = { duration: prefersReducedMotion ? 0 : 0.2 };

    useEffect(() => {
        if (postDates.length > 0) {
            setPostViewState((prev) => ({
                ...prev,
                postDates,
            }));
        }
    }, [postDates, setPostViewState]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let snapRestoreFrame: number | null = null;
        let behaviorRestoreFrame: number | null = null;

        try {
            const storedScrollValue = sessionStorage.getItem(POST_VIEW_SCROLL_KEY);
            const storedScrollLeft = Number(storedScrollValue);
            if (storedScrollValue === null || !Number.isFinite(storedScrollLeft)) return;

            const previousScrollBehavior = container.style.scrollBehavior;
            const previousScrollSnapType = container.style.scrollSnapType;

            container.dataset.postViewRestoring = 'true';
            container.style.scrollBehavior = 'auto';
            container.style.scrollSnapType = 'none';
            container.scrollLeft = Math.max(storedScrollLeft, 0);
            void container.offsetWidth;
            sessionStorage.removeItem(POST_VIEW_SCROLL_KEY);

            snapRestoreFrame = window.requestAnimationFrame(() => {
                if (previousScrollSnapType) {
                    container.style.scrollSnapType = previousScrollSnapType;
                } else {
                    container.style.removeProperty('scroll-snap-type');
                }

                behaviorRestoreFrame = window.requestAnimationFrame(() => {
                    if (previousScrollBehavior) {
                        container.style.scrollBehavior = previousScrollBehavior;
                    } else {
                        container.style.removeProperty('scroll-behavior');
                    }
                    delete container.dataset.postViewRestoring;
                });
            });
        } catch {
            // Keep the initial list position when session storage is unavailable.
        }

        return () => {
            if (snapRestoreFrame !== null) window.cancelAnimationFrame(snapRestoreFrame);
            if (behaviorRestoreFrame !== null) window.cancelAnimationFrame(behaviorRestoreFrame);
        };
    }, [containerRef]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.dataset.postViewHydrated = 'true';

        return () => {
            if (scrollIdleTimerRef.current !== null) {
                window.clearTimeout(scrollIdleTimerRef.current);
                scrollIdleTimerRef.current = null;
            }

            delete container.dataset.postViewHydrated;
            delete container.dataset.postViewScrolling;
        };
    }, [containerRef]);

    const scrollToPost = useCallback(
        (index: number) => {
            scrollToIndex(index);
        },
        [scrollToIndex]
    );

    useEffect(() => {
        if (scrollToPostRequest !== null) {
            scrollToPost(scrollToPostRequest);
            setScrollToPostRequest(null);
        }
    }, [scrollToPostRequest, scrollToPost, setScrollToPostRequest]);

    return (
        <div
            className={cn('post-view-scroll-wrapper relative flex w-full flex-col', className)}
            onPointerEnter={() => setIsHovering(true)}
            onPointerLeave={() => setIsHovering(false)}
        >
            <div data-view-motion-content className="post-view-main-viewport relative">
                <AnimatePresence>
                    {canScrollLeft && (
                        <motion.div
                            {...fadeMotion}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                            className={cn(
                                'pointer-events-none absolute top-0 left-0 z-10',
                                'h-full w-20 sm:w-24 lg:w-28'
                            )}
                            style={{
                                background:
                                    'linear-gradient(to right, var(--post-view-scroll-mask-start) 0%, var(--post-view-scroll-mask-end) 100%)',
                                maskImage:
                                    'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
                                WebkitMaskImage:
                                    'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
                            }}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {canScrollRight && (
                        <motion.div
                            {...fadeMotion}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                            className={cn(
                                'pointer-events-none absolute top-0 right-0 z-10',
                                'h-full w-20 sm:w-24 lg:w-28'
                            )}
                            style={{
                                background:
                                    'linear-gradient(to left, var(--post-view-scroll-mask-start) 0%, var(--post-view-scroll-mask-end) 100%)',
                                maskImage:
                                    'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
                                WebkitMaskImage:
                                    'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
                            }}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {canScrollLeft && isHovering && (
                        <motion.button
                            {...leftButtonMotion}
                            transition={transition}
                            onClick={() => scrollByPage('left')}
                            className={cn(
                                'absolute top-1/2 left-4 z-20 -translate-y-1/2',
                                'flex h-12 w-12 items-center justify-center',
                                'bg-background/80 rounded-full backdrop-blur-sm',
                                'border-border border shadow-lg',
                                'hover:bg-background transition-all duration-200 hover:scale-110',
                                'focus-visible:ring-ring focus:outline-none focus-visible:ring-2'
                            )}
                            aria-label="向左滚动"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </motion.button>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {canScrollRight && isHovering && (
                        <motion.button
                            {...rightButtonMotion}
                            transition={transition}
                            onClick={() => scrollByPage('right')}
                            className={cn(
                                'absolute top-1/2 right-4 z-20 -translate-y-1/2',
                                'flex h-12 w-12 items-center justify-center',
                                'bg-background/80 rounded-full backdrop-blur-sm',
                                'border-border border shadow-lg',
                                'hover:bg-background transition-all duration-200 hover:scale-110',
                                'focus-visible:ring-ring focus:outline-none focus-visible:ring-2'
                            )}
                            aria-label="向右滚动"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </motion.button>
                    )}
                </AnimatePresence>

                <div
                    ref={containerRef}
                    data-post-view-scroll
                    onWheel={handleWheel}
                    className={cn(
                        'post-view-scroll-container',
                        'flex h-full items-center gap-[60px] overflow-x-auto scroll-smooth',
                        'scrollbar-none py-4',
                        '[&::-webkit-scrollbar]:hidden',
                        '[-ms-overflow-style:none]',
                        '[scrollbar-width:none]',
                        'touch-pan-x snap-x snap-mandatory',
                        '[&_.post-card-wrapper]:snap-center'
                    )}
                    style={{
                        paddingLeft: 'clamp(1rem, 5vw, 60px)',
                        paddingRight: 'clamp(1rem, 5vw, 60px)',
                    }}
                    role="list"
                    aria-label="文章列表"
                >
                    {children}
                </div>
            </div>

            {/* 底边总览进度条:全宽钉在视窗最底边(氛围光晕 × 进度填充),与角落时间线分离。
                边缘依托 + 全宽,避免中段悬空的突兀感。 */}
            <PostViewOverview
                className={cn(
                    'pointer-events-none hidden lg:block',
                    'lg:fixed lg:right-0 lg:bottom-0 lg:left-0 lg:z-[55]'
                )}
            />

            <PostViewPagination
                onScrollToPost={scrollToPost}
                className={cn(
                    'lg:fixed lg:bottom-0 lg:left-0 lg:z-[60]',
                    'lg:min-h-[10vh] lg:w-1/3 lg:items-center lg:pt-0 lg:pb-4',
                    '3xl:px-16 lg:px-8 xl:px-10 2xl:px-12'
                )}
            />
        </div>
    );
}
