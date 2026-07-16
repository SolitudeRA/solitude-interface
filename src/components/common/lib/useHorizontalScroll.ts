import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotionPreference } from './useReducedMotionPreference';

interface UseHorizontalScrollOptions<T extends HTMLElement = HTMLElement> {
    itemSelector: string;
    itemGap: number;
    fallbackItemWidth: number;
    requireHover?: boolean;
    pageScrollRatio?: number;
    observeMutations?: boolean;
    onScrollUpdate?: (container: T) => void;
    dependencyKey?: unknown;
}

/**
 * 纯计算:把目标元素在容器中水平居中所需的 scrollLeft,并夹紧到 [0, maxScroll]。
 * 与 DOM 读取分离(scrollToIndex 负责读 rect,这里只做数学)。
 */
function centerTargetScrollLeft(metrics: {
    /** 目标左缘相对内容起点的偏移(已含当前 scrollLeft) */
    targetLeftInContent: number;
    targetWidth: number;
    clientWidth: number;
    scrollWidth: number;
}): number {
    const centered = metrics.targetLeftInContent - (metrics.clientWidth - metrics.targetWidth) / 2;
    const maxScrollLeft = Math.max(metrics.scrollWidth - metrics.clientWidth, 0);
    return Math.min(Math.max(centered, 0), maxScrollLeft);
}

export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>({
    itemSelector,
    itemGap,
    fallbackItemWidth,
    requireHover = true,
    pageScrollRatio = 0.8,
    observeMutations = false,
    onScrollUpdate,
    dependencyKey,
}: UseHorizontalScrollOptions<T>) {
    const containerRef = useRef<T>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const prefersReducedMotion = useReducedMotionPreference();

    const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    const updateScrollState = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        setCanScrollLeft(scrollLeft > 1);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }, []);

    const getScrollDistance = useCallback(() => {
        const container = containerRef.current;
        if (!container) return fallbackItemWidth + itemGap;

        const item = container.querySelector(itemSelector);
        const itemWidth = item?.getBoundingClientRect().width || fallbackItemWidth;
        return itemWidth + itemGap;
    }, [fallbackItemWidth, itemGap, itemSelector]);

    const handleWheel = useCallback(
        (event: React.WheelEvent<T>) => {
            const container = containerRef.current;
            if (!container || (requireHover && !isHovering)) return;

            const dominantDelta =
                Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (dominantDelta === 0) return;

            const isHorizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY);
            if (isHorizontalGesture) return;

            const { scrollWidth, clientWidth, scrollLeft } = container;
            const canScroll = scrollWidth > clientWidth;
            const atStart = scrollLeft <= 0 && dominantDelta < 0;
            const atEnd = scrollLeft >= scrollWidth - clientWidth && dominantDelta > 0;

            if (!canScroll || atStart || atEnd) return;

            event.preventDefault();
            event.stopPropagation();

            const direction = dominantDelta > 0 ? 1 : -1;
            container.scrollBy({
                left: direction * getScrollDistance(),
                behavior: scrollBehavior,
            });
        },
        [getScrollDistance, isHovering, requireHover, scrollBehavior]
    );

    const scrollByPage = useCallback(
        (direction: 'left' | 'right') => {
            const container = containerRef.current;
            if (!container) return;

            container.scrollBy({
                left:
                    direction === 'left'
                        ? -container.clientWidth * pageScrollRatio
                        : container.clientWidth * pageScrollRatio,
                behavior: scrollBehavior,
            });
        },
        [pageScrollRatio, scrollBehavior]
    );

    const scrollToIndex = useCallback(
        (index: number) => {
            const container = containerRef.current;
            if (!container) return;

            const target = container.querySelectorAll<HTMLElement>(itemSelector)[index];
            if (!target) return;

            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const left = centerTargetScrollLeft({
                targetLeftInContent: targetRect.left - containerRect.left + container.scrollLeft,
                targetWidth: targetRect.width,
                clientWidth: container.clientWidth,
                scrollWidth: container.scrollWidth,
            });

            container.scrollTo({
                left,
                behavior: scrollBehavior,
            });
        },
        [itemSelector, scrollBehavior]
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let rafId: number | null = null;
        let isScheduled = false;

        const update = () => {
            if (isScheduled) return;
            isScheduled = true;

            rafId = requestAnimationFrame(() => {
                updateScrollState();
                onScrollUpdate?.(container);
                isScheduled = false;
            });
        };

        updateScrollState();
        onScrollUpdate?.(container);

        container.addEventListener('scroll', update, { passive: true });

        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(container);

        const mutationObserver = observeMutations ? new MutationObserver(update) : null;
        mutationObserver?.observe(container, { childList: true, subtree: true });

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            container.removeEventListener('scroll', update);
            resizeObserver.disconnect();
            mutationObserver?.disconnect();
        };
    }, [dependencyKey, observeMutations, onScrollUpdate, updateScrollState]);

    return {
        containerRef,
        canScrollLeft,
        canScrollRight,
        isHovering,
        setIsHovering,
        prefersReducedMotion,
        handleWheel,
        scrollByPage,
        scrollToIndex,
        updateScrollState,
    };
}
