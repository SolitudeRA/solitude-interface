import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@components/common/lib/utils';
import { ArchiveGroupPagination } from '@components/posts/view/PostArchiveControls';
import { getUIText, type Locale } from '@lib/i18n';
import {
    formatArchiveDate,
    formatArchiveMonthDay,
    getArchiveCategoryLabel,
    getArchiveSeriesLabel,
    type ArchiveGroup,
    type ArchiveGroupPage,
    type PostArchiveItem,
} from '@lib/postArchive';

export function LedgerView({
    groups,
    activePost,
    onActivate,
    countLabel,
    totalCount,
    locale,
}: {
    groups: ArchiveGroup[];
    activePost: PostArchiveItem | null;
    onActivate: (id: string) => void;
    countLabel: (count: number) => string;
    totalCount: number;
    locale: Locale;
}) {
    return (
        <div
            id="archive-panel-ledger"
            role="tabpanel"
            aria-labelledby="archive-tab-ledger"
            className="mx-auto grid h-full min-h-0 w-full max-w-[var(--site-wide-content)] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]"
        >
            <section
                data-archive-scroll-root
                className="min-h-0 overflow-y-auto rounded-[1.35rem] border border-[var(--page-surface-border)] bg-[var(--page-surface-bg)] shadow-[0_12px_34px_var(--page-surface-shadow)] [scrollbar-width:thin]"
            >
                <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--page-surface-border)] bg-[var(--page-surface-bg-hover)] px-4 py-3 sm:px-5">
                    <span className="text-muted-foreground text-[0.66rem] font-semibold tracking-[0.16em] uppercase">
                        Editorial Ledger
                    </span>
                    <span className="text-muted-foreground text-[0.7rem] font-medium">
                        {countLabel(totalCount)}
                    </span>
                </header>
                <div className="px-3 pb-5 sm:px-5">
                    {groups.map((group) => (
                        <section
                            key={group.key}
                            className="border-border/30 grid grid-cols-[4.25rem_minmax(0,1fr)] border-b py-2 last:border-b-0 sm:grid-cols-[6.5rem_minmax(0,1fr)]"
                        >
                            <h2 className="text-foreground/18 pt-2 text-[1.65rem] leading-none font-black tracking-[-0.07em] sm:text-[2.7rem]">
                                {group.label}
                            </h2>
                            <div>
                                {group.posts.map((post) => (
                                    <ArchiveRow
                                        key={post.id}
                                        post={post}
                                        active={post.id === activePost?.id}
                                        onActivate={onActivate}
                                        showCategory
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </section>
            {activePost && (
                <ArchivePreview post={activePost} locale={locale} className="hidden lg:flex" />
            )}
        </div>
    );
}

export function ArchiveRail({
    activePost,
    activeGroupKey,
    activeGroupPage,
    locale,
    desktopPreviewOnly = false,
    children,
}: {
    activePost: PostArchiveItem | null;
    activeGroupKey?: string;
    activeGroupPage?: number;
    locale: Locale;
    desktopPreviewOnly?: boolean;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                'mx-auto grid h-full min-h-0 w-full max-w-[var(--site-wide-content)] min-w-0 grid-cols-1 gap-4 overflow-hidden',
                desktopPreviewOnly
                    ? 'xl:pointer-fine:grid-cols-[minmax(0,1fr)_minmax(19rem,25rem)]'
                    : 'xl:grid-cols-[minmax(0,1fr)_minmax(19rem,25rem)]'
            )}
        >
            <div className="h-full min-h-0 min-w-0 overflow-x-hidden">{children}</div>
            {activePost && (
                <ArchivePreview
                    post={activePost}
                    locale={locale}
                    compact
                    {...(activeGroupKey && activeGroupPage
                        ? { groupKey: activeGroupKey, groupPage: activeGroupPage }
                        : {})}
                    className={cn(
                        'hidden h-full min-w-0',
                        desktopPreviewOnly ? 'xl:pointer-fine:flex' : 'xl:flex'
                    )}
                />
            )}
        </div>
    );
}

export function YearColumns({
    groups,
    activePost,
    onActivate,
    countLabel,
    previousLabel,
    nextLabel,
    onGroupPage,
}: {
    groups: ArchiveGroupPage[];
    activePost: PostArchiveItem | null;
    onActivate: (id: string) => void;
    countLabel: (count: number) => string;
    previousLabel: string;
    nextLabel: string;
    onGroupPage: (groupKey: string, page: number) => void;
}) {
    return (
        <div
            id="archive-panel-years"
            role="tabpanel"
            aria-labelledby="archive-tab-years"
            data-archive-scroll-root
            className="grid h-full min-h-0 min-w-0 auto-rows-[minmax(28rem,1fr)] grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 pb-1 sm:grid-cols-2 lg:auto-rows-fr lg:grid-cols-3"
        >
            {groups.map((group) => (
                <section
                    key={group.key}
                    className="archive-column grid h-full min-h-0 w-full min-w-0 grid-rows-[5.25rem_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border border-[var(--page-surface-border)] bg-[var(--page-surface-bg)] shadow-[0_12px_34px_var(--page-surface-shadow)]"
                >
                    <header className="border-border/40 flex items-end justify-between gap-3 border-b px-5 py-4">
                        <h2 className="text-foreground text-4xl leading-none font-black tracking-[-0.065em]">
                            {group.label}
                        </h2>
                        <div className="flex min-w-0 flex-col items-end gap-1.5">
                            <span className="text-muted-foreground pb-0.5 text-[0.65rem] font-semibold tracking-[0.1em] uppercase">
                                {countLabel(group.posts.length)}
                            </span>
                            <ArchiveGroupPagination
                                page={group.page}
                                totalPages={group.totalPages}
                                previousLabel={previousLabel}
                                nextLabel={nextLabel}
                                onPage={(page) => onGroupPage(group.key, page)}
                            />
                        </div>
                    </header>
                    <div
                        data-archive-group-list={group.key}
                        className="relative min-h-0 overflow-y-auto px-4 pb-4 [scrollbar-width:thin]"
                    >
                        <AnimatePresence initial={false} mode="wait">
                            <motion.div
                                key={`${group.key}:${group.page}`}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -3 }}
                                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                            >
                                {group.visiblePosts.map((post) => (
                                    <ArchiveRow
                                        key={post.id}
                                        post={post}
                                        active={post.id === activePost?.id}
                                        onActivate={onActivate}
                                        groupKey={group.key}
                                        groupPage={group.page}
                                    />
                                ))}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </section>
            ))}
        </div>
    );
}

function ArchiveRow({
    post,
    active,
    onActivate,
    showCategory = false,
    groupKey,
    groupPage,
}: {
    post: PostArchiveItem;
    active: boolean;
    onActivate: (id: string) => void;
    showCategory?: boolean;
    groupKey?: string;
    groupPage?: number;
}) {
    const category = getArchiveCategoryLabel(post);
    return (
        <a
            href={post.url}
            data-post-transition-source
            data-astro-prefetch="tap"
            data-archive-post-id={post.id}
            data-archive-group-key={groupKey}
            data-archive-group-page={groupPage}
            onPointerEnter={() => onActivate(post.id)}
            onPointerMove={() => {
                if (!active) onActivate(post.id);
            }}
            onFocus={() => onActivate(post.id)}
            aria-current={active ? 'true' : undefined}
            className={cn(
                'border-border/35 focus-visible:ring-ring grid min-h-12 grid-cols-[3.35rem_minmax(0,1fr)_auto] items-center gap-2 border-b px-1 py-2.5 transition-colors focus:outline-none focus-visible:ring-2',
                active
                    ? 'bg-foreground/[0.055] text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/[0.035] hover:text-foreground'
            )}
        >
            <time className="text-muted-foreground text-[0.66rem] font-medium tabular-nums">
                {formatArchiveMonthDay(post.published_at)}
            </time>
            <span
                data-post-transition-title
                className="line-clamp-2 text-[0.84rem] leading-snug font-semibold sm:text-sm"
            >
                {post.title}
            </span>
            {showCategory && category && (
                <span className="text-muted-foreground hidden text-[0.64rem] font-medium sm:inline">
                    {category}
                </span>
            )}
        </a>
    );
}

function ArchivePreview({
    post,
    locale,
    compact = false,
    groupKey,
    groupPage,
    className,
}: {
    post: PostArchiveItem;
    locale: Locale;
    compact?: boolean;
    groupKey?: string;
    groupPage?: number;
    className?: string;
}) {
    const series = getArchiveSeriesLabel(post);
    return (
        <a
            href={post.url}
            data-media-card="archive-preview"
            data-post-transition-source
            data-astro-prefetch="tap"
            data-archive-group-key={groupKey}
            data-archive-group-page={groupPage}
            aria-label={post.title}
            className={cn(
                'group/preview border-border/55 bg-card/58 focus-visible:ring-ring relative min-h-0 flex-col justify-end overflow-hidden rounded-[1.35rem] border shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 motion-reduce:transform-none',
                className
            )}
        >
            {post.feature_image ? (
                <img
                    key={post.id}
                    src={post.feature_image}
                    srcSet={post.feature_image_srcset}
                    sizes={post.feature_image_sizes}
                    data-post-transition-media
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/preview:scale-[1.025] motion-reduce:transform-none"
                />
            ) : (
                <div
                    key={post.id}
                    data-post-transition-media
                    className="absolute inset-0 bg-[linear-gradient(135deg,var(--card-image-fallback-start),var(--card-image-fallback-end))]"
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/48 to-black/5" />
            <div className={cn('relative text-white', compact ? 'p-4' : 'p-5 sm:p-6')}>
                <p className="text-[0.62rem] font-semibold tracking-[0.12em] text-white/62 uppercase">
                    {[formatArchiveDate(post.published_at), getArchiveCategoryLabel(post)]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
                <h2
                    data-post-transition-title
                    className={cn(
                        'mt-2 line-clamp-2 leading-tight font-bold tracking-[-0.035em]',
                        compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                    )}
                >
                    {post.title}
                </h2>
                {!compact && post.excerpt && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/66">
                        {post.excerpt}
                    </p>
                )}
                {series && (
                    <p className="mt-3 line-clamp-1 text-[0.68rem] font-medium text-white/52">
                        {series}
                        {post.post_series_number ? ` · ${post.post_series_number}` : ''}
                    </p>
                )}
                <span className="sr-only">{getUIText('postView', 'archiveView', locale)}</span>
            </div>
        </a>
    );
}
