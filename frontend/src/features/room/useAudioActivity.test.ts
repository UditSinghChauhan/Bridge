import { describe, expect, test } from "vitest";
import { levelFromRms } from "./useAudioActivity";

describe("levelFromRms", () => {
    test("silence and room noise read as empty", () => {
        expect(levelFromRms(0)).toBe(0);
        expect(levelFromRms(0.001)).toBe(0); // -60 dBFS
    });

    test("normal speech lands mid-meter and loud speech fills it", () => {
        const speech = levelFromRms(0.03); // about -30 dBFS
        expect(speech).toBeGreaterThan(0.5);
        expect(speech).toBeLessThan(0.75);
        expect(levelFromRms(0.5)).toBe(1);
    });
});
