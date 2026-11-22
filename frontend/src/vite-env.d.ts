/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
    readonly REACT_APP_BACKEND_URL?: string;
    /** JSON array of RTCIceServer (e.g. a TURN provider's ICE servers array), added to the default STUN servers. */
    readonly VITE_ICE_SERVERS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
