import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@components/common/lib/utils';
import { ArchiveGroupPagination } from '@components/posts/view/PostArchiveControls';
import { getUIText, type Locale } from '@lib/i18n';
import {
    formatArchiveDate,
    formatArchiveYear,
    type ArchiveGroupPage,
    type PostArchiveItem,
} from '@lib/postArchive';
import './SeriesLibrary.css';

type MobileView = 'atlas' | 'focus';

interface SeriesLibraryProps {
    groups: ArchiveGroupPage[];
    selectedGroupKey: string | null;
    activePost: PostArchiveItem | null;
    onActivate: (id: string) => void;
    onSelectGroup: (groupKey: string) => void;
    countLabel: (count: number) => string;
    previousLabel: string;
    nextLabel: string;
    onGroupPage: (groupKey: string, page: number) => void;
    locale: Locale;
}

function getCoverPost(group: ArchiveGroupPage): PostArchiveItem | null {
    return group.posts.find((post) => post.feature_image) ?? null;
}

function getLatestDate(group: ArchiveGroupPage): string {
    return group.posts.reduce(
        (latest, post) => (post.published_at > latest ? post.published_at : latest),
        ''
    );
}

function getAccentStyle(color: string | undefined): CSSProperties | undefined {
    return color ? { backgroundColor: color } : undefined;
}

export default function SeriesLibrary({
    groups,
    selectedGroupKey,
    activePost,
    onActivate,
    onSelectGroup,
    countLabel,
    previousLabel,
    nextLabel,
    onGroupPage,
    locale,
}: SeriesLibraryProps) {
    const selectedGroup =
        groups.find((group) => group.key === selectedGroupKey) ?? groups[0] ?? null;
    const selectedKey = selectedGroup?.key ?? '';
    const groupSignature = useMemo(() => groups.map((group) => group.key).join('\u0000'), [groups]);
    const [previewGroupKey, setPreviewGroupKey] = useState(selectedKey);
    const [mobileView, setMobileView] = useState<MobileView>(selectedGroupKey ? 'focus' : 'atlas');
    const [loadedCovers, setLoadedCovers] = useState<ReadonlySet<string>>(() => new Set());
    const previewGroup = groups.find((group) => group.key === previewGroupKey) ?? selectedGroup;

    useEffect(() => {
        setPreviewGroupKey(selectedKey);
        setMobileView(selectedGroupKey ? 'focus' : 'atlas');
    }, [groupSignature, selectedGroupKey, selectedKey]);

    if (!selectedGroup || !previewGroup) return null;

    const previewCoverPost = getCoverPost(previewGroup);
    const previewDescription =
        previewGroup.description ||
        (previewGroup.isStandalone
            ? getUIText('postView', 'standaloneSeriesDescription', locale)
            : '');
    const previewUpdated = getUIText('postView', 'seriesUpdated', locale).replace(
        '{date}',
        formatArchiveDate(getLatestDate(previewGroup))
    );
    const previewLoaded = loadedCovers.has(previewGroup.key);
    const openLabel = getUIText('postView', 'seriesOpen', locale).replace(
        '{series}',
        previewGroup.label
    );

    const selectGroup = (group: ArchiveGroupPage) => {
        setPreviewGroupKey(group.key);
        setMobileView('focus');
        onSelectGroup(group.key);
    };

    return (
        <div
            id="archive-panel-series"
            role="tabpanel"
            aria-labelledby="archive-tab-series"
            data-archive-scroll-root
            data-mobile-view={mobileView}
            className="grid h-full min-h-0 min-w-0 grid-cols-1 gap-3 overflow-x-hidden md:grid-cols-[minmax(0,1.12fr)_minmax(17rem,0.88fr)]"
        >
            <section
                className={cn(
                    'archive-series-atlas min-h-0 min-w-0 grid-rows-[auto_minmax(12rem,1fr)_auto] overflow-y-auto overscroll-contain rounded-[1.35rem] border border-[var(--page-surface-border)] bg-[var(--page-surface-bg)] p-3 shadow-[0_12px_34px_var(--page-surface-shadow)] [scrollbar-width:thin] sm:p-4 md:grid md:overflow-hidden',
                    mobileView === 'focus' ? 'hidden' : 'grid'
                )}
            >
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 px-1 pb-3">
                    <div className="min-w-0">
                        <span className="text-muted-foreground text-[0.58rem] font-bold tracking-[0.14em] uppercase">
                            {getUIText('postView', 'seriesAtlas', locale)} · {groups.length}
                        </span>
                        <h2 className="mt-1 truncate text-base leading-tight font-bold tracking-[-0.035em] sm:text-lg">
                            {getUIText('postView', 'seriesBrowseTitle', locale)}
                        </h2>
                    </div>
                    <p className="text-muted-foreground hidden max-w-[18ch] text-right text-[0.62rem] leading-relaxed lg:block">
                        {getUIText('postView', 'seriesBrowseHint', locale)}
                    </p>
                </header>

                <div className="relative min-h-0 overflow-hidden rounded-[1.2rem] bg-[linear-gradient(135deg,var(--card-image-fallback-start),var(--card-image-fallback-end))]">
                    <AnimatePresence initial={false} mode="sync">
                        <motion.button
                            key={previewGroup.key}
                            type="button"
                            data-archive-series-preview
                            data-archive-series-key={previewGroup.key}
                            aria-label={openLabel}
                            onClick={() => selectGroup(previewGroup)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="group/series-preview focus-visible:ring-ring absolute inset-0 grid h-full w-full min-w-0 grid-rows-[auto_1fr] overflow-hidden rounded-[1.2rem] text-left text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                        >
                            {previewCoverPost?.feature_image && (
                                <img
                                    src={previewCoverPost.feature_image}
                                    srcSet={previewCoverPost.feature_image_srcset}
                                    sizes={previewCoverPost.feature_image_sizes}
                                    alt=""
                                    loading="eager"
                                    decoding="async"
                                    onLoad={() =>
                                        setLoadedCovers((current) => {
                                            const next = new Set(current);
                                            next.add(previewGroup.key);
                                            return next;
                                        })
                                    }
                                    className={cn(
                                        'archive-series-preview-image absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover/series-preview:scale-[1.025] motion-reduce:transform-none',
                                        previewLoaded ? 'opacity-80' : 'opacity-0'
                                    )}
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/52 to-black/12" />
                            <div className="relative flex items-center justify-between gap-3 px-4 pt-4 text-[0.56rem] font-semibold tracking-[0.12em] text-white/62 uppercase">
                                <span>{getUIText('postView', 'seriesPreview', locale)}</span>
                                <span>{countLabel(previewGroup.posts.length)}</span>
                            </div>
                            <div className="relative self-end p-4 sm:p-5">
                                <h3 className="line-clamp-2 max-w-[18ch] text-xl leading-[1.02] font-bold tracking-[-0.05em] sm:text-2xl">
                                    {previewGroup.label}
                                </h3>
                                {previewDescription && (
                                    <p className="mt-2 line-clamp-3 max-w-[46ch] text-[0.68rem] leading-relaxed text-white/68 sm:text-xs">
                                        {previewDescription}
                                    </p>
                                )}
                                <p className="mt-2 text-[0.58rem] font-medium text-white/48">
                                    {previewUpdated}
                                </p>
                            </div>
                        </motion.button>
                    </AnimatePresence>
                </div>

                <div className="flex min-h-0 flex-wrap content-stretch justify-center gap-2 pt-3">
                    {groups.map((group, index) => {
                        const selected = group.key === selectedGroup.key;
                        const previewed = group.key === previewGroup.key;
                        return (
                            <motion.button
                                layout
                                key={group.key}
                                type="button"
                                data-archive-series-entry
                                data-archive-series-key={group.key}
                                data-previewed={previewed}
                                data-selected={selected}
                                aria-pressed={selected}
                                aria-label={getUIText('postView', 'seriesOpen', locale).replace(
                                    '{series}',
                                    group.label
                                )}
                                onPointerEnter={() => setPreviewGroupKey(group.key)}
                                onFocus={() => setPreviewGroupKey(group.key)}
                                onClick={() => selectGroup(group)}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.21,
                                    delay: Math.min(index, 6) * 0.015,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                className={cn(
                                    'archive-series-entry focus-visible:ring-ring grid min-h-16 min-w-0 grid-cols-[0.25rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-xl border p-2.5 text-left transition-[color,border-color,background-color,transform] duration-200 focus:outline-none focus-visible:ring-2 motion-reduce:transform-none',
                                    selected
                                        ? 'border-foreground/25 bg-foreground/[0.075] text-foreground'
                                        : previewed
                                          ? 'border-foreground/20 bg-foreground/[0.05] text-foreground'
                                          : 'text-muted-foreground hover:text-foreground border-[var(--page-surface-border)] bg-[var(--page-surface-bg-hover)] hover:-translate-y-0.5'
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    style={getAccentStyle(group.color)}
                                    className="h-full min-h-8 rounded-full bg-[var(--ring)] opacity-75"
                                />
                                <span className="grid min-w-0 gap-1">
                                    <strong className="truncate text-[0.7rem] leading-tight font-semibold">
                                        {group.label}
                                    </strong>
                                    <small className="truncate text-[0.54rem] font-medium opacity-62">
                                        {countLabel(group.posts.length)}
                                    </small>
                                </span>
                                <ArrowRight aria-hidden="true" className="size-3 opacity-40" />
                            </motion.button>
                        );
                    })}
                </div>
            </section>

            <section
                data-archive-series-directory
                data-archive-series-key={selectedGroup.key}
                aria-label={selectedGroup.label}
                className={cn(
                    'min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border border-[var(--page-surface-border)] bg-[var(--page-surface-bg)] shadow-[0_12px_34px_var(--page-surface-shadow)] md:grid',
                    mobileView === 'atlas' ? 'hidden' : 'grid'
                )}
            >
                <header className="flex min-h-[5.25rem] items-end justify-between gap-3 border-b border-[var(--page-surface-border)] bg-[var(--page-surface-bg-hover)] p-4">
                    <div className="min-w-0">
                        <button
                            type="button"
                            onClick={() => setMobileView('atlas')}
                            className="text-muted-foreground focus-visible:ring-ring mb-2 flex items-center gap-1 text-[0.62rem] font-semibold focus:outline-none focus-visible:ring-2 md:hidden"
                        >
                            <ArrowLeft aria-hidden="true" className="size-3" />
                            {getUIText('postView', 'seriesBack', locale)}
                        </button>
                        <span className="text-muted-foreground text-[0.56rem] font-bold tracking-[0.13em] uppercase">
                            {getUIText('postView', 'archiveSeries', locale)}
                        </span>
                        <h2 className="mt-1 line-clamp-2 text-base leading-tight font-bold tracking-[-0.035em] sm:text-lg">
                            {selectedGroup.label}
                        </h2>
                    </div>
                    <ArchiveGroupPagination
                        page={selectedGroup.page}
                        totalPages={selectedGroup.totalPages}
                        previousLabel={previousLabel}
                        nextLabel={nextLabel}
                        onPage={(page) => onGroupPage(selectedGroup.key, page)}
                    />
                </header>

                <div
                    data-archive-group-list={selectedGroup.key}
                    className="relative min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 [scrollbar-width:thin]"
                >
                    <AnimatePresence initial={false} mode="wait">
                        <motion.ol
                            key={`${selectedGroup.key}:${selectedGroup.page}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -3 }}
                            transition={{
                                duration: 0.21,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                            className="m-0 list-none p-0"
                        >
                            {selectedGroup.visiblePosts.map((post, index) => (
                                <li key={post.id}>
                                    <a
                                        href={post.url}
                                        data-post-transition-source
                                        data-astro-prefetch="tap"
                                        data-archive-post-id={post.id}
                                        data-archive-group-key={selectedGroup.key}
                                        data-archive-group-page={selectedGroup.page}
                                        onPointerEnter={() => onActivate(post.id)}
                                        onPointerMove={() => {
                                            if (post.id !== activePost?.id) onActivate(post.id);
                                        }}
                                        onFocus={() => onActivate(post.id)}
                                        aria-current={
                                            post.id === activePost?.id ? 'true' : undefined
                                        }
                                        className={cn(
                                            'focus-visible:ring-ring grid min-h-14 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--page-surface-border)] px-1 py-2.5 transition-colors focus:outline-none focus-visible:ring-2',
                                            post.id === activePost?.id
                                                ? 'bg-foreground/[0.055] text-foreground'
                                                : 'text-muted-foreground hover:bg-foreground/[0.035] hover:text-foreground'
                                        )}
                                    >
                                        <span className="text-muted-foreground text-[0.64rem] font-semibold tabular-nums">
                                            {post.post_series_number ||
                                                String(
                                                    selectedGroup.startIndex + index + 1
                                                ).padStart(2, '0')}
                                        </span>
                                        <span
                                            data-post-transition-title
                                            className="line-clamp-2 text-[0.78rem] leading-snug font-semibold sm:text-[0.84rem]"
                                        >
                                            {post.title}
                                        </span>
                                        <time className="text-muted-foreground text-[0.58rem] tabular-nums">
                                            {formatArchiveYear(post.published_at)}
                                        </time>
                                    </a>
                                </li>
                            ))}
                        </motion.ol>
                    </AnimatePresence>
                </div>
            </section>
        </div>
    );
}
