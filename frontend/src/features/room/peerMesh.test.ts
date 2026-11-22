import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_ICE_SERVERS, resolveIceServers } from "./peerMesh";

// Placeholder values in the shape a TURN provider issues; not real credentials.
const TURN_UDP = { urls: "turn:global.relay.example.com:80", username: "user-123", credential: "pass-456" };
const TURN_ARRAY = [
    { urls: "stun:stun.relay.example.com:80" },
    TURN_UDP,
    { urls: "turn:global.relay.example.com:80?transport=tcp", username: "user-123", credential: "pass-456" },
    { urls: "turn:global.relay.example.com:443", username: "user-123", credential: "pass-456" },
    { urls: "turns:global.relay.example.com:443?transport=tcp", username: "user-123", credential: "pass-456" }
];

const allUrls = (servers: RTCIceServer[]) => servers.flatMap(({ urls }) => urls);

describe("resolveIceServers", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    afterEach(() => {
        warn.mockClear();
    });

    test.each([
        ["unset", undefined],
        ["empty", ""],
        ["whitespace", "   "]
    ])("uses the default STUN servers when %s", (_label, raw) => {
        expect(resolveIceServers(raw)).toEqual(DEFAULT_ICE_SERVERS);
        expect(warn).not.toHaveBeenCalled();
    });

    test("adds a provider's full ICE servers array to the default STUN servers", () => {
        const servers = resolveIceServers(JSON.stringify(TURN_ARRAY));

        expect(servers.slice(0, DEFAULT_ICE_SERVERS.length)).toEqual(DEFAULT_ICE_SERVERS);
        expect(servers.slice(DEFAULT_ICE_SERVERS.length)).toEqual(
            TURN_ARRAY.map((server) => ({ ...server, urls: [server.urls] }))
        );
        expect(warn).not.toHaveBeenCalled();
    });

    test("accepts multi-line JSON and urls given as an array", () => {
        const raw = `[\n  {\n    "urls": ["turn:a.example.com:3478", "turns:a.example.com:5349"],\n    "username": "u",\n    "credential": "c"\n  }\n]`;

        expect(resolveIceServers(raw)).toEqual([
            ...DEFAULT_ICE_SERVERS,
            { urls: ["turn:a.example.com:3478", "turns:a.example.com:5349"], username: "u", credential: "c" }
        ]);
    });

    test("does not list a default STUN URL twice", () => {
        const raw = JSON.stringify([{ urls: "stun:stun.l.google.com:19302" }, TURN_UDP]);
        const urls = allUrls(resolveIceServers(raw));

        expect(urls.filter((url) => url === "stun:stun.l.google.com:19302")).toHaveLength(1);
        expect(urls).toContain("turn:global.relay.example.com:80");
    });

    test.each([
        ["JavaScript object syntax (unquoted keys)", "[{ urls: \"turn:a.example.com\", username: \"u\", credential: \"c\" }]"],
        ["a trailing comma", "[{\"urls\":\"stun:a.example.com\"},]"],
        ["an object instead of an array", JSON.stringify({ iceServers: TURN_ARRAY })],
        ["a bare string", JSON.stringify("turn:a.example.com")]
    ])("falls back to the defaults and warns for %s", (_label, raw) => {
        expect(resolveIceServers(raw)).toEqual(DEFAULT_ICE_SERVERS);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    test.each([
        ["TURN without a credential", { urls: "turn:a.example.com", username: "u" }],
        ["TURN without a username", { urls: "turns:a.example.com", credential: "c" }],
        ["TURN with an empty credential", { urls: "turn:a.example.com", username: "u", credential: "" }],
        ["an unsupported scheme", { urls: "https://a.example.com" }],
        ["no urls", { username: "u", credential: "c" }],
        ["empty urls", { urls: [] }],
        ["a non-string url", { urls: [42] }],
        ["null", null]
    ])("drops an entry with %s and keeps the valid ones", (_label, bad) => {
        const servers = resolveIceServers(JSON.stringify([bad, TURN_UDP]));

        expect(servers).toEqual([...DEFAULT_ICE_SERVERS, { ...TURN_UDP, urls: [TURN_UDP.urls] }]);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    test("never writes a credential to the console", () => {
        resolveIceServers(JSON.stringify([{ urls: "turn:a.example.com", username: "leaky-user", credential: "" }]));
        resolveIceServers("[{ urls: \"turn:a\", username: \"leaky-user\", credential: \"leaky-pass\" }]");

        const logged = warn.mock.calls.flat().join(" ");
        expect(logged).not.toContain("leaky-user");
        expect(logged).not.toContain("leaky-pass");
    });

    test("ignores unknown fields instead of passing them to the browser", () => {
        const raw = JSON.stringify([{ urls: "turn:a.example.com", username: "u", credential: "c", note: "x" }]);

        expect(resolveIceServers(raw).at(-1)).toEqual({ urls: ["turn:a.example.com"], username: "u", credential: "c" });
    });
});
