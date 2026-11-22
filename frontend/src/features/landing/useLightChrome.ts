import { useEffect } from "react";

const LIGHT_BG = "#fbfaf8";

/**
 * The landing page is light only, but the document around it follows the
 * system theme. On a dark-mode phone that painted the browser bar (theme-color)
 * and the overscroll area near-black above a cream page. While the landing is
 * mounted, point both at the page's own background; restore them on leave so
 * the app keeps following the system theme.
 */
export function useLightChrome(): void {
    useEffect(() => {
        const root = document.documentElement;
        const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
        const previous = {
            colorScheme: root.style.colorScheme,
            background: root.style.backgroundColor,
            themeColors: metas.map((meta) => meta.content)
        };

        root.style.colorScheme = "light";
        root.style.backgroundColor = LIGHT_BG;
        metas.forEach((meta) => {
            meta.content = LIGHT_BG;
        });

        return () => {
            root.style.colorScheme = previous.colorScheme;
            root.style.backgroundColor = previous.background;
            metas.forEach((meta, index) => {
                meta.content = previous.themeColors[index] ?? meta.content;
            });
        };
    }, []);
}
