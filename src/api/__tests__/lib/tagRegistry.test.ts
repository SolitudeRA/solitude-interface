import { describe, expect, it } from 'vitest';
import {
    getTagDescription,
    getTagLabel,
    mergeTagRegistryPages,
    parseTagRegistryPage,
    type TagRegistryPage,
} from '@lib/tagRegistry';

describe('tagRegistry', () => {
    it('should parse registry JSON from a Ghost code block page', () => {
        const page = parseTagRegistryPage({
            slug: 'tag-registry-series',
            html: `<pre><code class="language-json">{
  &quot;version&quot;: 1,
  &quot;kind&quot;: &quot;series&quot;,
  &quot;tags&quot;: {
    &quot;series-homeserver&quot;: {
      &quot;label&quot;: {
        &quot;zh&quot;: &quot;家用服务器完整构建指南&quot;,
        &quot;ja&quot;: &quot;ホームサーバー完全構築ガイド&quot;,
        &quot;en&quot;: &quot;Homeserver Complete Build Guide&quot;
      },
      &quot;description&quot;: {
        &quot;zh&quot;: &quot;从硬件选型到长期维护。&quot;,
        &quot;en&quot;: &quot;From hardware choices to long-term maintenance.&quot;
      },
      &quot;order&quot;: 10
    }
  }
}</code></pre>`,
        });

        expect(page.kind).toBe('series');
        expect(page.tags['series-homeserver']?.label.zh).toBe('家用服务器完整构建指南');
        expect(page.tags['series-homeserver']?.description?.zh).toBe('从硬件选型到长期维护。');
        expect(page.tags['series-homeserver']?.order).toBe(10);
    });

    it('should fallback from locale label to default label, Ghost name, then slug title case', () => {
        const registry = {
            'topic-devops': {
                kind: 'topic' as const,
                label: {
                    zh: 'DevOps',
                },
            },
        };

        expect(getTagLabel('topic-devops', 'en', 'DevOps Topic', registry)).toBe('DevOps');
        expect(getTagLabel('topic-missing', 'ja', 'Readable Name', registry)).toBe('Readable Name');
        expect(getTagLabel('topic-home-automation', 'ja', undefined, registry)).toBe(
            'Home Automation'
        );
    });

    it('should localize a series description with the default locale as fallback', () => {
        const registry = {
            'series-homeserver': {
                kind: 'series' as const,
                label: { zh: '家庭服务器' },
                description: {
                    zh: '从硬件选型到长期维护。',
                    en: 'From hardware choices to long-term maintenance.',
                },
                order: 10,
            },
        };

        expect(getTagDescription('series-homeserver', 'en', registry)).toBe(
            'From hardware choices to long-term maintenance.'
        );
        expect(getTagDescription('series-homeserver', 'ja', registry)).toBe(
            '从硬件选型到长期维护。'
        );
        expect(getTagDescription('series-missing', 'zh', registry)).toBe('');
    });

    it('should reject kind mismatches', () => {
        expect(() =>
            parseTagRegistryPage({
                slug: 'tag-registry-category',
                html: JSON.stringify({
                    version: 1,
                    kind: 'series',
                    tags: {},
                }),
            })
        ).toThrow('must declare kind "category"');
    });

    it('should reject duplicate tag slugs across registry pages', () => {
        const firstPage: TagRegistryPage = {
            slug: 'tag-registry-topic',
            kind: 'topic',
            tags: {
                'topic-devops': {
                    kind: 'topic',
                    label: { zh: 'DevOps' },
                },
            },
        };
        const secondPage: TagRegistryPage = {
            slug: 'tag-registry-topic-copy',
            kind: 'topic',
            tags: {
                'topic-devops': {
                    kind: 'topic',
                    label: { en: 'DevOps' },
                },
            },
        };

        expect(() => mergeTagRegistryPages([firstPage, secondPage])).toThrow(
            'Duplicate tag registry entry'
        );
    });

    it('should reject system prefixes in topic registry entries', () => {
        expect(() =>
            parseTagRegistryPage({
                slug: 'tag-registry-topic',
                html: JSON.stringify({
                    version: 1,
                    kind: 'topic',
                    tags: {
                        'category-tech': {
                            label: { zh: '技术' },
                        },
                    },
                }),
            })
        ).toThrow('must not use a system prefix');
    });
});
