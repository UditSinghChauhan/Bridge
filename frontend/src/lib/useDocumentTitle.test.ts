import { describe, expect, it } from "vitest";
import { documentTitle, SITE_TITLE } from "./useDocumentTitle";

describe("documentTitle", () => {
    it("keeps the site title when no page is named", () => {
        expect(documentTitle()).toBe(SITE_TITLE);
    });

    it("puts the page first so tabs stay distinguishable", () => {
        expect(documentTitle("kmt-vrqp-xhw")).toBe("kmt-vrqp-xhw · Bridge");
    });
});
