import {
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from 'react';
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

    const handleLayoutKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
        const lastIndex = options.length - 1;
        const nextIndex = (() => {
            if (event.key === 'ArrowRight') return index === lastIndex ? 0 : index + 1;
            if (event.key === 'ArrowLeft') return index === 0 ? lastIndex : index - 1;
            if (event.key === 'Home') return 0;
            if (event.key === 'End') return lastIndex;
            return null;
        })();

        if (nextIndex === null) return;
        event.preventDefault();
        const nextLayout = options[nextIndex]?.[0];
        if (!nextLayout) return;
        onLayout(nextLayout);
        window.requestAnimationFrame(() => {
            document.getElementById(`archive-tab-${nextLayout}`)?.focus();
        });
    };

    return (
        <div
            data-archive-header-controls
            className="flex items-center gap-[var(--top-control-gap)]"
        >
            <div
                role="tablist"
                aria-label={t('archiveView')}
                className="site-top-control site-top-control-group"
            >
                {options.map(([key, label, Icon], index) => (
                    <button
                        key={key}
                        id={`archive-tab-${key}`}
                        type="button"
                        role="tab"
                        aria-label={label}
                        aria-selected={layout === key}
                        aria-controls={`archive-panel-${key}`}
                        tabIndex={layout === key ? 0 : -1}
                        data-archive-layout-button={key}
                        onClick={() => onLayout(key)}
                        onKeyDown={(event) => handleLayoutKeyDown(event, index)}
                        className={cn(
                            'site-top-control-item focus-visible:ring-ring focus:outline-none focus-visible:ring-2',
                            'xl:text-xs'
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span data-archive-layout-label className="hidden lg:inline">
                            {label}
                        </span>
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
    const buttonRef = useRef<HTMLButtonElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const label = getUIText('postView', 'searchPlaceholder', locale);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const closeOnOutsidePress = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };

        document.addEventListener('pointerdown', closeOnOutsidePress);
        return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
    }, [isOpen]);

    return (
        <div ref={rootRef} data-archive-search className="relative">
            <button
                ref={buttonRef}
                type="button"
                data-archive-search-button
                aria-label={label}
                aria-expanded={isOpen}
                aria-controls="post-archive-search-panel"
                onClick={() => setIsOpen((open) => !open)}
                className={cn(
                    'site-top-control site-top-icon-control focus-visible:ring-ring relative text-[var(--muted-foreground)] focus:outline-none focus-visible:ring-2',
                    isOpen && 'text-[var(--foreground)]'
                )}
            >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {query && (
                    <span className="bg-primary absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" />
                )}
            </button>

            <label
                id="post-archive-search-panel"
                data-archive-search-panel
                data-open={isOpen ? 'true' : 'false'}
                inert={!isOpen}
                className="archive-search-panel site-top-popover focus-within:ring-ring/70 absolute top-[calc(100%+0.5rem)] right-0 z-[80] flex h-11 w-[min(24rem,calc(100vw-2rem))] origin-top-right items-center gap-2 rounded-full px-3 focus-within:ring-2"
            >
                <Search className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
                <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    disabled={!isOpen}
                    onChange={(event) => onQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key !== 'Escape') return;
                        event.preventDefault();
                        setIsOpen(false);
                        buttonRef.current?.focus();
                    }}
                    placeholder={label}
                    aria-label={label}
                    className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-default"
                />
            </label>
        </div>
    );
}

export function ArchivePagination({
    currentPage,
    totalPages,
    previousLabel,
    nextLabel,
    onPrevious,
    onNext,
}: {
    currentPage: number;
    totalPages: number;
    previousLabel: string;
    nextLabel: string;
    onPrevious: () => void;
    onNext: () => void;
}) {
    return (
        <nav
            data-archive-pagination
            aria-label={`${previousLabel} / ${nextLabel}`}
            className="border-border/55 bg-background/72 flex items-center gap-0.5 rounded-full border p-0.5 shadow-xl backdrop-blur-xl sm:gap-1 sm:p-1"
        >
            <button
                type="button"
                onClick={onPrevious}
                disabled={currentPage <= 1}
                aria-label={previousLabel}
                className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-ring inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8"
            >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span
                aria-live="polite"
                className="text-muted-foreground min-w-[3.5rem] text-center text-[0.62rem] font-semibold tracking-[0.06em] tabular-nums sm:min-w-[4.25rem] sm:text-[0.68rem] sm:tracking-[0.08em]"
            >
                {String(currentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            </span>
            <button
                type="button"
                onClick={onNext}
                disabled={currentPage >= totalPages}
                aria-label={nextLabel}
                className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-ring inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8"
            >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
        </nav>
    );
}

export function ArchiveGroupPagination({
    page,
    totalPages,
    previousLabel,
    nextLabel,
    onPage,
    inverse = false,
}: {
    page: number;
    totalPages: number;
    previousLabel: string;
    nextLabel: string;
    onPage: (page: number) => void;
    inverse?: boolean;
}) {
    if (totalPages <= 1) return null;

    return (
        <nav
            data-archive-group-pagination
            aria-label={`${previousLabel} / ${nextLabel}`}
            className={cn(
                'flex shrink-0 items-center gap-0.5 rounded-full border p-0.5',
                inverse
                    ? 'border-white/16 bg-black/22 text-white/72'
                    : 'border-border/45 bg-foreground/[0.035] text-muted-foreground'
            )}
        >
            <button
                type="button"
                onClick={() => onPage(page - 1)}
                disabled={page <= 1}
                aria-label={previousLabel}
                className="focus-visible:ring-ring inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-current/10 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span
                aria-live="polite"
                className="min-w-[2.8rem] text-center text-[0.6rem] font-semibold tracking-[0.06em] tabular-nums"
            >
                {String(page).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            </span>
            <button
                type="button"
                onClick={() => onPage(page + 1)}
                disabled={page >= totalPages}
                aria-label={nextLabel}
                className="focus-visible:ring-ring inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-current/10 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        </nav>
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
                className="site-top-control site-top-select text-foreground max-w-[7.5rem] focus-visible:ring-2 focus-visible:ring-[var(--ring)] xl:hidden"
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
                className="site-top-control site-top-control-group hidden xl:flex"
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
                'site-top-control-item focus-visible:ring-ring focus:outline-none focus-visible:ring-2'
            )}
        >
            {children}
        </button>
    );
}
