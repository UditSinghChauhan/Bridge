import { describe, expect, test } from "vitest";
import { avatarColorFor, createDateFormatters, formatDuration, formatElapsed, initialsFor, pluralize } from "./format";

// The app formats in the visitor's locale and time zone. Tests pin both, so they
// pass the same on any machine. ICU puts U+202F before AM/PM; \s matches it.
const enUS = createDateFormatters({ locale: "en-US", timeZone: "America/New_York" });
const enIN = createDateFormatters({ locale: "en-IN", timeZone: "Asia/Kolkata" });

describe("formatDuration", () => {
    test("handles missing values", () => {
        expect(formatDuration(null)).toBeNull();
        expect(formatDuration(undefined)).toBeNull();
    });

    test("formats short, minute and hour durations", () => {
        expect(formatDuration(20_000)).toBe("under a minute");
        expect(formatDuration(45 * 60_000)).toBe("45 min");
        expect(formatDuration(65 * 60_000)).toBe("1 h 05 min");
    });
});

describe("formatElapsed", () => {
    test("uses m:ss under an hour and h:mm:ss after", () => {
        expect(formatElapsed(0)).toBe("0:00");
        expect(formatElapsed(249_000)).toBe("4:09");
        expect(formatElapsed(3_753_000)).toBe("1:02:33");
    });

    test("never goes negative when clocks disagree", () => {
        expect(formatElapsed(-5_000)).toBe("0:00");
    });
});

describe("formatRelative", () => {
    const now = new Date("2026-10-31T12:00:00Z");

    test("collapses the last minute to 'just now'", () => {
        expect(enUS.formatRelative("2026-10-31T11:59:30Z", now)).toBe("just now");
    });

    test("uses minutes, hours and days for recent times", () => {
        expect(enUS.formatRelative("2026-10-31T11:48:00Z", now)).toBe("12 minutes ago");
        expect(enUS.formatRelative("2026-10-31T09:00:00Z", now)).toBe("3 hours ago");
        expect(enUS.formatRelative("2026-10-30T12:00:00Z", now)).toBe("yesterday");
    });
});

describe("initialsFor", () => {
    test("takes first and last word", () => {
        expect(initialsFor("Udit Singh Chauhan")).toBe("UC");
        expect(initialsFor("maya")).toBe("M");
        expect(initialsFor("john_smith")).toBe("JS");
        expect(initialsFor("  ")).toBe("?");
    });
});

test("avatarColorFor is stable per name", () => {
    expect(avatarColorFor("Maya")).toBe(avatarColorFor("Maya"));
});

test("pluralize", () => {
    expect(pluralize(1, "person", "people")).toBe("1 person");
    expect(pluralize(3, "person", "people")).toBe("3 people");
});

describe("formatCalendarDay", () => {
    describe("en-US, New York", () => {
        // Saturday 21 November 2026, 6:30 PM in New York.
        const now = new Date("2026-11-21T18:30:00-05:00");

        test("shows the time for today", () => {
            expect(enUS.formatCalendarDay("2026-11-21T09:05:00-05:00", now)).toMatch(/^9:05\sAM$/);
        });

        test("names yesterday and the rest of the past week", () => {
            expect(enUS.formatCalendarDay("2026-11-20T23:59:00-05:00", now)).toBe("Yesterday");
            expect(enUS.formatCalendarDay("2026-11-18T10:00:00-05:00", now)).toBe("Wednesday");
        });

        test("falls back to the date, adding the year only when it differs", () => {
            expect(enUS.formatCalendarDay("2026-11-14T09:00:00-05:00", now)).toBe("Nov 14");
            expect(enUS.formatCalendarDay("2025-12-30T09:00:00-05:00", now)).toBe("Dec 30, 2025");
        });
    });

    describe("en-IN, Kolkata", () => {
        // Saturday 21 November 2026, 6:30 PM in Kolkata.
        const now = new Date("2026-11-21T18:30:00+05:30");

        test("shows the time for today", () => {
            expect(enIN.formatCalendarDay("2026-11-21T09:05:00+05:30", now)).toMatch(/^9:05\sam$/i);
        });

        test("names yesterday and the rest of the past week", () => {
            expect(enIN.formatCalendarDay("2026-11-20T23:59:00+05:30", now)).toBe("Yesterday");
            expect(enIN.formatCalendarDay("2026-11-18T10:00:00+05:30", now)).toBe("Wednesday");
        });

        test("puts the day before the month", () => {
            expect(enIN.formatCalendarDay("2026-11-14T09:00:00+05:30", now)).toBe("14 Nov");
            expect(enIN.formatCalendarDay("2025-12-30T09:00:00+05:30", now)).toBe("30 Dec 2025");
        });
    });

    test("counts calendar days in the formatter's time zone", () => {
        // 03:00 UTC on the 21st is still the evening of the 20th in New York.
        const now = new Date("2026-11-21T23:30:00Z");
        const instant = "2026-11-21T03:00:00Z";

        expect(enUS.formatCalendarDay(instant, now)).toBe("Yesterday");
        expect(createDateFormatters({ locale: "en-US", timeZone: "UTC" }).formatCalendarDay(instant, now)).toMatch(/^3:00\sAM$/);
    });
});
