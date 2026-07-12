# 项目架构设计

本文档详细描述 Solitude Interface 的架构设计、数据流向和核心模块实现。

## 📐 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Astro SSG 构建层                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  pages/     │  │  layouts/   │  │ components/ │              │
│  │  (路由)     │  │  (布局)     │  │  (UI组件)   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    API 层 (src/api/)                       │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │ ghost/  │  │ adapters │  │ clients │  │   utils/    │  │  │
│  │  │ posts   │──│  ghost   │──│  ghost  │──│ cache/error │  │  │
│  │  │settings │  └──────────┘  └─────────┘  └─────────────┘  │  │
│  │  └─────────┘                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           ▼
              ┌─────────────────────────┐
              │     Ghost CMS API       │
              │   (Content API v5.0)    │
              └─────────────────────────┘
```

---

## 🔄 数据流向

### 构建时数据获取流程

```
1. Astro 页面请求数据
   └─> src/pages/[lang]/index.astro
       └─> getStaticPaths()

2. 调用 Ghost API 模块
   └─> src/api/ghost/posts.ts
       └─> getPosts({ filter: 'tag:hash-lang-zh' })

3. Ghost 客户端发起请求
   └─> src/api/clients/ghost.ts
       └─> axios.get('/posts', { params })

4. 缓存检查 (命中则返回缓存)
   └─> src/api/utils/cache.ts
       └─> getFromCache(key) || fetchAndCache()

5. 数据适配转换
   └─> src/api/adapters/ghost.ts
       └─> adaptGhostPost(rawPost)
           ├─> 提取标签信息 (type, category, series)
           └─> 转换 URL 格式

6. 返回处理后的数据给页面
```

### 客户端交互流程

```
常规岛组件交互
用户交互 → React 组件 → Jotai Store / 组件局部状态 → UI 更新

跨页面导航
用户点击链接 → Astro ClientRouter → 导航动效内核 → 文档交换
                                      ├─ 路由与视图状态
                                      ├─ View Transition 命名
                                      └─ 返回位置恢复
```

> 注：主题切换不经 Jotai，由 `ThemeSwitch.astro` 的内联脚本直接读写 `localStorage['theme']`
> 并派发 `themeChanged` 事件（在绘制前设置 `<html>` class，避免 FOUC）。
>
> 导航状态也不进入 Jotai。可分享、可回退的状态保存在 URL；只服务于一次详情往返的文章路径、
> 返回 URL 和滚动位置保存在 `sessionStorage`。

---

## 📦 核心模块详解

### 1. API 层 (`src/api/`)

#### 模块结构

```
api/
├── config/env.ts       # 环境变量配置 (Ghost URL, API Key 等)
├── clients/ghost.ts    # Axios 客户端实例
├── ghost/
│   ├── posts.ts        # 文章相关 API
│   ├── settings.ts     # 站点设置 API
│   └── types.ts        # Ghost 数据类型定义
├── adapters/ghost.ts   # 数据转换器
└── utils/
    ├── cache.ts        # 请求缓存
    └── errorHandlers.ts # 错误处理
```

#### 关键函数

```typescript
// src/api/ghost/posts.ts
export async function getPosts(options?: GetPostsOptions): Promise<Post[]>;
export async function getPostBySlug(slug: string): Promise<Post | null>;
export async function getFeaturedPosts(): Promise<FeaturedPost[]>;

// src/api/ghost/settings.ts
export async function getSiteSettings(): Promise<SiteSettings>;
```

#### 适配器逻辑

```typescript
// src/api/adapters/ghost.ts
// 标签前缀定义
const TAG_PREFIXES = {
    TYPE: 'type-', // 文章类型: type-article, type-gallery
    CATEGORY: 'category-', // 分类: category-tech
    SERIES: 'series-', // 系列: series-astro-tutorial
};

// 从 Ghost 原始数据转换为前端格式
export function adaptGhostPost(post: GhostPost): Post {
    return {
        ...post,
        url: convertToFrontendUrl(post.id),
        post_type: extractTagValue(post.tags, 'TYPE'),
        post_category: extractTagValue(post.tags, 'CATEGORY'),
        post_series: extractTagValue(post.tags, 'SERIES'),
        post_general_tags: extractGeneralTags(post.tags),
    };
}
```

---

### 2. 多语言系统 (`src/lib/i18n.ts`)

#### 核心概念

```
Ghost 内部标签 (Internal Tags)
    #lang-zh  →  API slug: hash-lang-zh
    #i18n-key →  API slug: hash-i18n-key

URL 路由结构
    /{locale}/           → 文章列表页
    /{locale}/p/{key}    → 文章详情页
```

#### 关键函数

```typescript
// 语言配置
export const LOCALES = ['zh', 'ja', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'zh';

// 语言提取
export function extractLocaleFromTags(tags: PostTag[]): Locale | null;
export function extractI18nKey(tags: PostTag[]): string | null;

// 多语言文章过滤
export function filterPostsByLocale<T>(posts: T[], currentLocale: Locale): LocalizedPost<T>[];
```

#### 多语言文章过滤逻辑

```
输入: 所有文章 + 当前语言
处理:
  1. 按 i18n key 分组文章
  2. 每组优先选择当前语言版本
  3. 无当前语言版本时，选择 fallback 版本
  4. 按发布日期排序
输出: 去重后的文章列表 + fallback 标记
```

---

### 3. 组件架构 (`src/components/`)

#### 组件分层

```
components/
├── common/          # 基础 UI 组件 (无业务逻辑)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
├── layout/          # 布局组件
│   ├── navbar/      # 导航栏
│   └── dock/        # 底部工具栏
├── posts/           # 文章相关组件
│   ├── view/        # 文章列表视图
│   └── detail/      # 文章详情视图
└── pages/           # 页面专用组件
    ├── about/
    └── contact/
```

#### Astro vs React 组件选择

| 组件类型 | 文件格式        | 使用场景                               |
| -------- | --------------- | -------------------------------------- |
| 静态布局 | `.astro`        | Navbar, Footer, PageHero               |
| 交互组件 | `.tsx`          | ThemeSwitch, Carousel, ScrollContainer |
| 混合组件 | `.astro` + slot | 布局包裹交互内容                       |

---

### 4. 状态管理 (`src/stores/`)

#### Jotai Atoms

```typescript
// 注意：主题切换不经 Jotai，由 ThemeSwitch.astro 的内联脚本直接读写
// localStorage['theme'] 并派发 themeChanged 事件（避免 FOUC）。

// src/stores/postViewAtom.ts
// 文章视图状态
export const postViewAtom = atom<PostViewState>({
    totalPosts: 0,
    visibleIndices: [],
    activeIndex: 0,
    postDates: [],
});

// 跨组件通信: 时间线 → 滚动容器
export const scrollToPostAtom = atom<number | null>(null);
```

#### 状态流向

```
用户点击时间线节点
    ↓
DockTimelineMain.tsx
    ↓ setScrollToPostRequest(index)
scrollToPostAtom 更新
    ↓
PostViewScrollContainer.tsx (监听)
    ↓ scrollToPost(index)
滚动到对应文章
```

---

### 5. 样式系统 (`src/styles/`)

#### 样式层级

```
styles/
├── index.css              # 入口 (导入所有样式)
├── tailwind-settings.css  # Tailwind 配置
├── theme.css              # 主题变量 (CSS 自定义属性)
├── components/
│   ├── navbar.css
│   └── article/           # 文章样式
│       ├── article-content.css
│       ├── article-layout.css
│       └── article-toc.css
└── utilities/
    └── text-utilities.css
```

#### 主题系统

```css
/* src/styles/theme.css */
:root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    /* ... */
}

.dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    /* ... */
}
```

---

### 6. 客户端导航与动效内核 (`src/lib/navigation/`)

#### 架构决策（2026-07-12）

项目继续采用 **Astro SSG + React islands + Astro ClientRouter**，不为了页面转场引入完整 SPA
框架。页面内容仍由 Astro 在构建期生成，ClientRouter 负责同站文档交换，项目内的轻量导航内核只负责
路由判定、转场协调和短期状态恢复。

引入完整 SPA 框架会扩大 hydration、客户端路由和数据加载的责任范围，但目前站点的主要数据仍来自
构建期 Ghost 内容，交互集中在少量岛组件。动画需求本身不足以抵消这部分复杂度与运行时成本。

#### 模块边界

```text
BaseLayout.astro
└─ Astro ClientRouter
   └─ transitionCoordinator.ts       # 唯一的跨页面 Astro 生命周期协调器
      ├─ routeModel.ts                # 路径和精选/全部视图的纯函数
      ├─ navigationState.ts           # sessionStorage 的类型安全访问
      └─ transitionRegistry.ts        # 允许使用的页面转场名称

post-view.astro
├─ postViewModeController.ts          # 精选/全部 URL、DOM 和浏览器历史同步
├─ postViewScrollFallback.ts          # 横向滚轮的渐进增强
└─ PostArchiveView.tsx                # 全部页面的状态与 Portal 编排
   ├─ PostArchiveControls.tsx         # 布局、分类、搜索、分页控件
   ├─ PostArchiveLayouts.tsx          # 编辑目录、系列书库、年代分栏
   └─ postArchive.ts                  # URL 序列化、标签与归档分组纯逻辑
```

#### 必须保持的导航契约

1. 每个浏览器窗口只注册一组全局 Astro 生命周期监听器；页面交换后只重新绑定新 DOM。
2. 可分享、可前进后退的状态写入 URL；单次详情往返状态才写入 `sessionStorage`。
3. 展示组件不得直接读写 `window.history`、`sessionStorage` 或 Astro 生命周期事件。
4. 转场名称必须来自 `transitionRegistry.ts`，并在完成、取消或失败后清理。
5. 返回文章列表时，在绘制前恢复视图、原文章目标和横向滚动位置。
6. `prefers-reduced-motion` 和缺少 Web Animations API 的环境必须能够无动画降级。
7. 非文章路由不得绑定文章视图控件或写入 `data-post-view-mode`。

这些契约由 `transitionCoordinator.test.ts` 和 `postViewModeController.test.ts` 通过 jsdom 驱动真实
DOM、History API、sessionStorage 与 Astro 生命周期事件验证；路由、状态和转场注册表仍使用快速纯函数
单测。

#### 何时重新评估完整 SPA 框架

只有出现以下一项或多项长期需求时，才重新评估 React Router、TanStack Router 等客户端应用基建：

- 多个核心路由需要客户端数据获取、写操作、缓存失效和乐观更新；
- 跨路由存在大量必须常驻的应用级状态，URL 与短期会话状态已无法清晰表达；
- 嵌套路由、共享 loader、权限守卫成为主要复杂度来源；
- Astro 文档交换本身导致多个页面重复实现同一套生命周期协调器。

仅增加新的页面动画、共享元素转场或局部筛选模式，不构成引入完整 SPA 框架的理由。

---

## 🔧 扩展指南

### 添加新的文章类型

1. 在 Ghost 中创建新标签: `type-newtype`
2. 在 `src/components/posts/view/cards/` 添加新卡片组件
3. 在 `PostViewContainer.astro` 中添加类型判断

### 添加新语言

1. 在 `src/lib/i18n.ts` 的 `LOCALES` 数组添加语言代码
2. 在 `LOCALE_NAMES` 和 `LOCALE_HTML_LANG` 添加映射
3. 在 `astro.config.mjs` 的 `i18n.locales` 添加语言
4. 在 Ghost 中使用 `#lang-{newlocale}` 标签

### 添加新 API 端点

1. 在 `src/api/ghost/` 创建新模块
2. 定义类型到 `types.ts`
3. 实现数据获取函数
4. 在需要时添加适配器转换

---

## 📊 性能考量

### 缓存策略

- 构建时: Ghost API 响应缓存 (内存缓存)
- 运行时: 静态生成的 HTML，无服务端请求

### 代码分割

- Astro 自动分割每个页面
- React 组件按需 hydration (`client:load`, `client:visible`)

### 图片优化

- 使用 Astro Image 组件
- 远程图片域名白名单配置

---

## 🧪 测试策略

| 测试类型   | 覆盖范围                                   | 命令                    |
| ---------- | ------------------------------------------ | ----------------------- |
| 单元测试   | 适配器、工具函数、i18n、路由与归档纯逻辑   | `pnpm test:unit`        |
| 运行时契约 | DOM、History API、Astro 生命周期与状态恢复 | `pnpm test:run`         |
| 集成测试   | Ghost API 调用、数据流                     | `pnpm test:integration` |

### 测试文件命名

- 单元测试: `*.test.ts`
- 集成测试: `*.integration.test.ts`
