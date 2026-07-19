import { DEFAULT_LOCALE, LOCALES, type Locale } from '@lib/i18n';
import type { PostTag } from '@api/ghost/types';

export const TAG_REGISTRY_PAGE_KINDS = {
    'tag-registry-type': 'type',
    'tag-registry-category': 'category',
    'tag-registry-series': 'series',
    'tag-registry-topic': 'topic',
} as const;

export const TAG_REGISTRY_PAGE_SLUGS = Object.keys(
    TAG_REGISTRY_PAGE_KINDS
) as TagRegistryPageSlug[];

export type TagRegistryKind = (typeof TAG_REGISTRY_PAGE_KINDS)[TagRegistryPageSlug];
export type TagRegistryPageSlug = keyof typeof TAG_REGISTRY_PAGE_KINDS;
export type TagLabelMap = Partial<Record<Locale, string>>;

export interface TagRegistryEntry {
    kind: TagRegistryKind;
    label: TagLabelMap;
    description?: TagLabelMap;
    order?: number;
    color?: string;
    hidden?: boolean;
}

export type TagRegistry = Record<string, TagRegistryEntry>;

export interface TagRegistryPage {
    slug: string;
    kind: TagRegistryKind;
    tags: TagRegistry;
}

export interface TagRegistryPageSource {
    slug: string;
    html?: string | null;
}

const SYSTEM_TAG_PREFIXES = ['hash-', 'type-', 'category-', 'series-'];

export function parseTagRegistryPage(source: TagRegistryPageSource): TagRegistryPage {
    const expectedKind = TAG_REGISTRY_PAGE_KINDS[source.slug as TagRegistryPageSlug];
    if (!expectedKind) {
        throw new Error(`Unknown tag registry page slug: ${source.slug}`);
    }

    const jsonText = extractJsonTextFromHtml(source.html ?? '');
    const parsed = parseJsonObject(jsonText, source.slug);
    const kind = getStringProperty(parsed, 'kind');
    if (kind !== expectedKind) {
        throw new Error(
            `Tag registry page ${source.slug} must declare kind "${expectedKind}", got "${kind}"`
        );
    }

    const rawTags = parsed.tags;
    if (!isRecord(rawTags)) {
        throw new Error(`Tag registry page ${source.slug} must contain a tags object`);
    }

    const tags: TagRegistry = {};
    for (const [tagSlug, rawEntry] of Object.entries(rawTags)) {
        tags[tagSlug] = normalizeRegistryEntry(source.slug, expectedKind, tagSlug, rawEntry);
    }

    return {
        slug: source.slug,
        kind: expectedKind,
        tags,
    };
}

export function mergeTagRegistryPages(pages: TagRegistryPage[]): TagRegistry {
    const registry: TagRegistry = {};

    for (const page of pages) {
        for (const [tagSlug, entry] of Object.entries(page.tags)) {
            if (registry[tagSlug]) {
                throw new Error(`Duplicate tag registry entry for "${tagSlug}"`);
            }
            registry[tagSlug] = entry;
        }
    }

    return registry;
}

export function getTagLabel(
    slug: string,
    locale: Locale,
    fallbackName?: string | null,
    registry: TagRegistry = {}
): string {
    const entry = registry[slug];
    const label =
        entry?.label[locale]?.trim() ||
        entry?.label[DEFAULT_LOCALE]?.trim() ||
        fallbackName?.trim() ||
        titleCaseTag(stripKnownTagPrefix(slug));

    return label;
}

export function getTagDescription(
    slug: string,
    locale: Locale,
    registry: TagRegistry = {}
): string {
    const description = registry[slug]?.description;
    return description?.[locale]?.trim() || description?.[DEFAULT_LOCALE]?.trim() || '';
}

export function localizeTag(
    tag: PostTag | undefined,
    locale: Locale,
    registry: TagRegistry = {}
): PostTag | undefined {
    if (!tag) {
        return undefined;
    }

    return {
        ...tag,
        name: getTagLabel(tag.slug, locale, tag.name, registry),
    };
}

export function localizeTags(
    tags: PostTag[] | undefined,
    locale: Locale,
    registry: TagRegistry = {}
): PostTag[] | undefined {
    return tags?.map((tag) => localizeTag(tag, locale, registry) ?? tag);
}

export function isTagHidden(slug: string, registry: TagRegistry = {}): boolean {
    return registry[slug]?.hidden === true;
}

function normalizeRegistryEntry(
    pageSlug: string,
    kind: TagRegistryKind,
    tagSlug: string,
    rawEntry: unknown
): TagRegistryEntry {
    if (!isRecord(rawEntry)) {
        throw new Error(`Tag registry entry "${tagSlug}" in ${pageSlug} must be an object`);
    }

    validateTagSlugForKind(kind, tagSlug, pageSlug);

    const label = normalizeLabelMap(rawEntry.label, `${pageSlug}:${tagSlug}.label`);
    if (Object.keys(label).length === 0) {
        throw new Error(`Tag registry entry "${tagSlug}" in ${pageSlug} must contain labels`);
    }

    const description =
        rawEntry.description === undefined
            ? undefined
            : normalizeLabelMap(rawEntry.description, `${pageSlug}:${tagSlug}.description`);
    const order = rawEntry.order === undefined ? undefined : normalizeNumber(rawEntry.order);
    const color = rawEntry.color === undefined ? undefined : normalizeString(rawEntry.color);
    const hidden = rawEntry.hidden === undefined ? undefined : rawEntry.hidden === true;

    return {
        kind,
        label,
        ...(description ? { description } : {}),
        ...(order !== undefined ? { order } : {}),
        ...(color ? { color } : {}),
        ...(hidden !== undefined ? { hidden } : {}),
    };
}

function validateTagSlugForKind(kind: TagRegistryKind, tagSlug: string, pageSlug: string): void {
    if (kind === 'type' && !tagSlug.startsWith('type-')) {
        throw new Error(`Tag "${tagSlug}" in ${pageSlug} must use the type- prefix`);
    }
    if (kind === 'category' && !tagSlug.startsWith('category-')) {
        throw new Error(`Tag "${tagSlug}" in ${pageSlug} must use the category- prefix`);
    }
    if (kind === 'series' && !tagSlug.startsWith('series-')) {
        throw new Error(`Tag "${tagSlug}" in ${pageSlug} must use the series- prefix`);
    }
    if (kind === 'topic' && SYSTEM_TAG_PREFIXES.some((prefix) => tagSlug.startsWith(prefix))) {
        throw new Error(`Topic tag "${tagSlug}" in ${pageSlug} must not use a system prefix`);
    }
}

function extractJsonTextFromHtml(html: string): string {
    const codeBlockMatch = html.match(/<pre><code(?:\s+[^>]*)?>([\s\S]*?)<\/code><\/pre>/i);
    if (codeBlockMatch?.[1]) {
        return decodeHtmlEntities(codeBlockMatch[1]).trim();
    }

    const stripped = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]*>/g, '');

    return decodeHtmlEntities(stripped).trim();
}

function parseJsonObject(value: string, source: string): Record<string, unknown> {
    if (!value) {
        throw new Error(`Tag registry page ${source} is empty`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse tag registry page ${source}: ${message}`);
    }

    if (!isRecord(parsed)) {
        throw new Error(`Tag registry page ${source} must contain a JSON object`);
    }

    return parsed;
}

function normalizeLabelMap(value: unknown, path: string): TagLabelMap {
    if (!isRecord(value)) {
        throw new Error(`${path} must be an object`);
    }

    const result: TagLabelMap = {};
    for (const locale of LOCALES) {
        const label = value[locale];
        if (typeof label === 'string' && label.trim()) {
            result[locale] = label.trim();
        }
    }

    return result;
}

function getStringProperty(value: Record<string, unknown>, key: string): string {
    const property = value[key];
    return typeof property === 'string' ? property : '';
}

function normalizeString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stripKnownTagPrefix(slug: string): string {
    return slug.replace(/^(?:type|category|series|topic)-/, '');
}

function titleCaseTag(value: string): string {
    return value
        .trim()
        .replace(/[-_]+/g, ' ')
        .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#x22;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
