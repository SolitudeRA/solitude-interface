import { inferRemoteSize } from 'astro:assets';

export interface RemoteImageDimensions {
    width: number;
    height: number;
}

const resolvedDimensions = new Map<string, RemoteImageDimensions | null>();
const pendingDimensions = new Map<string, Promise<RemoteImageDimensions | null>>();

function startProbe(src: string): Promise<RemoteImageDimensions | null> {
    const existing = pendingDimensions.get(src);
    if (existing) return existing;

    const probe = inferRemoteSize(src)
        .then(({ width, height }) => {
            const dimensions = { width, height };
            resolvedDimensions.set(src, dimensions);
            return dimensions;
        })
        .catch(() => {
            resolvedDimensions.set(src, null);
            return null;
        })
        .finally(() => pendingDimensions.delete(src));

    pendingDimensions.set(src, probe);
    return probe;
}

export async function getRemoteImageDimensions(src: string): Promise<RemoteImageDimensions | null> {
    if (resolvedDimensions.has(src)) return resolvedDimensions.get(src) ?? null;

    const probe = startProbe(src);
    if (import.meta.env.DEV) return null;
    return probe;
}
