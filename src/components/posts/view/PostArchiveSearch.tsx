import { useCallback, useEffect, useState } from 'react';
import { ArchiveSearchControl } from '@components/posts/view/PostArchiveControls';
import { INITIAL_ARCHIVE_PAGINATION } from '@lib/postArchive';
import {
    POST_ARCHIVE_STATE_EVENT,
    readPostArchiveState,
    writePostArchiveState,
} from '@lib/navigation/postArchiveStateController';
import type { Locale } from '@lib/i18n';

function readQuery(): string {
    return readPostArchiveState().filters.query;
}

export default function PostArchiveSearch({
    locale,
    initialQuery = '',
}: {
    locale: Locale;
    initialQuery?: string;
}) {
    const [query, setQuery] = useState(initialQuery);

    useEffect(() => {
        const sync = () => setQuery(readQuery());
        sync();
        window.addEventListener('popstate', sync);
        window.addEventListener(POST_ARCHIVE_STATE_EVENT, sync);
        return () => {
            window.removeEventListener('popstate', sync);
            window.removeEventListener(POST_ARCHIVE_STATE_EVENT, sync);
        };
    }, []);

    const updateQuery = useCallback((nextQuery: string) => {
        const currentState = readPostArchiveState();
        const nextState = {
            ...currentState,
            filters: { ...currentState.filters, query: nextQuery },
            pagination: { ...INITIAL_ARCHIVE_PAGINATION },
        };

        setQuery(nextQuery);
        writePostArchiveState(nextState, 'replace');

        if (
            nextQuery.trim() &&
            new URLSearchParams(window.location.search).get('view') !== 'list'
        ) {
            document.querySelector<HTMLButtonElement>('[data-view-toggle="list"]')?.click();
        }
    }, []);

    return <ArchiveSearchControl locale={locale} query={query} onQuery={updateQuery} />;
}
