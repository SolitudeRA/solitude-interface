import { useCallback, useEffect, useState } from 'react';
import { ArchiveHeaderControls } from '@components/posts/view/PostArchiveControls';
import {
    INITIAL_ARCHIVE_PAGINATION,
    type ArchiveLayout,
    type ArchiveState,
} from '@lib/postArchive';
import {
    POST_ARCHIVE_STATE_EVENT,
    readPostArchiveState,
    writePostArchiveState,
} from '@lib/navigation/postArchiveStateController';
import type { FacetOption } from '@lib/postBrowse';
import type { Locale } from '@lib/i18n';

function withResetPagination(
    state: ArchiveState,
    changes: Partial<Pick<ArchiveState, 'layout' | 'filters'>>
): ArchiveState {
    return {
        ...state,
        ...changes,
        pagination: { ...INITIAL_ARCHIVE_PAGINATION },
    };
}

export default function PostArchiveNavbar({
    locale,
    categories,
    initialLayout,
    initialCategory = null,
}: {
    locale: Locale;
    categories: FacetOption[];
    initialLayout: ArchiveLayout;
    initialCategory?: string | null;
}) {
    const [layout, setLayout] = useState(initialLayout);
    const [category, setCategory] = useState<string | null>(initialCategory);

    useEffect(() => {
        const sync = () => {
            const state = readPostArchiveState();
            setLayout(state.layout);
            setCategory(state.filters.category);
        };

        sync();
        window.addEventListener('popstate', sync);
        window.addEventListener(POST_ARCHIVE_STATE_EVENT, sync);
        return () => {
            window.removeEventListener('popstate', sync);
            window.removeEventListener(POST_ARCHIVE_STATE_EVENT, sync);
        };
    }, []);

    const selectLayout = useCallback((nextLayout: ArchiveLayout) => {
        const state = readPostArchiveState();
        if (state.layout === nextLayout) return;
        setLayout(nextLayout);
        writePostArchiveState(withResetPagination(state, { layout: nextLayout }), 'push');
    }, []);

    const selectCategory = useCallback((nextCategory: string | null) => {
        const state = readPostArchiveState();
        const categoryValue = state.filters.category === nextCategory ? null : nextCategory;
        setCategory(categoryValue);
        writePostArchiveState(
            withResetPagination(state, {
                filters: { ...state.filters, category: categoryValue },
            }),
            'replace'
        );
    }, []);

    return (
        <ArchiveHeaderControls
            layout={layout}
            locale={locale}
            categories={categories}
            selectedCategory={category}
            onLayout={selectLayout}
            onCategory={selectCategory}
        />
    );
}
