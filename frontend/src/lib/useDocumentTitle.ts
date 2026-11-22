import { useEffect } from "react";

export const SITE_TITLE = "Bridge · Video meetings that end with a recap";

/** "Sign in" -> "Sign in · Bridge"; no argument keeps the site title. */
export const documentTitle = (page?: string): string => (page ? `${page} · Bridge` : SITE_TITLE);

/**
 * Sets the tab title for the current route, so a room, a recap and the sign-in
 * page are told apart in tabs and history. Hooks run before any early return,
 * so a page calls this once at the top.
 */
export function useDocumentTitle(page?: string): void {
    useEffect(() => {
        document.title = documentTitle(page);
    }, [page]);
}
