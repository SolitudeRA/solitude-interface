import { ArrowRight } from 'lucide-react';
import type { FeaturedPost } from '@api/ghost/types';
import { cn } from '@components/common/lib/utils';
import { getUIText, type Locale } from '@lib/i18n';

/**
 * 首页推荐轮播的「卡片表现层」:ShowcaseCard(文章)/ ViewMoreCard(查看更多)/ SkeletonCard(占位)
 * 及其样式常量与标签 helper。与 PostsShowcaseCarousel(滚动/布局/状态)分离,便于各自维护。
 */

function isVisibleTag(value: string | null | undefined): value is string {
    return Boolean(value && value.trim() && value.trim().toLowerCase() !== 'default');
}

function titleCaseTag(value: string): string {
    return value
        .trim()
        .replace(/[-_]+/g, ' ')
        .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function getHomeTitleDensity(title: string): 'normal' | 'long' {
    return Array.from(title.trim()).length > 34 ? 'long' : 'normal';
}

function getPublishedDate(value: string | null | undefined): string {
    return value?.split('T')[0] ?? '';
}

function getTagPillClass(tone: 'type' | 'category'): string {
    const base =
        'inline-flex min-h-6 max-w-[min(9rem,44%)] items-center overflow-hidden rounded-full border px-2.5 py-1 text-[0.65rem] font-extrabold leading-none text-white/90 shadow-sm backdrop-blur-md [text-shadow:0_1px_8px_rgba(3,7,18,0.5)]';

    const tones = {
        type: 'border-cyan-200/50 bg-cyan-300/15',
        category: 'border-lime-200/45 bg-lime-300/15',
    };

    return cn(base, tones[tone]);
}

const CARD_VISUAL_TRANSITION_CLASS =
    'transition-[opacity,transform,border-color,box-shadow] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';

const CARD_MEDIA_TRANSITION_CLASS =
    'scale-[1.02] transition-transform duration-[620ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.045]';

const CARD_GLOW_TRANSITION_CLASS =
    'scale-[0.985] transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-100 group-hover:opacity-100';

interface ShowcaseCardProps {
    post: FeaturedPost;
    index: number;
    isOtherHovered: boolean;
    onHover: (index: number | null) => void;
}

// 单个文章卡片
export function ShowcaseCard({ post, index, isOtherHovered, onHover }: ShowcaseCardProps) {
    const hasImage = post.feature_image && post.feature_image.toString().length > 0;
    const titleDensity = getHomeTitleDensity(post.title);
    const publishedDate = getPublishedDate(post.published_at);
    const typeLabel = isVisibleTag(post.post_type_label)
        ? post.post_type_label
        : isVisibleTag(post.post_type)
          ? titleCaseTag(post.post_type)
          : '';
    const categoryLabel = isVisibleTag(post.post_category_label)
        ? post.post_category_label
        : isVisibleTag(post.post_category)
          ? titleCaseTag(post.post_category)
          : '';

    return (
        <a
            href={post.url?.toString() || '#'}
            data-media-card="home"
            data-title-density={titleDensity}
            className={cn(
                // layout / stacking
                'showcase-card group relative isolate flex-shrink-0 overflow-hidden rounded-[1.45rem] sm:rounded-[1.65rem]',
                '3xl:w-[26rem] aspect-[4/3] w-[15rem] cursor-pointer sm:w-[17rem] md:w-[19rem] lg:w-[21rem] 2xl:w-[23rem]',

                // media-card material
                'border border-[var(--home-showcase-card-border)]',
                'bg-[var(--home-showcase-card-bg)]',
                'ring-1 ring-[var(--home-showcase-card-ring)] ring-inset',
                'shadow-[0_18px_34px_var(--home-showcase-card-shadow)]',

                // motion / interaction
                CARD_VISUAL_TRANSITION_CLASS,
                isOtherHovered ? 'opacity-[0.84]' : 'opacity-100',
                'hover:-translate-y-0.5 hover:scale-[1.016] hover:opacity-100',
                'focus-visible:-translate-y-0.5 focus-visible:scale-[1.016] focus-visible:opacity-100',
                'motion-reduce:transform-none',
                'hover:border-[var(--home-showcase-card-border-hover)] hover:shadow-[0_24px_44px_var(--home-showcase-card-shadow-hover)]',

                // accessibility
                'focus-visible:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
            )}
            onPointerEnter={() => onHover(index)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(index)}
            onBlur={() => onHover(null)}
            aria-label={`阅读文章: ${post.title}`}
        >
            {/* 背景层 */}
            <div data-media-card-media className="absolute inset-0 -z-30 overflow-hidden">
                {hasImage ? (
                    <img
                        src={post.feature_image?.toString() ?? ''}
                        alt=""
                        loading={index < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        className={cn(
                            'h-full w-full object-cover object-center',
                            CARD_MEDIA_TRANSITION_CLASS,
                            'motion-reduce:transform-none motion-reduce:transition-none'
                        )}
                    />
                ) : (
                    <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,var(--card-image-fallback-highlight),transparent_32%),linear-gradient(135deg,var(--card-image-fallback-start),var(--card-image-fallback-end))]" />
                )}
            </div>

            {/* 图片遮罩：对齐 posts 卡片的全尺寸 media 语言 */}
            <div
                className="pointer-events-none absolute inset-0 -z-20"
                style={{
                    background: 'var(--home-showcase-media-overlay)',
                }}
            />

            <div
                data-media-card-glow
                className={cn(
                    'pointer-events-none absolute inset-0 -z-10 opacity-0',
                    CARD_GLOW_TRANSITION_CLASS
                )}
            >
                <div className="absolute inset-0 bg-[var(--home-showcase-glow)]" />
                <div className="absolute inset-0 ring-1 ring-[var(--home-showcase-card-ring)] ring-inset" />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[66%] bg-[var(--home-showcase-title-gradient)]" />

            {/* 标签只保留文章类型和分类 */}
            <div
                className="pointer-events-none absolute top-3 right-3 left-3 z-20 flex items-start justify-between gap-3 sm:top-4 sm:right-4 sm:left-4"
                aria-label="Post type and category"
            >
                {typeLabel ? (
                    <span className={getTagPillClass('type')}>{typeLabel}</span>
                ) : (
                    <span />
                )}
                {categoryLabel && (
                    <span className={getTagPillClass('category')}>{categoryLabel}</span>
                )}
            </div>

            {/* 标题落在底部渐变上，不再使用黑色药丸背景 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pt-16 pb-3 sm:px-4 sm:pt-20 sm:pb-4">
                <h3
                    className={cn(
                        'm-0 overflow-hidden font-extrabold text-white',
                        'leading-tight [text-shadow:0_2px_12px_rgba(3,7,18,0.82)]',
                        titleDensity === 'long'
                            ? 'line-clamp-2 text-[0.92rem] sm:line-clamp-3 sm:text-[1rem]'
                            : 'line-clamp-2 text-[1.03rem] sm:text-[1.1rem]'
                    )}
                >
                    {post.title}
                </h3>
                {publishedDate && (
                    <time
                        className="mt-2 block text-[0.68rem] leading-none font-bold text-white/70 [text-shadow:0_1px_8px_rgba(3,7,18,0.72)]"
                        dateTime={publishedDate}
                    >
                        {publishedDate}
                    </time>
                )}
            </div>
        </a>
    );
}

// Skeleton 占位卡片
export function SkeletonCard({ index }: { index: number }) {
    return (
        <div
            className={cn(
                'flex-shrink-0 overflow-hidden rounded-[1.45rem] sm:rounded-[1.65rem]',
                '3xl:w-[26rem] w-[15rem] sm:w-[17rem] md:w-[19rem] lg:w-[21rem] 2xl:w-[23rem]',
                'aspect-[4/3]',
                'bg-muted/80 animate-pulse border border-white/15 ring-1 ring-white/10 ring-inset'
            )}
            style={{ animationDelay: `${index * 100}ms` }}
        >
            <div className="flex h-full flex-col justify-between p-4">
                {/* 顶部标签占位 */}
                <div className="flex items-center justify-between">
                    <div className="bg-muted-foreground/20 h-6 w-20 rounded-full" />
                    <div className="bg-muted-foreground/20 h-6 w-24 rounded-full" />
                </div>
                {/* 底部标题占位 */}
                <div className="mt-auto space-y-2">
                    <div className="bg-muted-foreground/20 h-5 w-full rounded" />
                    <div className="bg-muted-foreground/20 h-5 w-3/4 rounded" />
                    <div className="bg-muted-foreground/20 h-3 w-20 rounded" />
                </div>
            </div>
        </div>
    );
}

interface ViewMoreCardProps {
    href: string;
    index: number;
    isOtherHovered: boolean;
    onHover: (index: number | null) => void;
    locale: Locale;
}

// "查看更多"卡片组件
export function ViewMoreCard({ href, index, isOtherHovered, onHover, locale }: ViewMoreCardProps) {
    const viewAllText = getUIText('home', 'viewAllPosts', locale);
    const exploreMoreText = getUIText('home', 'exploreMore', locale);

    return (
        <a
            href={href}
            data-media-card="home"
            className={cn(
                'showcase-card group relative isolate flex-shrink-0 overflow-hidden rounded-[1.45rem] sm:rounded-[1.65rem]',
                '3xl:w-[26rem] w-[15rem] sm:w-[17rem] md:w-[19rem] lg:w-[21rem] 2xl:w-[23rem]',
                'aspect-[4/3] cursor-pointer',
                'focus-visible:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'border border-[var(--home-showcase-card-border)] bg-[var(--home-showcase-card-bg)]',
                'ring-1 ring-[var(--home-showcase-card-ring)] ring-inset',
                'shadow-[0_18px_34px_var(--home-showcase-card-shadow)]',
                CARD_VISUAL_TRANSITION_CLASS,
                isOtherHovered ? 'opacity-[0.84]' : 'opacity-100',
                'hover:-translate-y-0.5 hover:scale-[1.016] hover:opacity-100',
                'focus-visible:-translate-y-0.5 focus-visible:scale-[1.016] focus-visible:opacity-100',
                'motion-reduce:transform-none',
                'hover:border-[var(--home-showcase-card-border-hover)] hover:shadow-[0_24px_44px_var(--home-showcase-card-shadow-hover)]'
            )}
            onPointerEnter={() => onHover(index)}
            onPointerLeave={() => onHover(null)}
            aria-label={viewAllText}
        >
            <div data-media-card-media className="absolute inset-0 -z-30 overflow-hidden">
                <div
                    className={cn(
                        'h-full w-full bg-[radial-gradient(circle_at_28%_18%,var(--card-image-fallback-highlight),transparent_34%),linear-gradient(135deg,var(--card-image-fallback-start),var(--card-image-fallback-end))]',
                        CARD_MEDIA_TRANSITION_CLASS
                    )}
                />
            </div>

            <div
                className="pointer-events-none absolute inset-0 -z-20"
                style={{
                    background: 'var(--home-showcase-more-overlay)',
                }}
            />

            <div
                data-media-card-glow
                className={cn(
                    'pointer-events-none absolute inset-0 -z-10 opacity-80',
                    CARD_GLOW_TRANSITION_CLASS
                )}
            >
                <div className="absolute inset-0 bg-[var(--home-showcase-more-glow)]" />
                <div className="absolute inset-0 ring-1 ring-[var(--home-showcase-card-ring)] ring-inset" />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[66%] bg-[var(--home-showcase-title-gradient)]" />

            <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div
                    className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-full',
                        'border border-[var(--home-showcase-control-border)] bg-[var(--home-showcase-control-bg)] shadow-[0_10px_28px_var(--home-showcase-control-shadow)] backdrop-blur-md',
                        'transition-[background,transform] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                        'group-hover:scale-105 group-hover:bg-[var(--home-showcase-control-bg-hover)]'
                    )}
                >
                    <ArrowRight className="h-7 w-7 text-white transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5" />
                </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pt-16 pb-3 sm:px-4 sm:pt-20 sm:pb-4">
                <h3 className="m-0 line-clamp-2 text-[1.03rem] leading-tight font-extrabold text-white [text-shadow:0_2px_12px_rgba(3,7,18,0.82)] sm:text-[1.1rem]">
                    {viewAllText}
                </h3>
                <p className="mt-2 line-clamp-1 text-[0.68rem] leading-none font-bold text-white/70 [text-shadow:0_1px_8px_rgba(3,7,18,0.72)]">
                    {exploreMoreText}
                </p>
            </div>
        </a>
    );
}
