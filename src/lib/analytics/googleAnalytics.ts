import { GOOGLE_ANALYTICS_TAG_ID } from 'astro:env/client';

const GA4_ID_PATTERN = /^G-[A-Z0-9]{10,}$/i;
const ACTIVITY_EVENTS = ['scroll', 'wheel', 'pointerdown', 'keydown', 'touchstart'] as const;
const ANALYTICS_SETTLE_DELAY = 8000;

interface AnalyticsLoader {
    load: () => void;
}

declare global {
    interface Window {
        dataLayer?: Array<IArguments | unknown[]>;
        gtag?: (...args: unknown[]) => void;
        __solitudeAnalyticsLoader?: AnalyticsLoader;
    }
}

export function initializeGoogleAnalytics() {
    const id = (GOOGLE_ANALYTICS_TAG_ID ?? '').trim();
    if (!import.meta.env.PROD || !GA4_ID_PATTERN.test(id)) return;
    if (window.__solitudeAnalyticsLoader) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
        window.gtag ||
        function () {
            window.dataLayer?.push(arguments);
        };
    window.gtag('js', new Date());
    window.gtag('config', id);

    let loaded = false;
    let idleHandle: number | null = null;
    let settleHandle: number | null = null;

    const clearSchedule = () => {
        if (idleHandle !== null) {
            window.cancelIdleCallback(idleHandle);
            idleHandle = null;
        }
        if (settleHandle !== null) {
            window.clearTimeout(settleHandle);
            settleHandle = null;
        }
    };

    const removeActivityListeners = () => {
        ACTIVITY_EVENTS.forEach((eventName) =>
            window.removeEventListener(eventName, scheduleAfterActivity, true)
        );
    };

    const load = () => {
        if (loaded) return;
        loaded = true;
        clearSchedule();
        removeActivityListeners();

        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
        script.dataset.solitudeAnalytics = 'true';
        document.head.append(script);
    };

    function scheduleAfterActivity() {
        if (loaded) return;
        clearSchedule();
        settleHandle = window.setTimeout(() => {
            settleHandle = null;

            if ('requestIdleCallback' in window) {
                idleHandle = window.requestIdleCallback(load, { timeout: 2500 });
            } else {
                load();
            }
        }, ANALYTICS_SETTLE_DELAY);
    }

    ACTIVITY_EVENTS.forEach((eventName) =>
        window.addEventListener(eventName, scheduleAfterActivity, {
            capture: true,
            passive: true,
        })
    );

    window.__solitudeAnalyticsLoader = { load };
    if (document.readyState === 'complete') scheduleAfterActivity();
    else window.addEventListener('load', scheduleAfterActivity, { once: true });
}
