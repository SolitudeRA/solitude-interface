import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Columns3, LayoutList, LibraryBig, Search } from 'lucide-react';
import { cn } from '@components/common/lib/utils';
import { getUIText, type Locale } from '@lib/i18n';
import type { ArchiveLayout } from '@lib/postArchive';
import type { FacetOption } from '@lib/postBrowse';

type ArchiveControlKey =
    | 'category'
    | 'all'
    | 'archiveView'
    | 'archiveLedger'
    | 'archiveSeries'
    | 'archiveYears';

export function ArchiveHeaderControls({
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
    const t = (key: ArchiveControlKey) => getUIText('postView', key, locale);
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

export function ArchiveSearchControl({
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

export function ArchivePagination({
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
