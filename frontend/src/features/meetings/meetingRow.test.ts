import { describe, expect, test } from "vitest";
import type { Meeting } from "../../lib/types";
import { describePeople, toMeetingRow } from "./meetingRow";

const now = new Date(2026, 10, 21, 18, 0);

const SUMMARY = {
    generatedAt: null,
    keyPoints: [],
    highlights: [],
    keywords: [],
    participantsInvolved: ["Udit Singh", "Maya Patel", "Aarav Mehta"],
    conclusion: "Agreed to ship the release on Thursday."
};

const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
    id: "1",
    meetingId: "pfa-wnbe-tqc",
    hostId: "u1",
    hostUsername: "udit",
    hostName: "Udit Singh",
    status: "ended",
    settings: { allowChat: true, allowScreenShare: true, allowParticipantMic: true },
    createdAt: new Date(2026, 10, 20, 10, 0).toISOString(),
    updatedAt: new Date(2026, 10, 20, 10, 18).toISOString(),
    endedAt: new Date(2026, 10, 20, 10, 18).toISOString(),
    hasSummary: true,
    currentUserRole: "host",
    participantCount: 3,
    durationMs: 18 * 60_000,
    participants: [],
    summary: SUMMARY,
    ...overrides
});

describe("toMeetingRow", () => {
    test("an ended call leads with its recap and links to it", () => {
        const row = toMeetingRow(meeting(), "Udit Singh", now);

        expect(row.href).toBe("/meetings/pfa-wnbe-tqc");
        expect(row.headline).toBe("Agreed to ship the release on Thursday.");
        expect(row.people).toEqual(["Maya Patel", "Aarav Mehta"]);
        expect(row.details).toEqual(["pfa-wnbe-tqc", "3 people", "18 min", "You hosted"]);
        expect(row.when).toBe("Yesterday");
    });

    test("an ended call with an empty chat says who it was with", () => {
        const row = toMeetingRow(meeting({ summary: { ...SUMMARY, conclusion: "" } }), "Udit Singh", now);
        expect(row.headline).toBe("Call with Maya Patel and Aarav Mehta");
    });

    test("a live call links to the room and names the host when it is someone else", () => {
        const row = toMeetingRow(
            meeting({
                status: "active",
                endedAt: null,
                summary: null,
                currentUserRole: "participant",
                hostName: "Maya Patel",
                createdAt: new Date(2026, 10, 21, 16, 0).toISOString(),
                participants: [
                    { userId: "a", username: "maya", name: "Maya Patel", role: "host", joinedAt: "" },
                    { userId: "b", username: "udit", name: "Udit Singh", role: "participant", joinedAt: "" }
                ]
            }),
            "Udit Singh",
            now
        );

        expect(row.isLive).toBe(true);
        expect(row.href).toBe("/room/pfa-wnbe-tqc");
        expect(row.headline).toBe("Call with Maya Patel");
        expect(row.details.at(-1)).toBe("Hosted by Maya Patel");
        expect(row.when).toMatch(/^Started 2 hours ago$/);
    });
});

describe("describePeople", () => {
    test("stays short as the call grows", () => {
        expect(describePeople([])).toBe("Just you");
        expect(describePeople(["Maya Patel", "Aarav Mehta", "Sofia Rossi"])).toBe("Maya Patel and 2 others");
    });
});
