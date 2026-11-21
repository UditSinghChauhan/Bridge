export interface GridLayout {
    columns: number;
    rows: number;
    tileWidth: number;
    tileHeight: number;
}

/**
 * Tile shapes allowed on a tall stage (a phone held upright): anything from
 * 3:4 to 16:9. Video is cropped centre-out (`object-fit: cover`), so faces stay
 * in frame, the way FaceTime and Meet fill a portrait screen instead of
 * stacking thin 16:9 strips with empty sides.
 */
export const PORTRAIT_ASPECT_RANGE: readonly [number, number] = [3 / 4, 16 / 9];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Chooses the column count that gives the largest tiles inside the available
 * area. With a fixed `aspectRatio` every tile keeps that shape; with an
 * `aspectRange` each tile takes its cell's shape, clamped to the range, so the
 * grid fills the stage. Brute force is fine: counts are small.
 */
export const computeGridLayout = (
    width: number,
    height: number,
    count: number,
    { aspectRatio = 16 / 9, aspectRange, gap = 12 }: {
        aspectRatio?: number;
        aspectRange?: readonly [number, number];
        gap?: number;
    } = {}
): GridLayout => {
    if (count <= 0 || width <= 0 || height <= 0) {
        return { columns: 1, rows: 1, tileWidth: 0, tileHeight: 0 };
    }

    let best: GridLayout = { columns: 1, rows: count, tileWidth: 0, tileHeight: 0 };
    let bestArea = 0;

    for (let columns = 1; columns <= count; columns += 1) {
        const rows = Math.ceil(count / columns);
        const cellWidth = (width - gap * (columns - 1)) / columns;
        const cellHeight = (height - gap * (rows - 1)) / rows;

        if (cellWidth <= 0 || cellHeight <= 0) {
            continue;
        }

        const ratio = aspectRange ? clamp(cellWidth / cellHeight, aspectRange[0], aspectRange[1]) : aspectRatio;
        const tileWidth = Math.floor(Math.min(cellWidth, cellHeight * ratio));
        const tileHeight = Math.floor(Math.min(cellHeight, tileWidth / ratio));
        const area = tileWidth * tileHeight;

        if (area > bestArea) {
            bestArea = area;
            best = { columns, rows, tileWidth, tileHeight };
        }
    }

    return best;
};
