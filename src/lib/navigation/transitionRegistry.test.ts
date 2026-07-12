import { describe, expect, it } from 'vitest';
import { isSiteTransition, SITE_TRANSITIONS } from './transitionRegistry';

describe('site transition registry', () => {
    it('recognizes registered transitions', () => {
        expect(isSiteTransition(SITE_TRANSITIONS.postForward)).toBe(true);
        expect(isSiteTransition(SITE_TRANSITIONS.postReturn)).toBe(true);
    });

    it('rejects unknown and missing transitions', () => {
        expect(isSiteTransition('unknown-transition')).toBe(false);
        expect(isSiteTransition(null)).toBe(false);
    });
});
