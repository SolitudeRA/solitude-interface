// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { extractDomains } from './src/api/utils/url';

// Astro 配置求值早于 env schema 注入；显式读取 env 文件，确保远程 Ghost 图片能够进入
// Sharp 构建期优化，而不是因 allowlist 为空退化为原图直出。
const fileEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const imageDomains = extractDomains(
    process.env.GHOST_URL ?? fileEnv.GHOST_URL,
    process.env.IMAGE_HOST_URL ?? fileEnv.IMAGE_HOST_URL
);
const siteUrl = process.env.SITE_URL ?? fileEnv.SITE_URL;

// https://astro.build/config
export default defineConfig({
    ...(siteUrl ? { site: siteUrl } : {}),
    devToolbar: {
        enabled: false,
    },

    env: {
        schema: {
            GHOST_URL: envField.string({ context: 'server', access: 'public' }),
            GHOST_CONTENT_KEY: envField.string({
                context: 'server',
                access: 'secret',
            }),
            GHOST_VERSION: envField.string({
                context: 'server',
                access: 'public',
                default: 'v5.0',
            }),
            GHOST_TIMEOUT: envField.number({
                context: 'server',
                access: 'public',
                default: 5000,
            }),
            SITE_URL: envField.string({ context: 'server', access: 'public' }),
            IMAGE_HOST_URL: envField.string({
                context: 'server',
                access: 'public',
                optional: true,
                default: '',
            }),
            GOOGLE_ANALYTICS_TAG_ID: envField.string({
                context: 'client',
                access: 'public',
                optional: true,
                default: '',
            }),
            CF_ACCESS_CLIENT_ID: envField.string({
                context: 'server',
                access: 'secret',
                optional: true,
                default: '',
            }),
            CF_ACCESS_CLIENT_SECRET: envField.string({
                context: 'server',
                access: 'secret',
                optional: true,
                default: '',
            }),
        },
    },

    i18n: {
        // 语言集合的单一真源是 src/lib/i18n.ts 的 LOCALES；此处顺序仅用于路由前缀、
        // 对生成站点无可观察影响，但与 LOCALES 保持一致以免困惑。
        locales: ['zh', 'ja', 'en'],
        defaultLocale: 'zh',
        routing: {
            prefixDefaultLocale: true,
        },
    },

    prefetch: {
        prefetchAll: false,
        defaultStrategy: 'hover',
    },
    integrations: [react()],

    image: {
        domains: imageDomains,
    },

    vite: {
        resolve: {
            dedupe: ['react', 'react-dom'],
        },
        plugins: [tailwindcss()],
    },
});
