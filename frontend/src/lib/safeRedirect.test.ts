import { describe, expect, test } from "vitest";
import { DEFAULT_REDIRECT, safeRedirectPath } from "./safeRedirect";

const ORIGIN = "https://bridge.app";
const check = (value: string | null | undefined) => safeRedirectPath(value, ORIGIN);

describe("safeRedirectPath keeps legitimate in-app destinations", () => {
    test.each([
        ["/home", "/home"],
        ["/history", "/history"],
        ["/room/kmt-vrqp-xhw", "/room/kmt-vrqp-xhw"],
        ["/meetings/design_review-2", "/meetings/design_review-2"],
        ["/history?summary=abc", "/history?summary=abc"],
        ["/room/kmt-vrqp-xhw?x=1#chat", "/room/kmt-vrqp-xhw?x=1#chat"],
        ["/room/caf%C3%A9", "/room/caf%C3%A9"]
    ])("%s", (value, expected) => {
        expect(check(value)).toBe(expected);
    });

    test("normalises dot segments so the checked path is the one navigated to", () => {
        expect(check("/room/../home")).toBe("/home");
    });

    test("round-trips what RequireAuth puts in ?next=", () => {
        const next = "/room/kmt-vrqp-xhw?join=1";
        const query = new URLSearchParams(`next=${encodeURIComponent(next)}`);
        expect(check(query.get("next"))).toBe(next);
    });
});

describe("safeRedirectPath rejects off-site and malformed destinations", () => {
    test.each([
        ["missing", null],
        ["undefined", undefined],
        ["empty", ""],
        ["absolute URL", "https://evil.com"],
        ["absolute URL on our own host", "https://bridge.app/home"],
        ["protocol-relative", "//evil.com"],
        ["javascript: scheme", "javascript:alert(1)"],
        ["data: scheme", "data:text/html,hi"],
        ["relative path", "home"],
        ["backslash after slash", "/\\evil.com"],
        ["double backslash", "\\\\evil.com"],
        ["backslash then slash", "\\/evil.com"],
        ["tab inside the authority", "/\t/evil.com"],
        ["newline inside the authority", "/\n/evil.com"],
        ["carriage return inside the authority", "/\r/evil.com"],
        ["leading space", " //evil.com"],
        ["encoded scheme is not decoded twice", "%2F%2Fevil.com"]
    ])("%s", (_label, value) => {
        expect(check(value)).toBe(DEFAULT_REDIRECT);
    });

    test("an encoded slash stays a path on our own site", () => {
        // `/%2F%2Fevil.com` is a single path segment, never a host.
        expect(check("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
    });

    test("honours a caller-provided fallback", () => {
        expect(safeRedirectPath("//evil.com", ORIGIN, "/")).toBe("/");
    });
});
