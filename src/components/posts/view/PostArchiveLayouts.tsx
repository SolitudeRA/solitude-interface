import type { ReactNode } from 'react';
import { cn } from '@components/common/lib/utils';
import { getUIText, type Locale } from '@lib/i18n';
import {
    formatArchiveDate,
    formatArchiveMonthDay,
    formatArchiveYear,
    getArchiveCategoryLabel,
    getArchiveSeriesLabel,
    type ArchiveGroup,
    type PostArchiveItem,
} from '@lib/postArchive';

export function LedgerView({
    groups,
    activePost,
    onActivate,
    countLabel,
    locale,
}: {
    groups: ArchiveGroup[];
    activePost: PostArchiveItem | null;
    onActivate: (id: string) => void;
    countLabel: (count: number) => string;
    locale: Locale;
}) {
    const total = groups.reduce((sum, group) => sum + group.posts.length, 0);
    return (
        <div
            id="archive-panel-ledger"
            role="tabpanel"
            aria-labelledby="archive-tab-ledger"
            className="mx-auto grid h-full min-h-0 w-full max-w-[96rem] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]"
        >
            <section className="border-border/50 bg-background/42 min-h-0 overflow-y-auto rounded-[1.35rem] border shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur-lg [scrollbar-width:thin]">
                <header className="border-border/35 bg-background/80 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl sm:px-5">
                    <span className="text-muted-foreground text-[0.66rem] font-semibold tracking-[0.16em] uppercase">
                        Editorial Ledger
                    </span>
                    <span className="text-muted-foreground text-[0.7rem] font-medium">
                        {countLabel(total)}
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
    locale,
    children,
}: {
    activePost: PostArchiveItem | null;
    locale: Locale;
    children: ReactNode;
}) {
    return (
        <div className="mx-auto grid h-full min-h-0 w-full max-w-[96rem] min-w-0 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(19rem,25rem)]">
            <div className="h-full min-h-0 min-w-0 overflow-x-hidden">{children}</div>
            {activePost && (
                <ArchivePreview
                    post={activePost}
                    locale={locale}
                    compact
                    className="hidden h-full min-w-0 xl:flex"
                />
            )}
        </div>
    );
}

export function SeriesLibrary({
    groups,
    activePost,
    onActivate,
    countLabel,
}: {
    groups: ArchiveGroup[];
    activePost: PostArchiveItem | null;
    onActivate: (id: string) => void;
    countLabel: (count: number) => string;
}) {
    return (
        <div
            id="archive-panel-series"
            role="tabpanel"
            aria-labelledby="archive-tab-series"
            className="grid h-full min-h-0 min-w-0 auto-rows-[minmax(30rem,1fr)] grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 pb-1 sm:auto-rows-fr sm:grid-cols-2"
        >
            {groups.map((group) => {
                const cover = group.posts.find((post) => post.feature_image)?.feature_image;
                return (
                    <section
                        key={group.key}
                        className="archive-column border-border/50 bg-background/50 grid h-full min-h-0 w-full min-w-0 grid-rows-[9rem_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur-lg sm:grid-rows-[10rem_minmax(0,1fr)]"
                    >
                        <header className="bg-muted relative overflow-hidden p-5">
                            {cover ? (
                                <img
                                    src={cover}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="absolute inset-0 h-full w-full object-cover opacity-70 saturate-75"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--card-image-fallback-start),var(--card-image-fallback-end))]" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/58 to-black/20" />
                            <div className="relative flex h-full flex-col justify-end text-white">
                                <span className="text-[0.62rem] font-semibold tracking-[0.14em] text-white/62 uppercase">
                                    {countLabel(group.posts.length)}
                                </span>
                                <h2 className="mt-2 max-w-[16ch] text-xl leading-tight font-bold tracking-[-0.035em] sm:text-2xl">
                                    {group.label}
                                </h2>
                            </div>
                        </header>
                        <div className="min-h-0 overflow-y-auto px-4 pb-4 [scrollbar-width:thin]">
                            {group.posts.map((post, index) => (
                                <a
                                    key={post.id}
                                    href={post.url}
                                    data-post-transition-source
                                    data-archive-post-id={post.id}
                                    onPointerEnter={() => onActivate(post.id)}
                                    onFocus={() => onActivate(post.id)}
                                    aria-current={post.id === activePost?.id ? 'true' : undefined}
                                    className={cn(
                                        'border-border/35 focus-visible:ring-ring grid grid-cols-[2.6rem_minmax(0,1fr)_auto] items-center gap-2 border-b px-1 py-3 transition-colors focus:outline-none focus-visible:ring-2',
                                        post.id === activePost?.id
                                            ? 'bg-foreground/[0.055] text-foreground'
                                            : 'text-muted-foreground hover:bg-foreground/[0.035] hover:text-foreground'
                                    )}
                                >
                                    <span className="text-muted-foreground text-[0.68rem] font-semibold tabular-nums">
                                        {post.post_series_number ||
                                            String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span
                                        data-post-transition-title
                                        className="line-clamp-2 text-[0.84rem] leading-snug font-semibold"
                                    >
                                        {post.title}
                                    </span>
                                    <time className="text-muted-foreground text-[0.64rem] tabular-nums">
                                        {formatArchiveYear(post.published_at)}
                                    </time>
                                </a>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

export function YearColumns({
    groups,
    activePost,
    onActivate,
    countLabel,
}: {
    groups: ArchiveGroup[];
    activePost: PostArchiveItem | null;
    onActivate: (id: string) => void;
    countLabel: (count: number) => string;
}) {
    return (
        <div
            id="archive-panel-years"
            role="tabpanel"
            aria-labelledby="archive-tab-years"
            className="grid h-full min-h-0 min-w-0 auto-rows-[minmax(28rem,1fr)] grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 pb-1 sm:grid-cols-2 lg:auto-rows-fr lg:grid-cols-3"
        >
            {groups.map((group) => (
                <section
                    key={group.key}
                    className="archive-column border-border/50 bg-background/48 grid h-full min-h-0 w-full min-w-0 grid-rows-[5.25rem_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur-lg"
                >
                    <header className="border-border/40 flex items-end justify-between border-b px-5 py-4">
                        <h2 className="text-foreground text-4xl leading-none font-black tracking-[-0.065em]">
                            {group.label}
                        </h2>
                        <span className="text-muted-foreground pb-0.5 text-[0.65rem] font-semibold tracking-[0.1em] uppercase">
                            {countLabel(group.posts.length)}
                        </span>
                    </header>
                    <div className="min-h-0 overflow-y-auto px-4 pb-4 [scrollbar-width:thin]">
                        {group.posts.map((post) => (
                            <ArchiveRow
                                key={post.id}
                                post={post}
                                active={post.id === activePost?.id}
                                onActivate={onActivate}
                            />
                        ))}
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
}: {
    post: PostArchiveItem;
    active: boolean;
    onActivate: (id: string) => void;
    showCategory?: boolean;
}) {
    const category = getArchiveCategoryLabel(post);
    return (
        <a
            href={post.url}
            data-post-transition-source
            data-archive-post-id={post.id}
            onPointerEnter={() => onActivate(post.id)}
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
    className,
}: {
    post: PostArchiveItem;
    locale: Locale;
    compact?: boolean;
    className?: string;
}) {
    const series = getArchiveSeriesLabel(post);
    return (
        <a
            href={post.url}
            data-post-transition-source
            aria-label={post.title}
            className={cn(
                'group/preview border-border/55 bg-card/58 focus-visible:ring-ring relative min-h-0 flex-col justify-end overflow-hidden rounded-[1.35rem] border shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 motion-reduce:transform-none',
                className
            )}
        >
            {post.feature_image ? (
                <img
                    src={post.feature_image}
                    data-post-transition-media
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/preview:scale-[1.025] motion-reduce:transform-none"
                />
            ) : (
                <div
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
