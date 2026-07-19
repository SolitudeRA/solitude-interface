import {
    buildPostViewPath,
    getPostViewMode,
    isPostViewMode,
    isPostViewPath,
    type PostViewMode,
} from './routeModel';

type PostViewModeWindow = Window & {
    __solitudePostViewModeReady?: boolean;
};

type ViewAnimationPhase = 'enter' | 'exit';

let viewTransitionToken = 0;

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function getCurrentView(): PostViewMode {
    return getPostViewMode(new URL(window.location.href));
}

function getMotionTarget(section: HTMLElement): HTMLElement {
    return section.querySelector<HTMLElement>('[data-view-motion-content]') ?? section;
}

function cancelViewAnimations(section: HTMLElement): void {
    section.getAnimations?.().forEach((animation) => animation.cancel());
    const target = getMotionTarget(section);
    if (target !== section) {
        target.getAnimations?.().forEach((animation) => animation.cancel());
    }
}

function moveFocusOutOfOutgoingView(outgoing: HTMLElement | undefined, view: PostViewMode): void {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || !outgoing?.contains(activeElement)) return;

    const activeToggle = Array.from(
        document.querySelectorAll<HTMLElement>('[data-view-toggle]')
    ).find((toggle) => toggle.dataset.viewToggle === view);
    activeToggle?.focus({ preventScroll: true });
}

function animateSection(section: HTMLElement, phase: ViewAnimationPhase): Animation[] {
    const isEntering = phase === 'enter';
    const duration = isEntering ? 220 : 130;
    const easing = isEntering ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.4, 0, 1, 1)';
    const target = getMotionTarget(section);
    const opacity = section.animate(
        isEntering ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        { duration, easing, fill: 'both' }
    );
    const movement = target.animate(
        isEntering
            ? [{ transform: 'translateY(8px)' }, { transform: 'translateY(0)' }]
            : [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }],
        { duration, easing, fill: 'both' }
    );

    return [opacity, movement];
}

async function waitForAnimations(animations: Animation[]): Promise<void> {
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
}

async function applyView(view: PostViewMode, animate = false): Promise<void> {
    const token = ++viewTransitionToken;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-view-section]'));
    const incoming = sections.find((section) => section.dataset.viewSection === view);
    const outgoing = sections.find(
        (section) => !section.hidden && section.dataset.viewSection !== view
    );

    document.documentElement.dataset.postViewMode = view;
    document.querySelectorAll<HTMLElement>('[data-view-toggle]').forEach((button) => {
        const active = button.dataset.viewToggle === view;
        button.dataset.active = String(active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
    });
    moveFocusOutOfOutgoingView(outgoing, view);
    window.dispatchEvent(new CustomEvent('post-view-change', { detail: { view } }));

    sections.forEach(cancelViewAnimations);

    if (!animate || reducedMotionQuery.matches || !incoming) {
        sections.forEach((section) => {
            section.hidden = section !== incoming;
        });
        delete document.documentElement.dataset.postViewTransitioning;
        return;
    }

    document.documentElement.dataset.postViewTransitioning = 'true';

    if (outgoing) {
        const exitAnimations = animateSection(outgoing, 'exit');
        await waitForAnimations(exitAnimations);
        if (token !== viewTransitionToken) return;
        outgoing.hidden = true;
        exitAnimations.forEach((animation) => animation.cancel());
    }

    incoming.hidden = false;
    const enterAnimations = animateSection(incoming, 'enter');
    await waitForAnimations(enterAnimations);
    if (token !== viewTransitionToken) return;
    enterAnimations.forEach((animation) => animation.cancel());
    delete document.documentElement.dataset.postViewTransitioning;
}

function setView(view: PostViewMode): void {
    if (getCurrentView() === view) return;
    window.history.pushState(null, '', buildPostViewPath(new URL(window.location.href), view));
    void applyView(view, true);
}

function bindViewTabKeyboard(tab: HTMLElement): void {
    if (tab.dataset.viewKeyboardBound === '1') return;
    tab.dataset.viewKeyboardBound = '1';
    tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tablist = tab.closest<HTMLElement>('[role="tablist"]');
        const tabs = Array.from(tablist?.querySelectorAll<HTMLElement>('[data-view-toggle]') ?? []);
        const currentIndex = tabs.indexOf(tab);
        if (currentIndex < 0 || tabs.length === 0) return;

        const nextIndex = (() => {
            if (event.key === 'Home') return 0;
            if (event.key === 'End') return tabs.length - 1;
            if (event.key === 'ArrowRight') return (currentIndex + 1) % tabs.length;
            return (currentIndex - 1 + tabs.length) % tabs.length;
        })();
        const nextTab = tabs[nextIndex];
        if (!nextTab) return;

        event.preventDefault();
        nextTab.focus();
        nextTab.click();
    });
}

function bindPostViewMode(): void {
    if (!isPostViewPath(window.location.pathname)) return;

    document
        .querySelectorAll<HTMLElement>('[data-view-switch], [data-view-toggle]')
        .forEach((element) => {
            if (element.dataset.viewBound === '1') return;
            element.dataset.viewBound = '1';
            if (element.dataset.viewToggle) bindViewTabKeyboard(element);
            element.addEventListener('click', (event) => {
                const target = element.dataset.viewSwitch ?? element.dataset.viewToggle ?? null;
                if (!isPostViewMode(target)) return;
                event.preventDefault();
                setView(target);
            });
        });
    void applyView(getCurrentView());
}

export function initPostViewModeController(): void {
    const postViewWindow = window as PostViewModeWindow;
    if (!postViewWindow.__solitudePostViewModeReady) {
        postViewWindow.__solitudePostViewModeReady = true;
        window.addEventListener('popstate', () => {
            if (!isPostViewPath(window.location.pathname)) return;
            const nextView = getCurrentView();
            const currentView = document.documentElement.dataset.postViewMode;
            void applyView(nextView, currentView !== nextView);
        });
        document.addEventListener('astro:page-load', bindPostViewMode);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindPostViewMode, { once: true });
    } else {
        bindPostViewMode();
    }
}
