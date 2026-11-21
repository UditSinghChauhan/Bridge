import { formatCalendarDay, formatDuration, formatRelative, pluralize } from "../../lib/format";
import type { Meeting } from "../../lib/types";

export interface MeetingRowModel {
    href: string;
    isLive: boolean;
    /** What the row is about: the recap's decision, or who the call is with. */
    headline: string;
    /** Display names for the avatar stack, the viewer's own name excluded. */
    people: string[];
    /** Secondary line: code, size, length and who hosted. */
    details: string[];
    /** Right-hand date: "Yesterday", "Wednesday", "Nov 14"; "Started 4 hours ago" while live. */
    when: string;
    whenIso: string;
}

const namesOf = (meeting: Meeting): string[] => {
    // Ended meetings no longer list who is in the room; the recap keeps who took part.
    const names = meeting.status === "ended" && meeting.summary?.participantsInvolved.length
        ? meeting.summary.participantsInvolved
        : meeting.participants.map((participant) => participant.name || participant.username);
    return [...new Set(names.filter(Boolean))];
};

/** "Maya Patel", "Maya Patel and Aarav Mehta", "Maya Patel and 2 others". */
export const describePeople = (names: string[]): string => {
    const [first, second] = names;
    if (!first) return "Just you";
    if (names.length === 1) return first;
    if (names.length === 2) return `${first} and ${second}`;
    return `${first} and ${names.length - 1} others`;
};

export const toMeetingRow = (meeting: Meeting, viewerName: string | null, now: Date = new Date()): MeetingRowModel => {
    const isLive = meeting.status === "active";
    const id = encodeURIComponent(meeting.meetingId);
    const others = namesOf(meeting).filter((name) => name !== viewerName);
    const conclusion = meeting.summary?.conclusion.trim();
    const withWhom = others.length ? `Call with ${describePeople(others)}` : "A call on your own";

    const details: string[] = [meeting.meetingId];
    const count = meeting.participantCount ?? meeting.participants.length;
    if (count) details.push(pluralize(count, "person", "people"));
    const duration = formatDuration(meeting.durationMs);
    if (!isLive && duration) details.push(duration);
    if (meeting.currentUserRole === "host") {
        details.push(isLive ? "You're hosting" : "You hosted");
    } else if (meeting.hostName) {
        details.push(`Hosted by ${meeting.hostName}`);
    }

    const at = isLive ? meeting.createdAt : meeting.endedAt ?? meeting.updatedAt;

    return {
        href: isLive ? `/room/${id}` : `/meetings/${id}`,
        isLive,
        headline: !isLive && conclusion ? conclusion : withWhom,
        people: others,
        details,
        when: isLive ? `Started ${formatRelative(at, now)}` : formatCalendarDay(at, now),
        whenIso: at
    };
};
