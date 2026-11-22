/**
 * Full-mesh WebRTC for small rooms, independent of React.
 *
 * Design choices:
 * - "Perfect negotiation" (polite/impolite peers) so offer collisions and
 *   renegotiation can never deadlock, whoever starts first.
 * - Every connection carries exactly one audio and one video transceiver in
 *   sendrecv mode from the start. Muting, turning the camera off and screen
 *   sharing are all `replaceTrack` calls on those senders, so none of them
 *   needs another offer/answer round trip.
 * - Only the newcomer initiates connections to people already in the room,
 *   which halves signalling traffic on join.
 */

export interface OutgoingTracks {
    audio: MediaStreamTrack | null;
    video: MediaStreamTrack | null;
}

export type PeerConnectionState = RTCPeerConnectionState;

interface SignalPayload {
    sdp?: RTCSessionDescriptionInit;
    ice?: RTCIceCandidateInit;
}

interface Peer {
    pc: RTCPeerConnection;
    polite: boolean;
    makingOffer: boolean;
    ignoreOffer: boolean;
    isSettingRemoteAnswerPending: boolean;
    pendingCandidates: RTCIceCandidateInit[];
    senders: Partial<Record<"audio" | "video", RTCRtpSender>>;
    stream: MediaStream;
}

export interface PeerMeshOptions {
    iceServers: RTCIceServer[];
    sendSignal: (toId: string, payload: string) => void;
    onRemoteStream: (peerId: string, stream: MediaStream) => void;
    onConnectionState: (peerId: string, state: PeerConnectionState) => void;
    onError: (message: string, error: unknown) => void;
}

const KINDS = ["audio", "video"] as const;

export class PeerMesh {
    private peers = new Map<string, Peer>();
    private selfId: string | null = null;
    private tracks: OutgoingTracks = { audio: null, video: null };

    constructor(private readonly options: PeerMeshOptions) {}

    setSelfId(id: string) {
        this.selfId = id;
    }

    /** Swaps the outgoing tracks on every connection without renegotiating. */
    setLocalTracks(tracks: OutgoingTracks) {
        this.tracks = tracks;
        this.peers.forEach((peer) => this.syncSenders(peer));
    }

    /** Called by the newcomer for each participant already in the room. */
    connectTo(peerId: string) {
        const peer = this.ensurePeer(peerId);

        if (Object.keys(peer.senders).length === 0) {
            KINDS.forEach((kind) => {
                const transceiver = peer.pc.addTransceiver(this.tracks[kind] ?? kind, { direction: "sendrecv" });
                peer.senders[kind] = transceiver.sender;
            });
        }
    }

    async handleSignal(fromId: string, raw: string) {
        let payload: SignalPayload;

        try {
            payload = JSON.parse(raw) as SignalPayload;
        } catch (error) {
            this.options.onError("Received a malformed signalling message.", error);
            return;
        }

        const peer = this.ensurePeer(fromId);
        const { pc } = peer;

        try {
            if (payload.sdp) {
                const description = payload.sdp;
                const readyForOffer = !peer.makingOffer
                    && (pc.signalingState === "stable" || peer.isSettingRemoteAnswerPending);
                const offerCollision = description.type === "offer" && !readyForOffer;

                peer.ignoreOffer = !peer.polite && offerCollision;

                if (peer.ignoreOffer) {
                    return;
                }

                peer.isSettingRemoteAnswerPending = description.type === "answer";
                await pc.setRemoteDescription(description);
                peer.isSettingRemoteAnswerPending = false;

                await this.flushCandidates(peer);

                if (description.type === "offer") {
                    this.adoptRemoteTransceivers(peer);
                    await pc.setLocalDescription();
                    this.send(fromId, { sdp: pc.localDescription?.toJSON() });
                }
            } else if (payload.ice) {
                if (!pc.remoteDescription) {
                    peer.pendingCandidates.push(payload.ice);
                    return;
                }

                try {
                    await pc.addIceCandidate(payload.ice);
                } catch (error) {
                    // Candidates for an offer we deliberately ignored are expected to fail.
                    if (!peer.ignoreOffer) {
                        throw error;
                    }
                }
            }
        } catch (error) {
            peer.isSettingRemoteAnswerPending = false;
            this.options.onError("A connection to another participant could not be negotiated.", error);
        }
    }

    remove(peerId: string) {
        const peer = this.peers.get(peerId);

        if (!peer) {
            return;
        }

        peer.pc.onicecandidate = null;
        peer.pc.ontrack = null;
        peer.pc.onnegotiationneeded = null;
        peer.pc.onconnectionstatechange = null;
        peer.pc.close();
        this.peers.delete(peerId);
    }

    closeAll() {
        [...this.peers.keys()].forEach((peerId) => this.remove(peerId));
    }

    private ensurePeer(peerId: string): Peer {
        const existing = this.peers.get(peerId);

        if (existing) {
            return existing;
        }

        const pc = new RTCPeerConnection({ iceServers: this.options.iceServers });
        const peer: Peer = {
            pc,
            // Deterministic roles: exactly one side of every pair is polite.
            polite: this.selfId ? this.selfId < peerId : true,
            makingOffer: false,
            ignoreOffer: false,
            isSettingRemoteAnswerPending: false,
            pendingCandidates: [],
            senders: {},
            stream: new MediaStream()
        };

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                this.send(peerId, { ice: candidate.toJSON() });
            }
        };

        pc.onnegotiationneeded = async () => {
            try {
                peer.makingOffer = true;
                await pc.setLocalDescription();
                this.send(peerId, { sdp: pc.localDescription?.toJSON() });
            } catch (error) {
                this.options.onError("Could not start a connection to another participant.", error);
            } finally {
                peer.makingOffer = false;
            }
        };

        pc.ontrack = ({ track }) => {
            // Build our own stream (the remote side may send no stream ids) and
            // give it a new identity on every change: script-side addTrack()
            // fires no "addtrack" event, so consumers re-read on identity change.
            const others = peer.stream.getTracks().filter((existingTrack) => existingTrack.kind !== track.kind);
            peer.stream = new MediaStream([...others, track]);
            this.options.onRemoteStream(peerId, peer.stream);
        };

        pc.onconnectionstatechange = () => {
            this.options.onConnectionState(peerId, pc.connectionState);

            if (pc.connectionState === "failed") {
                // Triggers negotiationneeded with an ICE restart on either side.
                pc.restartIce();
            }
        };

        this.peers.set(peerId, peer);
        this.options.onRemoteStream(peerId, peer.stream);
        return peer;
    }

    /** On the answering side, send on the transceivers the offer created. */
    private adoptRemoteTransceivers(peer: Peer) {
        peer.pc.getTransceivers().forEach((transceiver) => {
            const kind = transceiver.receiver.track.kind as "audio" | "video";

            if (!peer.senders[kind] && transceiver.mid !== null) {
                transceiver.direction = "sendrecv";
                peer.senders[kind] = transceiver.sender;
            }
        });

        this.syncSenders(peer);
    }

    private syncSenders(peer: Peer) {
        KINDS.forEach((kind) => {
            const sender = peer.senders[kind];
            const track = this.tracks[kind];

            if (sender && sender.track !== track) {
                sender.replaceTrack(track).catch((error: unknown) => {
                    this.options.onError("Could not update the media you are sending.", error);
                });
            }
        });
    }

    private async flushCandidates(peer: Peer) {
        const candidates = peer.pendingCandidates.splice(0);

        for (const candidate of candidates) {
            try {
                await peer.pc.addIceCandidate(candidate);
            } catch (error) {
                this.options.onError("A network route to another participant was rejected.", error);
            }
        }
    }

    private send(toId: string, payload: SignalPayload) {
        this.options.sendSignal(toId, JSON.stringify(payload));
    }
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
];

const ICE_URL = /^(stun|turns?):\S+$/i;
const RELAY_URL = /^turns?:/i;

const warnIceConfig = (message: string) => {
    // Deliberately never logs the entry itself: it holds the TURN credential.
    console.warn(`VITE_ICE_SERVERS: ${message} Calls fall back to STUN for those servers.`);
};

/**
 * Returns the entry in the shape RTCPeerConnection accepts, or null. The
 * browser throws on construction for an unknown scheme or a TURN URL without
 * credentials, which would break every call, so such entries are dropped.
 */
const toIceServer = (entry: unknown): RTCIceServer | null => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return null;
    }

    const { urls, username, credential } = entry as Record<string, unknown>;
    const list: unknown[] = typeof urls === "string" ? [urls] : Array.isArray(urls) ? urls : [];

    if (list.length === 0 || !list.every((url): url is string => typeof url === "string" && ICE_URL.test(url))) {
        return null;
    }

    const isRelay = list.some((url) => RELAY_URL.test(url as string));

    if (isRelay && (typeof username !== "string" || !username || typeof credential !== "string" || !credential)) {
        return null;
    }

    return isRelay
        ? { urls: list as string[], username: username as string, credential: credential as string }
        : { urls: list as string[] };
};

/**
 * STUN alone cannot traverse symmetric NATs, carrier-grade NAT or strict
 * corporate firewalls; a TURN relay is needed for those networks.
 *
 * VITE_ICE_SERVERS takes a JSON array of RTCIceServer, such as the ICE servers
 * array a TURN provider issues. Valid entries are added to the default STUN
 * servers (never replacing them); invalid entries are dropped with a warning,
 * and missing or malformed JSON leaves the defaults on their own.
 */
export const resolveIceServers = (raw: string | undefined = import.meta.env.VITE_ICE_SERVERS): RTCIceServer[] => {
    if (!raw?.trim()) {
        return DEFAULT_ICE_SERVERS;
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch {
        warnIceConfig("is not valid JSON (keys and strings need double quotes, no trailing commas).");
        return DEFAULT_ICE_SERVERS;
    }

    if (!Array.isArray(parsed)) {
        warnIceConfig("must be a JSON array of ICE servers.");
        return DEFAULT_ICE_SERVERS;
    }

    const seen = new Set(DEFAULT_ICE_SERVERS.flatMap(({ urls }) => urls).map((url) => url.toLowerCase()));
    const configured: RTCIceServer[] = [];

    parsed.forEach((entry, index) => {
        const server = toIceServer(entry);

        if (!server) {
            warnIceConfig(`entry ${index} was ignored: it needs "urls" (stun:, turn: or turns:) and, for turn:, a username and credential.`);
            return;
        }

        // Skip URLs that are already listed, such as the default STUN servers.
        const urls = (server.urls as string[]).filter((url) => !seen.has(url.toLowerCase()));
        urls.forEach((url) => seen.add(url.toLowerCase()));

        if (urls.length > 0) {
            configured.push({ ...server, urls });
        }
    });

    return [...DEFAULT_ICE_SERVERS, ...configured];
};
