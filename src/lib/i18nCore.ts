import type { PostTag } from '@api/ghost/types';

/**
 * i18n 核心:语言集合、UI 文案、tag/slug 身份解析。
 * 这是叶子模块(不依赖 routing/filtering),供 i18nRouting / i18nFiltering 复用,
 * 并经 i18n.ts(barrel)统一再导出。
 */

/**
 * 支持的语言列表。
 *
 * ⚠️ 数组顺序是 load-bearing：getPostWithFallback 在请求语言与默认语言(zh)都缺失时，
 * 按此顺序选取「任意可用变体」(故 zh 缺失时 ja 优先于 en)。这里是语言集合的单一真源；
 * astro.config.mjs 的 i18n.locales 仅用于路由前缀，但两处的语言集合必须保持一致。
 */
export const LOCALES = ['zh', 'ja', 'en'] as const;

/**
 * 语言类型
 */
export type Locale = (typeof LOCALES)[number];

/**
 * 默认语言
 */
export const DEFAULT_LOCALE: Locale = 'zh';

/**
 * 术语表(读本文件前先对齐词汇,避免 locale/lang 混淆):
 * - `Locale`        内部语言代码:'zh' | 'ja' | 'en'(本系统的语言单一真源)
 * - lang tag slug   Ghost 语言标签 slug:`hash-lang-{locale}`(如 hash-lang-ja),标「这篇是哪种语言」
 * - i18n tag slug   Ghost 翻译组标签 slug:`hash-i18n-{key}`(如 hash-i18n-homeserver),标「这几篇是同一篇的不同语言」
 * - i18nKey         翻译组 key(去前缀后的 {key}),跨语言文章的共同标识
 * - HTML lang       BCP-47 文档语言(见 LOCALE_HTML_LANG,如 'zh-CN'),仅用于 <html lang>
 * 约定:`locale` 始终指 `Locale`;涉及 Ghost slug 一律带 "tag/slug" 字样区分。
 */

/**
 * Ghost internal tag 前缀
 * Ghost Content API 中 internal tag (#xxx) 的 slug 会变成 hash-xxx
 */
const LANG_TAG_PREFIX = 'hash-lang-';
const I18N_TAG_PREFIX = 'hash-i18n-';

/**
 * 语言名称映射（用于 UI 显示）
 */
export const LOCALE_NAMES: Record<Locale, string> = {
    zh: '中文',
    ja: '日本語',
    en: 'English',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
    zh: '🇨🇳',
    ja: '🇯🇵',
    en: '🇺🇸',
};

/**
 * 语言 HTML lang 属性映射
 */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
    zh: 'zh-CN',
    ja: 'ja',
    en: 'en',
};

/**
 * UI 文本翻译字典
 */
export const UI_TEXTS = {
    home: {
        viewAllPosts: {
            zh: '查看全部文章',
            ja: 'すべての記事を見る',
            en: 'View All Posts',
        },
        exploreMore: {
            zh: '探索更多内容',
            ja: 'もっと探索する',
            en: 'Explore more content',
        },
        noPosts: {
            zh: '暂无文章',
            ja: '記事はまだありません',
            en: 'No posts yet',
        },
    },
    postView: {
        galleryView: {
            zh: '精选',
            ja: '注目',
            en: 'Featured',
        },
        listView: {
            zh: '全部',
            ja: 'すべて',
            en: 'All',
        },
        viewAll: {
            zh: '查看全部 {total} 篇',
            ja: 'すべて見る（{total} 件）',
            en: 'View all {total}',
        },
        category: {
            zh: '分类',
            ja: 'カテゴリ',
            en: 'Category',
        },
        type: {
            zh: '类型',
            ja: 'タイプ',
            en: 'Type',
        },
        all: {
            zh: '全部',
            ja: 'すべて',
            en: 'All',
        },
        searchPlaceholder: {
            zh: '搜索标题或摘要',
            ja: 'タイトル・抜粋を検索',
            en: 'Search title or excerpt',
        },
        clear: {
            zh: '清除筛选',
            ja: 'フィルターをクリア',
            en: 'Clear filters',
        },
        resultCount: {
            zh: '共 {total} 篇 · 匹配 {count} 篇',
            ja: '全 {total} 件 · 該当 {count} 件',
            en: '{count} of {total} posts',
        },
        empty: {
            zh: '没有匹配的文章，试试清除筛选',
            ja: '該当する記事がありません。フィルターをクリアしてみてください',
            en: 'No posts match your filters — try clearing them',
        },
        prevPage: {
            zh: '上一页',
            ja: '前のページ',
            en: 'Previous page',
        },
        nextPage: {
            zh: '下一页',
            ja: '次のページ',
            en: 'Next page',
        },
        archiveView: {
            zh: '归档方式',
            ja: 'アーカイブ表示',
            en: 'Archive view',
        },
        archiveLedger: {
            zh: '编辑目录',
            ja: '編集目録',
            en: 'Editorial ledger',
        },
        archiveSeries: {
            zh: '系列书架',
            ja: 'シリーズ棚',
            en: 'Series shelf',
        },
        archiveYears: {
            zh: '年代分栏',
            ja: '年代別カラム',
            en: 'Year columns',
        },
        archiveLedgerDescription: {
            zh: '按时间快速扫描完整目录，封面只承担辅助预览。',
            ja: '全記事を時系列で素早く確認し、カバーは補助プレビューに留めます。',
            en: 'Scan the complete chronology; covers remain a supporting preview.',
        },
        archiveSeriesDescription: {
            zh: '按系列组织文章，优先呈现内容之间的连续关系。',
            ja: '記事をシリーズで整理し、内容のつながりを優先します。',
            en: 'Organize posts by series and foreground their reading relationships.',
        },
        archiveYearsDescription: {
            zh: '每个年份是一章，横向回溯不同阶段的写作。',
            ja: '年ごとに章を分け、執筆の変化を横方向にたどります。',
            en: 'Treat each year as a chapter and move across the writing timeline.',
        },
        standalonePosts: {
            zh: '独立文章',
            ja: '単独記事',
            en: 'Standalone posts',
        },
        articleCount: {
            zh: '{count} 篇',
            ja: '{count} 件',
            en: '{count} posts',
        },
    },
    nav: {
        home: {
            zh: '首页',
            ja: 'ホーム',
            en: 'Home',
        },
        posts: {
            zh: '文章',
            ja: '記事',
            en: 'Posts',
        },
        about: {
            zh: '关于',
            ja: 'プロフィール',
            en: 'About',
        },
        aboutMe: {
            zh: '关于我',
            ja: 'プロフィール',
            en: 'About Me',
        },
        contact: {
            zh: '联系',
            ja: '連絡先',
            en: 'Contact',
        },
        privacy: {
            zh: '隐私',
            ja: 'プライバシー',
            en: 'Privacy',
        },
        privacyPolicy: {
            zh: '隐私政策',
            ja: 'プライバシーポリシー',
            en: 'Privacy Policy',
        },
    },
    rss: {
        label: {
            zh: 'RSS',
            ja: 'RSS',
            en: 'RSS',
        },
        allLanguages: {
            zh: '全部语言',
            ja: 'すべての言語',
            en: 'All Languages',
        },
        current: {
            zh: '当前',
            ja: '現在',
            en: 'Current',
        },
    },
} as const;

/**
 * 获取 UI 翻译文本
 * @param section 文本分组 (如 'home')
 * @param key 文本键名
 * @param locale 目标语言
 * @returns 翻译后的文本
 */
export function getUIText<S extends keyof typeof UI_TEXTS>(
    section: S,
    key: keyof (typeof UI_TEXTS)[S],
    locale: Locale
): string {
    const texts = UI_TEXTS[section][key] as Record<Locale, string>;
    return texts[locale] ?? texts[DEFAULT_LOCALE];
}

/**
 * 检查是否为有效的语言代码
 */
export function isLocale(x: unknown): x is Locale {
    return typeof x === 'string' && LOCALES.includes(x as Locale);
}

/**
 * 将语言代码转换为 Ghost tag slug 格式
 * @example localeToLangTag('en') => 'hash-lang-en'
 */
export function localeToLangTag(locale: Locale): string {
    return `${LANG_TAG_PREFIX}${locale}`;
}

/**
 * 将翻译组 key 转换为 Ghost tag slug 格式
 * @example i18nKeyToTag('intro-to-solitude') => 'hash-i18n-intro-to-solitude'
 */
export function i18nKeyToTag(key: string): string {
    return `${I18N_TAG_PREFIX}${key}`;
}

/**
 * 从 Ghost tag slug 中提取语言代码
 * @example extractLocaleFromTagSlug('hash-lang-ja') => 'ja'
 */
export function extractLocaleFromTagSlug(slug: string): Locale | null {
    if (!slug.startsWith(LANG_TAG_PREFIX)) {
        return null;
    }
    const locale = slug.replace(LANG_TAG_PREFIX, '');
    return isLocale(locale) ? locale : null;
}

/**
 * 从 Ghost tag slug 中提取翻译组 key
 * @example extractI18nKeyFromTagSlug('hash-i18n-intro-to-solitude') => 'intro-to-solitude'
 */
export function extractI18nKeyFromTagSlug(slug: string): string | null {
    if (!slug.startsWith(I18N_TAG_PREFIX)) {
        return null;
    }
    return slug.replace(I18N_TAG_PREFIX, '');
}

export interface PostIdentitySource {
    slug?: string | null;
    tags?: PostTag[];
}

export interface PostSlugIdentity {
    locale: Locale;
    i18nKey: string;
}

/**
 * 从 Ghost post slug 中提取文章身份。
 * 约定：`{locale}-{key}`，例如 ja-homeserver-8 -> locale=ja, i18nKey=homeserver-8。
 *
 * ⚠️ 取舍（有意设计）：`zh-` / `ja-` / `en-` 是**保留 slug 前缀**。任何以合法语言代码加连字符
 * 开头的 slug 都会被解析为该语言的多语言文章——即使它没有 #lang-* / #i18n-* 标签。因此普通
 * （非多语言）文章不应使用以语言代码开头的 slug，否则会被误并入翻译组、生成错误的
 * /{locale}/p/{key} 路由。该保留命名空间约定见 docs/i18n/README，并由 i18n.test.ts 钉住。
 */
export function extractPostSlugIdentity(slug: string | null | undefined): PostSlugIdentity | null {
    const normalizedSlug = slug?.trim().toLowerCase();
    if (!normalizedSlug) {
        return null;
    }

    const [localeCandidate, ...keyParts] = normalizedSlug.split('-');
    if (!isLocale(localeCandidate) || keyParts.length === 0) {
        return null;
    }

    const i18nKey = keyParts.join('-');
    return i18nKey ? { locale: localeCandidate, i18nKey } : null;
}

/**
 * 从文章的 tags 数组中提取语言代码
 */
export function extractLocaleFromTags(tags: PostTag[] | undefined): Locale | null {
    if (!tags?.length) {
        return null;
    }

    for (const tag of tags) {
        const locale = extractLocaleFromTagSlug(tag.slug);
        if (locale) {
            return locale;
        }
    }

    return null;
}

/**
 * 从 Ghost post slug 中提取语言代码。
 */
export function extractLocaleFromPostSlug(slug: string | null | undefined): Locale | null {
    return extractPostSlugIdentity(slug)?.locale ?? null;
}

/**
 * 从文章的 tags 数组中提取翻译组 key
 */
export function extractI18nKey(tags: PostTag[] | undefined): string | null {
    if (!tags?.length) {
        return null;
    }

    for (const tag of tags) {
        const key = extractI18nKeyFromTagSlug(tag.slug);
        if (key) {
            return key;
        }
    }

    return null;
}

/**
 * 从 Ghost post slug 中提取跨语言文章 key。
 */
export function extractI18nKeyFromPostSlug(slug: string | null | undefined): string | null {
    return extractPostSlugIdentity(slug)?.i18nKey ?? null;
}

/**
 * 获取文章语言。语言 tag 仍是主来源，slug 里的语言只作为 fallback。
 */
export function extractLocaleFromPost(post: PostIdentitySource): Locale | null {
    return extractLocaleFromTags(post.tags) ?? extractLocaleFromPostSlug(post.slug);
}

/**
 * 获取跨语言文章 key。新格式优先从 Ghost slug 解析，旧 #i18n-* tag 作为兼容 fallback。
 */
export function extractI18nKeyFromPost(post: PostIdentitySource): string | null {
    return extractI18nKeyFromPostSlug(post.slug) ?? extractI18nKey(post.tags);
}
