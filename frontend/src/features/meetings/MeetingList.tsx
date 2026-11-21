import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronRight, RotateCw } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import type { Meeting } from "../../lib/types";
import { toMeetingRow } from "./meetingRow";
import styles from "./MeetingList.module.css";

export function MeetingListSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <ul className={styles.list} aria-busy="true" aria-label="Loading meetings">
            {Array.from({ length: rows }, (_, index) => (
                <li key={index} className={`${styles.row} ${styles.skeletonRow}`}>
                    <span className={`${styles.skeleton} ${styles.skeletonStack}`} />
                    <span className={styles.body}>
                        <span className={styles.skeleton} style={{ width: `${62 - index * 9}%` }} />
                        <span className={styles.skeleton} style={{ width: "34%", height: 10 }} />
                    </span>
                    <span className={styles.skeleton} style={{ width: 64 }} />
                </li>
            ))}
        </ul>
    );
}

export function MeetingListError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className={styles.state} role="alert">
            <strong>Couldn’t load your meetings</strong>
            <p>{message}</p>
            <Button variant="secondary" size="sm" icon={<RotateCw size={14} aria-hidden="true" />} onClick={onRetry}>
                Try again
            </Button>
        </div>
    );
}

export function MeetingListEmpty({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
    return (
        <div className={styles.state}>
            <strong>{title}</strong>
            <p>{description}</p>
            {action}
        </div>
    );
}

const STACK_MAX = 3;

function PeopleStack({ names }: { names: string[] }) {
    const shown = names.slice(0, STACK_MAX);
    const extra = names.length - shown.length;

    return (
        <span className={styles.stack} aria-hidden="true">
            {shown.length ? (
                shown.map((name, index) => (
                    // First person on top: each tucked circle keeps its initials in view.
                    <span key={name} className={styles.stackItem} style={{ zIndex: shown.length - index }}>
                        <Avatar name={name} size={28} />
                    </span>
                ))
            ) : (
                <span className={styles.stackEmpty} />
            )}
            {extra > 0 ? <span className={styles.stackMore}>+{extra}</span> : null}
        </span>
    );
}

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
    const { user } = useAuth();
    const viewerName = user?.name || user?.username || null;

    return (
        <ul className={styles.list}>
            {meetings.map((meeting) => {
                const row = toMeetingRow(meeting, viewerName);

                return (
                    <li key={meeting.id ?? meeting.meetingId}>
                        <Link to={row.href} className={styles.row} data-live={row.isLive || undefined}>
                            <PeopleStack names={row.people} />
                            <span className={styles.body}>
                                <span className={styles.headline}>
                                    {row.isLive ? <span className={styles.live}>Live</span> : null}
                                    <span className={styles.headlineText}>{row.headline}</span>
                                </span>
                                <span className={styles.details}>
                                    {row.details.map((detail, index) => (
                                        <span key={detail} className={index === 0 ? styles.code : undefined}>{detail}</span>
                                    ))}
                                </span>
                            </span>
                            <span className={styles.trail}>
                                <time dateTime={row.whenIso} className={styles.when}>{row.when}</time>
                                {row.isLive ? (
                                    <span className={styles.rejoin}>
                                        <ArrowUpRight size={14} aria-hidden="true" />
                                        Rejoin
                                    </span>
                                ) : (
                                    <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
                                )}
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}
