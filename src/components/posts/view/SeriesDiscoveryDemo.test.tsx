// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import SeriesDiscoveryDemo from './SeriesDiscoveryDemo';

vi.mock('motion/react', async () => {
    const React = await import('react');
    type MotionProps = Record<string, unknown> & { children?: ReactNode };
    const motionOnlyProps = ['animate', 'exit', 'initial', 'layout', 'transition'];
    const createMotionElement = (tag: string) =>
        function MotionElement({ children, ...props }: MotionProps) {
            motionOnlyProps.forEach((prop) => delete props[prop]);
            return React.createElement(tag, props, children);
        };

    return {
        AnimatePresence: ({ children }: { children?: ReactNode }) => children,
        MotionConfig: ({ children }: { children?: ReactNode }) => children,
        motion: {
            article: createMotionElement('article'),
            aside: createMotionElement('aside'),
            button: createMotionElement('button'),
            ol: createMotionElement('ol'),
        },
    };
});

const DEMO_PATH = '/zh/design-demos/series-discovery';

let root: Root;

function getShell(): HTMLElement {
    return document.querySelector<HTMLElement>('.series-discovery-shell')!;
}

function getPreviewTitle(): string {
    return document.querySelector<HTMLElement>('.series-preview-card h2')!.textContent!.trim();
}

function getDirectoryTitle(): string {
    return document.querySelector<HTMLElement>('.series-directory header h2')!.textContent!.trim();
}

function getChapterNumbers(): string[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>('.series-directory ol > li > button > span')
    ).map((element) => element.textContent!.trim());
}

function getSpineTitles(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.series-spine strong')).map(
        (element) => element.textContent!.trim()
    );
}

async function renderDemo(): Promise<void> {
    await act(async () => {
        root.render(<SeriesDiscoveryDemo />);
    });
}

beforeAll(() => {
    (
        globalThis as typeof globalThis & {
            IS_REACT_ACT_ENVIRONMENT: boolean;
        }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn().mockImplementation(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        value: vi.fn(() => 1),
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
        configurable: true,
        value: vi.fn(),
    });
});

beforeEach(() => {
    window.history.replaceState(null, '', `${DEMO_PATH}?view=list`);
    document.body.innerHTML = `
        <div id="series-discovery-pagination-host"></div>
        <div id="series-discovery-root"></div>
    `;
    root = createRoot(document.getElementById('series-discovery-root')!);
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
});

describe('SeriesDiscoveryDemo', () => {
    it('renders seven peer series entries and one clickable preview without a text CTA', async () => {
        await renderDemo();

        expect(document.querySelectorAll('.series-spine')).toHaveLength(7);
        expect(document.querySelectorAll('.series-preview-card')).toHaveLength(1);
        expect(document.querySelector('.series-preview-card')?.tagName).toBe('BUTTON');
        expect(document.querySelector('.series-preview-card')?.getAttribute('aria-label')).toBe(
            '打开系列目录：家庭服务器建造志'
        );
        expect(document.body.textContent).not.toContain('打开系列目录');
        expect(getPreviewTitle()).toBe('家庭服务器建造志');
        expect(getDirectoryTitle()).toBe('家庭服务器建造志');
        expect(document.querySelector('.series-dock-pager')?.textContent).toContain('01 / 02');
    });

    it('previews series through keyboard focus and pointer hover without selecting or navigating', async () => {
        await renderDemo();
        const pathname = window.location.pathname;
        const initialDirectory = getDirectoryTitle();

        await act(async () => {
            document
                .querySelector<HTMLButtonElement>('button[aria-label="选择系列：DevOps 现场笔记"]')!
                .focus();
        });
        expect(getPreviewTitle()).toBe('DevOps 现场笔记');
        expect(getDirectoryTitle()).toBe(initialDirectory);

        await act(async () => {
            document
                .querySelector<HTMLButtonElement>('button[aria-label="选择系列：云端归档计划"]')!
                .dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
        });
        expect(getPreviewTitle()).toBe('云端归档计划');
        expect(getDirectoryTitle()).toBe(initialDirectory);
        expect(window.location.pathname).toBe(pathname);
    });

    it('moves to a complete seven-entry second Dock batch without changing the pathname', async () => {
        await renderDemo();
        const pathname = window.location.pathname;

        await act(async () => {
            document.querySelector<HTMLButtonElement>('button[aria-label="下一页系列"]')!.click();
        });

        expect(getShell().dataset.seriesPage).toBe('2');
        expect(document.querySelector('.series-dock-pager')?.textContent).toContain('02 / 02');
        expect(getPreviewTitle()).toBe('安静计算宣言');
        expect(getDirectoryTitle()).toBe('安静计算宣言');
        expect(document.querySelectorAll('.series-spine')).toHaveLength(7);
        expect(window.location.pathname).toBe(pathname);
    });

    it('opens a directory from an entry without reordering its peers and can return to the atlas', async () => {
        await renderDemo();
        const pathname = window.location.pathname;
        const spineTitles = getSpineTitles();

        await act(async () => {
            document
                .querySelector<HTMLButtonElement>('button[aria-label="选择系列：DevOps 现场笔记"]')!
                .click();
        });

        expect(getDirectoryTitle()).toBe('DevOps 现场笔记');
        expect(getPreviewTitle()).toBe('DevOps 现场笔记');
        expect(getSpineTitles()).toEqual(spineTitles);
        expect(getShell().dataset.mobileView).toBe('focus');

        await act(async () => {
            document.querySelector<HTMLButtonElement>('.series-mobile-back')!.click();
        });
        expect(getShell().dataset.mobileView).toBe('atlas');
        expect(window.location.pathname).toBe(pathname);
    });

    it('keeps absolute chapter numbers across full and partial directory pages', async () => {
        await renderDemo();

        expect(getChapterNumbers()).toEqual(['01', '02', '03', '04', '05', '06']);

        await act(async () => {
            document.querySelector<HTMLButtonElement>('button[aria-label="下一页文章"]')!.click();
        });
        expect(getChapterNumbers()).toEqual(['07', '08', '09', '10', '11', '12']);
        expect(document.querySelector('.series-chapter-pager')?.textContent).toContain('2 / 3');

        await act(async () => {
            document.querySelector<HTMLButtonElement>('button[aria-label="下一页文章"]')!.click();
        });
        expect(getChapterNumbers()).toEqual(['13', '14', '15', '16', '17']);
        expect(document.querySelector('.series-chapter-pager')?.textContent).toContain('3 / 3');
        expect(
            document.querySelector<HTMLButtonElement>('button[aria-label="下一页文章"]')?.disabled
        ).toBe(true);
    });

    it('opens the previewed series by clicking the large preview card', async () => {
        await renderDemo();
        const pathname = window.location.pathname;

        expect(getShell().dataset.mobileView).toBe('atlas');

        await act(async () => {
            document
                .querySelector<HTMLButtonElement>('button[aria-label="选择系列：DevOps 现场笔记"]')!
                .focus();
        });
        expect(getPreviewTitle()).toBe('DevOps 现场笔记');
        expect(getDirectoryTitle()).toBe('家庭服务器建造志');
        expect(getShell().dataset.mobileView).toBe('atlas');

        await act(async () => {
            document
                .querySelector<HTMLButtonElement>(
                    'button[aria-label="打开系列目录：DevOps 现场笔记"]'
                )!
                .click();
        });
        expect(getDirectoryTitle()).toBe('DevOps 现场笔记');
        expect(getShell().dataset.mobileView).toBe('focus');

        await act(async () => {
            document.querySelector<HTMLButtonElement>('.series-mobile-back')!.click();
        });
        expect(getShell().dataset.mobileView).toBe('atlas');
        expect(window.location.pathname).toBe(pathname);
    });
});
