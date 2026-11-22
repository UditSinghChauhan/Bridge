import type { ReactNode } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Logo } from "../../components/Logo";
import type { DeviceStatus } from "./useLocalMedia";
import { VideoTile } from "./VideoTile";
import { useAudioLevel } from "./useAudioActivity";
import styles from "./Lobby.module.css";

interface LobbyProps {
    meetingId: string;
    displayName: string;
    username?: string;
    previewStream: MediaStream | null;
    /** The microphone track, for the level meter (the preview stream is video only, so it never echoes). */
    micTrack?: MediaStreamTrack | null;
    micOn: boolean;
    cameraOn: boolean;
    micStatus: DeviceStatus;
    cameraStatus: DeviceStatus;
    onToggleMic: () => void;
    onToggleCamera: () => void;
    title: string;
    description: ReactNode;
    error?: string | null;
    actions: ReactNode;
    aside?: ReactNode;
}

/** Three bars that follow your voice, so you know you'll be heard before you join. */
function MicMeter({ track, on }: { track: MediaStreamTrack | null; on: boolean }) {
    const level = useAudioLevel(track, on);

    return (
        <span className={styles.meter} style={{ "--level": level } as React.CSSProperties} aria-hidden="true" data-testid="mic-meter">
            <span />
            <span />
            <span />
        </span>
    );
}

const deviceCopy = (status: DeviceStatus, on: boolean, device: "Microphone" | "Camera") => {
    if (status === "blocked") return `${device} blocked. Allow it in your browser's site settings.`;
    if (status === "missing") return `No ${device.toLowerCase()} found`;
    if (status === "pending") return `Checking ${device.toLowerCase()}…`;
    if (status === "idle") return `${device} off`;
    return `${device} ${on ? "on" : "off"}`;
};

export function Lobby(props: LobbyProps) {
    const { micOn, cameraOn, micStatus, cameraStatus } = props;
    const micUsable = micStatus !== "missing";
    const cameraUsable = cameraStatus !== "missing";

    return (
        <div className={styles.lobby}>
            <header className={styles.top}>
                <Logo to="/home" />
            </header>
            <main id="main" className={styles.main}>
                <section className={styles.preview} aria-label="Camera preview">
                    <div className={styles.previewFrame}>
                        <VideoTile
                            tile={{
                                id: "preview",
                                name: props.displayName,
                                isLocal: true,
                                stream: props.previewStream,
                                media: { audio: micOn, video: cameraOn, screen: false }
                            }}
                            variant="spotlight"
                        />
                        <div className={styles.previewControls}>
                            <button
                                type="button"
                                className={[styles.toggle, !micOn && styles.off].filter(Boolean).join(" ")}
                                onClick={props.onToggleMic}
                                disabled={!micUsable}
                                aria-label={micOn ? "Turn off microphone" : "Turn on microphone"}
                            >
                                {micOn ? <Mic size={20} aria-hidden="true" /> : <MicOff size={20} aria-hidden="true" />}
                            </button>
                            <button
                                type="button"
                                className={[styles.toggle, !cameraOn && styles.off].filter(Boolean).join(" ")}
                                onClick={props.onToggleCamera}
                                disabled={!cameraUsable}
                                aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
                            >
                                {cameraOn ? <Video size={20} aria-hidden="true" /> : <VideoOff size={20} aria-hidden="true" />}
                            </button>
                        </div>
                    </div>
                    <ul className={styles.devices} aria-live="polite">
                        <li data-status={micStatus === "ready" && micOn ? "on" : micStatus === "blocked" ? "blocked" : "off"}>
                            {micStatus === "ready" && micOn ? <MicMeter track={props.micTrack ?? null} on={micOn} /> : null}
                            {deviceCopy(micStatus, micOn, "Microphone")}
                        </li>
                        <li data-status={cameraStatus === "ready" && cameraOn ? "on" : cameraStatus === "blocked" ? "blocked" : "off"}>
                            {deviceCopy(cameraStatus, cameraOn, "Camera")}
                        </li>
                    </ul>
                </section>

                <section className={styles.details}>
                    <p className={styles.code}>{props.meetingId}</p>
                    <h1 className={styles.title}>{props.title}</h1>
                    <div className={styles.description}>{props.description}</div>
                    <div className={styles.identity}>
                        <Avatar name={props.displayName} size={36} />
                        <div>
                            <span className={styles.identityLabel}>Joining as</span>
                            <strong>
                                {props.displayName}
                                {props.username ? <span className={styles.username}> @{props.username}</span> : null}
                            </strong>
                        </div>
                    </div>
                    {props.error ? (
                        <p className={styles.error} role="alert">
                            {props.error}
                        </p>
                    ) : null}
                    <div className={styles.actions}>{props.actions}</div>
                    {props.aside}
                </section>
            </main>
        </div>
    );
}
