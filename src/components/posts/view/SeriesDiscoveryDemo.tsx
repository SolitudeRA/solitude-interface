import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, MotionConfig, type MotionStyle } from 'motion/react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock3,
} from 'lucide-react';

interface Chapter {
    id: string;
    title: string;
    publishedAt: string;
    readTime: number;
}

interface SeriesEntry {
    id: string;
    title: string;
    eyebrow: string;
    description: string;
    status: '连载中' | '已完结';
    updatedAt: string;
    hue: number;
    coverUrl: string;
    chapters: Chapter[];
}

const SERIES_PER_PAGE = 7;
const CHAPTERS_PER_PAGE = 6;
const SERIES_COVERS = [
    'https://ghost.solitudera.com/content/images/2026/01/91719981_p0.jpg',
    'https://ghost.solitudera.com/content/images/2026/01/77734148_p0.jpg',
    'https://ghost.solitudera.com/content/images/2026/01/82937235_p0.jpg',
    'https://ghost.solitudera.com/content/images/2026/01/78296349_p0.jpg',
    'https://ghost.solitudera.com/content/images/2026/01/110239446_p0.jpg',
    'https://ghost.solitudera.com/content/images/2026/01/69660140_p0.jpg',
    'https://ghost.solitudera.com/content/images/2026/01/57793944_p0.png',
    'https://ghost.solitudera.com/content/images/2026/01/92191625_p1.png',
    'https://ghost.solitudera.com/content/images/2026/01/65818649_p0.jpg',
    'https://ghost.solitudera.com/content/images/2026/01/64710934_p0.jpg',
] as const;

const SERIES_BLUEPRINTS = [
    [
        'home-lab',
        '家庭服务器建造志',
        'HOME LAB',
        '从第一块硬盘开始，搭建一套真正属于自己的数字生活基础设施。',
        17,
        222,
    ],
    [
        'devops-field-notes',
        'DevOps 现场笔记',
        'DEVOPS',
        '把部署、监控与故障复盘写成可以重复使用的工程经验。',
        13,
        276,
    ],
    [
        'cloud-archive',
        '云端归档计划',
        'CLOUD',
        '重新审视照片、文档和记忆在不同介质之间的长期保存方式。',
        11,
        196,
    ],
    [
        'interface-observatory',
        '界面观察所',
        'DESIGN',
        '记录那些让数字产品显得自然、安静而可信的细节。',
        9,
        318,
    ],
    [
        'network-border',
        '家庭网络边界',
        'NETWORK',
        '从路由、隧道到访问控制，理解家庭网络真正的边界。',
        15,
        166,
    ],
    [
        'writing-system',
        '写作系统实验',
        'WORKFLOW',
        '让灵感、资料与发布流程形成一条不会打断思考的路径。',
        8,
        42,
    ],
    [
        'self-hosted-map',
        '自托管服务地图',
        'SELF HOSTED',
        '寻找那些值得长期运行、也值得自己掌控的开源服务。',
        14,
        252,
    ],
    [
        'quiet-computing',
        '安静计算宣言',
        'ESSAY',
        '讨论性能之外的计算体验：节制、可理解与长久使用。',
        7,
        92,
    ],
    [
        'game-culture',
        '游戏与世界构造',
        'CULTURE',
        '从系统、叙事与社区观察虚拟世界为何令人停留。',
        12,
        352,
    ],
    [
        'ai-practice',
        'AI 协作实践录',
        'AI',
        '把模型从新奇工具变成可靠协作者时遇到的真实问题。',
        16,
        286,
    ],
    [
        'open-source-life',
        '开源生活方式',
        'OPEN SOURCE',
        '不只是软件选择，也是一种理解工具、所有权与协作的方式。',
        10,
        132,
    ],
    [
        'digital-garden',
        '数字花园养成记',
        'KNOWLEDGE',
        '让零散笔记逐渐长成可以漫游、关联与继续书写的知识空间。',
        9,
        116,
    ],
    [
        'hardware-afterlife',
        '旧硬件的第二人生',
        'HARDWARE',
        '为仍然可靠的设备找到新的角色，而不是更快地替换它们。',
        8,
        24,
    ],
    [
        'small-tools',
        '小工具制作手册',
        'MAKING',
        '用足够小的软件解决具体问题，并保持它们简单、耐用。',
        11,
        72,
    ],
] as const;

const CHAPTER_SUBJECTS = [
    '问题从哪里开始',
    '第一次可用的原型',
    '重新理解边界',
    '一次意外的失败',
    '把复杂度收回来',
    '日常维护的成本',
    '被忽略的使用者',
    '第二轮架构调整',
    '性能与安静之间',
    '可以长期坚持的规则',
    '从工具回到生活',
    '阶段性的答案',
    '下一次迭代之前',
    '写给未来的注释',
    '重新开始的方式',
    '最终章：留下什么',
    '附录：完整清单',
] as const;

const SERIES: SeriesEntry[] = SERIES_BLUEPRINTS.map(
    ([id, title, eyebrow, description, count, hue], seriesIndex) => ({
        id,
        title,
        eyebrow,
        description,
        status: seriesIndex % 4 === 3 ? '已完结' : '连载中',
        updatedAt: `2026.${String(7 - (seriesIndex % 5)).padStart(2, '0')}.${String(
            18 - (seriesIndex % 9)
        ).padStart(2, '0')}`,
        hue,
        coverUrl: SERIES_COVERS[seriesIndex % SERIES_COVERS.length]!,
        chapters: Array.from({ length: count }, (_, chapterIndex) => ({
            id: `${id}-${chapterIndex + 1}`,
            title:
                CHAPTER_SUBJECTS[chapterIndex % CHAPTER_SUBJECTS.length] ??
                `第 ${chapterIndex + 1} 篇`,
            publishedAt: `2026.${String(7 - (chapterIndex % 6)).padStart(2, '0')}.${String(
                18 - (chapterIndex % 12)
            ).padStart(2, '0')}`,
            readTime: 5 + ((chapterIndex + seriesIndex) % 8),
        })),
    })
);

function clampPage(page: number, totalPages: number): number {
    return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

type SeriesStyle = MotionStyle & Record<'--series-hue', number>;

function seriesStyle(series: SeriesEntry): SeriesStyle {
    return { '--series-hue': series.hue };
}

export default function SeriesDiscoveryDemo() {
    const seriesTotalPages = Math.ceil(SERIES.length / SERIES_PER_PAGE);
    const [seriesPage, setSeriesPage] = useState(1);
    const visibleSeries = useMemo(
        () => SERIES.slice((seriesPage - 1) * SERIES_PER_PAGE, seriesPage * SERIES_PER_PAGE),
        [seriesPage]
    );
    const [selectedSeriesId, setSelectedSeriesId] = useState(SERIES[0]?.id ?? '');
    const [previewSeriesId, setPreviewSeriesId] = useState(SERIES[0]?.id ?? '');
    const selectedSeries =
        SERIES.find((series) => series.id === selectedSeriesId) ?? visibleSeries[0] ?? SERIES[0]!;
    const previewSeries = SERIES.find((series) => series.id === previewSeriesId) ?? selectedSeries;
    const [chapterPage, setChapterPage] = useState(1);
    const chapterTotalPages = Math.ceil(selectedSeries.chapters.length / CHAPTERS_PER_PAGE);
    const visibleChapters = useMemo(
        () =>
            selectedSeries.chapters.slice(
                (chapterPage - 1) * CHAPTERS_PER_PAGE,
                chapterPage * CHAPTERS_PER_PAGE
            ),
        [chapterPage, selectedSeries.chapters]
    );
    const [activeChapterId, setActiveChapterId] = useState(selectedSeries.chapters[0]?.id ?? '');
    const activeChapter =
        selectedSeries.chapters.find((chapter) => chapter.id === activeChapterId) ??
        visibleChapters[0] ??
        selectedSeries.chapters[0]!;
    const [dockHost, setDockHost] = useState<HTMLElement | null>(null);
    const [isMobileFocused, setIsMobileFocused] = useState(false);

    useEffect(() => {
        setDockHost(document.getElementById('series-discovery-pagination-host'));
    }, []);

    const selectSeries = (series: SeriesEntry) => {
        setSelectedSeriesId(series.id);
        setPreviewSeriesId(series.id);
        setChapterPage(1);
        setActiveChapterId(series.chapters[0]?.id ?? '');
        setIsMobileFocused(true);
    };

    const changeSeriesPage = (requestedPage: number) => {
        const page = clampPage(requestedPage, seriesTotalPages);
        if (page === seriesPage) return;
        const nextSeries = SERIES[(page - 1) * SERIES_PER_PAGE];
        setSeriesPage(page);
        if (nextSeries) selectSeries(nextSeries);
        setIsMobileFocused(false);
    };

    const changeChapterPage = (requestedPage: number) => {
        const page = clampPage(requestedPage, chapterTotalPages);
        if (page === chapterPage) return;
        const nextChapter = selectedSeries.chapters[(page - 1) * CHAPTERS_PER_PAGE];
        setChapterPage(page);
        setActiveChapterId(nextChapter?.id ?? '');
    };

    return (
        <MotionConfig reducedMotion="user">
            {dockHost &&
                createPortal(
                    <nav className="series-dock-pager" aria-label="系列总览分页">
                        <button
                            type="button"
                            aria-label="上一页系列"
                            disabled={seriesPage <= 1}
                            onClick={() => changeSeriesPage(seriesPage - 1)}
                        >
                            <ChevronLeft aria-hidden="true" />
                        </button>
                        <span aria-live="polite">
                            {String(seriesPage).padStart(2, '0')} /{' '}
                            {String(seriesTotalPages).padStart(2, '0')}
                        </span>
                        <button
                            type="button"
                            aria-label="下一页系列"
                            disabled={seriesPage >= seriesTotalPages}
                            onClick={() => changeSeriesPage(seriesPage + 1)}
                        >
                            <ChevronRight aria-hidden="true" />
                        </button>
                    </nav>,
                    dockHost
                )}

            <div className="series-discovery-viewport">
                <div
                    className="series-discovery-shell"
                    data-series-page={seriesPage}
                    data-mobile-view={isMobileFocused ? 'focus' : 'atlas'}
                >
                    <section className="series-atlas" aria-labelledby="series-atlas-title">
                        <header className="series-section-header">
                            <div>
                                <span>SERIES ATLAS · {SERIES.length} COLLECTIONS</span>
                                <h1 id="series-atlas-title">先看见整座书库，再决定从哪里出发。</h1>
                            </div>
                            <p>七个系列保持同级；悬停或聚焦看预览，点击切换文章目录。</p>
                        </header>

                        <AnimatePresence mode="wait" initial={false}>
                            <motion.button
                                type="button"
                                key={previewSeries.id}
                                className="series-preview-card"
                                style={seriesStyle(previewSeries)}
                                aria-label={`打开系列目录：${previewSeries.title}`}
                                onClick={() => selectSeries(previewSeries)}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <div className="series-preview-art" aria-hidden="true">
                                    <img
                                        src={previewSeries.coverUrl}
                                        alt=""
                                        loading="eager"
                                        decoding="async"
                                    />
                                </div>
                                <div className="series-preview-meta">
                                    <span>SERIES PREVIEW · {previewSeries.eyebrow}</span>
                                    <span>{previewSeries.status}</span>
                                </div>
                                <div className="series-preview-copy">
                                    <p>{previewSeries.description}</p>
                                    <h2>{previewSeries.title}</h2>
                                    <div>
                                        <span>{previewSeries.chapters.length} 篇</span>
                                        <span>更新于 {previewSeries.updatedAt}</span>
                                    </div>
                                </div>
                            </motion.button>
                        </AnimatePresence>

                        <div className="series-spine-grid">
                            <AnimatePresence mode="popLayout" initial={false}>
                                {visibleSeries.map((series, index) => (
                                    <motion.button
                                        layout
                                        key={series.id}
                                        type="button"
                                        style={seriesStyle(series)}
                                        className="series-spine"
                                        data-active={series.id === selectedSeries.id}
                                        data-previewed={series.id === previewSeries.id}
                                        onPointerEnter={() => setPreviewSeriesId(series.id)}
                                        onFocus={() => setPreviewSeriesId(series.id)}
                                        onClick={() => selectSeries(series)}
                                        aria-label={`选择系列：${series.title}`}
                                        aria-pressed={series.id === selectedSeries.id}
                                        initial={{ opacity: 0, y: 7 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        transition={{
                                            duration: 0.18,
                                            delay: Math.min(index, 5) * 0.018,
                                        }}
                                    >
                                        <span
                                            className="series-spine-art"
                                            aria-hidden="true"
                                        ></span>
                                        <span className="series-spine-copy">
                                            <small>{series.eyebrow}</small>
                                            <strong>{series.title}</strong>
                                            <span>
                                                {series.chapters.length} 篇 · {series.status}
                                            </span>
                                        </span>
                                        <ArrowRight aria-hidden="true" />
                                    </motion.button>
                                ))}
                            </AnimatePresence>
                        </div>
                    </section>

                    <section className="series-focus" aria-label={`${selectedSeries.title} 目录`}>
                        <div className="series-directory">
                            <header>
                                <div>
                                    <button
                                        type="button"
                                        className="series-mobile-back"
                                        onClick={() => setIsMobileFocused(false)}
                                    >
                                        <ArrowLeft aria-hidden="true" />
                                        全部系列
                                    </button>
                                    <span>NOW READING</span>
                                    <h2>{selectedSeries.title}</h2>
                                </div>
                                <div className="series-chapter-pager">
                                    <button
                                        type="button"
                                        aria-label="上一页文章"
                                        disabled={chapterPage <= 1}
                                        onClick={() => changeChapterPage(chapterPage - 1)}
                                    >
                                        <ChevronLeft aria-hidden="true" />
                                    </button>
                                    <span>
                                        {chapterPage} / {chapterTotalPages}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label="下一页文章"
                                        disabled={chapterPage >= chapterTotalPages}
                                        onClick={() => changeChapterPage(chapterPage + 1)}
                                    >
                                        <ChevronRight aria-hidden="true" />
                                    </button>
                                </div>
                            </header>

                            <AnimatePresence mode="wait" initial={false}>
                                <motion.ol
                                    key={`${selectedSeries.id}:${chapterPage}`}
                                    initial={{ opacity: 0, x: 6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -4 }}
                                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    {visibleChapters.map((chapter, index) => {
                                        const absoluteIndex =
                                            (chapterPage - 1) * CHAPTERS_PER_PAGE + index + 1;
                                        const active = chapter.id === activeChapter.id;
                                        return (
                                            <li key={chapter.id}>
                                                <button
                                                    type="button"
                                                    data-active={active}
                                                    onPointerEnter={() =>
                                                        setActiveChapterId(chapter.id)
                                                    }
                                                    onFocus={() => setActiveChapterId(chapter.id)}
                                                    onClick={() => setActiveChapterId(chapter.id)}
                                                >
                                                    <span>
                                                        {String(absoluteIndex).padStart(2, '0')}
                                                    </span>
                                                    <strong>{chapter.title}</strong>
                                                    <small>{chapter.readTime} min</small>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </motion.ol>
                            </AnimatePresence>
                        </div>

                        <AnimatePresence mode="wait" initial={false}>
                            <motion.aside
                                key={activeChapter.id}
                                className="series-reading-preview"
                                style={seriesStyle(selectedSeries)}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                            >
                                <div className="series-reading-art" aria-hidden="true">
                                    <span></span>
                                </div>
                                <div className="series-reading-topline">
                                    <BookOpen aria-hidden="true" />
                                    <span>{selectedSeries.eyebrow}</span>
                                </div>
                                <div className="series-reading-copy">
                                    <p>当前预览</p>
                                    <h3>{activeChapter.title}</h3>
                                    <div>
                                        <span>
                                            <Clock3 aria-hidden="true" />
                                            {activeChapter.readTime} 分钟
                                        </span>
                                        <span>{activeChapter.publishedAt}</span>
                                    </div>
                                    <button type="button">
                                        阅读文章
                                        <ArrowRight aria-hidden="true" />
                                    </button>
                                </div>
                                {selectedSeries.status === '已完结' && (
                                    <span className="series-complete-mark">
                                        <Check aria-hidden="true" /> 已完结
                                    </span>
                                )}
                            </motion.aside>
                        </AnimatePresence>
                    </section>
                </div>
            </div>
        </MotionConfig>
    );
}
