export const DEFAULT_REDIRECT = "/home";

/**
 * Returns a post-login destination that is guaranteed to stay on this site.
 *
 * `value` comes from the `?next=` query parameter, so it is attacker-controlled.
 * A prefix check alone is not enough: browsers read `\` as `/` and drop tabs and
 * newlines, so `/\evil.com` or `/<TAB>/evil.com` resolve to `//evil.com`. The
 * value is therefore resolved the way the browser would resolve it, rejected
 * unless it lands on our own origin, and returned in its normalised form so the
 * router navigates to exactly the path that was checked.
 */
export const safeRedirectPath = (
    value: string | null | undefined,
    origin: string = window.location.origin,
    fallback: string = DEFAULT_REDIRECT
): string => {
    // Only root-relative paths: no schemes, no protocol-relative or relative paths.
    if (!value || value[0] !== "/" || value[1] === "/" || value[1] === "\\") return fallback;

    let resolved: URL;
    try {
        resolved = new URL(value, origin);
    } catch {
        return fallback;
    }

    if (resolved.origin !== new URL(origin).origin) return fallback;

    // Dot segments can collapse into a leading `//`: `/.//evil.com` and
    // `/a/..//evil.com` resolve on our origin to the path `//evil.com`, which the
    // router would then treat as a protocol-relative URL to another host.
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    if (/^\/[/\\]/.test(path)) return fallback;

    return path;
};
