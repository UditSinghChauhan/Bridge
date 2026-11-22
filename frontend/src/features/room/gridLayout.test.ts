import { describe, expect, test } from "vitest";
import { computeGridLayout, PORTRAIT_ASPECT_RANGE } from "./gridLayout";

describe("computeGridLayout", () => {
    test("a single tile fills the width of a wide area", () => {
        const layout = computeGridLayout(1600, 900, 1, { gap: 0 });
        expect(layout).toMatchObject({ columns: 1, rows: 1, tileWidth: 1600, tileHeight: 900 });
    });

    test("two people side by side on a landscape screen", () => {
        expect(computeGridLayout(1600, 900, 2).columns).toBe(2);
    });

    test("two people stacked on a portrait phone", () => {
        expect(computeGridLayout(390, 760, 2).columns).toBe(1);
    });

    test("four people form a 2x2 grid in a 16:9 area", () => {
        expect(computeGridLayout(1600, 900, 4)).toMatchObject({ columns: 2, rows: 2 });
    });

    test("tiles never exceed the container", () => {
        for (let count = 1; count <= 12; count += 1) {
            const layout = computeGridLayout(1200, 700, count, { gap: 12 });
            expect(layout.columns * layout.tileWidth + (layout.columns - 1) * 12).toBeLessThanOrEqual(1200);
            expect(layout.rows * layout.tileHeight + (layout.rows - 1) * 12).toBeLessThanOrEqual(700);
        }
    });

    test("degenerate input returns an empty layout", () => {
        expect(computeGridLayout(0, 500, 3).tileWidth).toBe(0);
        expect(computeGridLayout(500, 500, 0).tileWidth).toBe(0);
    });

    describe("portrait stages", () => {
        const PORTRAIT = { aspectRange: PORTRAIT_ASPECT_RANGE };

        test("four people on a phone fill a 2x2 grid instead of four thin 16:9 strips", () => {
            const fixed = computeGridLayout(343, 600, 4);
            const flexible = computeGridLayout(343, 600, 4, PORTRAIT);

            expect(flexible).toMatchObject({ columns: 2, rows: 2 });
            // Fills the width: two tiles and the gap span the stage.
            expect(2 * flexible.tileWidth + 12).toBeGreaterThanOrEqual(342);
            expect(flexible.tileWidth * flexible.tileHeight).toBeGreaterThan(fixed.tileWidth * fixed.tileHeight);
        });

        test("flexible tiles still never exceed the container", () => {
            for (let count = 1; count <= 8; count += 1) {
                const layout = computeGridLayout(343, 600, count, PORTRAIT);
                expect(layout.columns * layout.tileWidth + (layout.columns - 1) * 12).toBeLessThanOrEqual(343);
                expect(layout.rows * layout.tileHeight + (layout.rows - 1) * 12).toBeLessThanOrEqual(600);
            }
        });

        test("two or three people stack full-width, each tile filling its share of the height", () => {
            for (const count of [2, 3]) {
                const layout = computeGridLayout(343, 600, count, PORTRAIT);
                expect(layout.columns).toBe(1);
                expect(layout.tileWidth).toBeGreaterThanOrEqual(340);
            }
        });

        test("tiles never go narrower than 3:4", () => {
            const layout = computeGridLayout(343, 900, 4, PORTRAIT);
            expect(layout.tileWidth / layout.tileHeight).toBeGreaterThanOrEqual(0.74);
        });

        test("a landscape stage keeps 16:9 even when other shapes are allowed", () => {
            const layout = computeGridLayout(1600, 900, 4, PORTRAIT);
            expect(layout.tileWidth / layout.tileHeight).toBeCloseTo(16 / 9, 1);
        });
    });
});
