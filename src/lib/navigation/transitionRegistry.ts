export const SITE_TRANSITION_ATTRIBUTE = 'data-site-transition';

export const SITE_TRANSITIONS = {
    postForward: 'post-forward',
    postReturn: 'post-return',
} as const;

export type SiteTransition = (typeof SITE_TRANSITIONS)[keyof typeof SITE_TRANSITIONS];

const SITE_TRANSITION_VALUES = new Set<string>(Object.values(SITE_TRANSITIONS));

export function isSiteTransition(value: string | null): value is SiteTransition {
    return value !== null && SITE_TRANSITION_VALUES.has(value);
}
