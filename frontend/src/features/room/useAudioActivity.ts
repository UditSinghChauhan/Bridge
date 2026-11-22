import { useEffect, useState } from "react";

let sharedContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
    if (typeof window === "undefined" || !("AudioContext" in window)) {
        return null;
    }

    sharedContext ??= new AudioContext();
    if (sharedContext.state === "suspended") {
        void sharedContext.resume().catch(() => undefined);
    }
    return sharedContext;
};

/**
 * Samples a track's loudness (RMS) every `intervalMs` through one shared
 * AudioContext and a cheap analyser. Returns a cleanup, or null when the
 * browser cannot analyse the track.
 */
const sampleTrack = (track: MediaStreamTrack, intervalMs: number, onRms: (rms: number) => void): (() => void) | null => {
    const context = getAudioContext();
    if (!context) {
        return null;
    }

    let source: MediaStreamAudioSourceNode;
    try {
        source = context.createMediaStreamSource(new MediaStream([track]));
    } catch {
        return null;
    }

    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const interval = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        onRms(track.enabled ? Math.sqrt(sum / samples.length) : 0);
    }, intervalMs);

    return () => {
        window.clearInterval(interval);
        source.disconnect();
        analyser.disconnect();
    };
};

const SAMPLE_MS = 120;
const THRESHOLD = 0.035;
const HOLD_MS = 450;

/**
 * True while the audio track carries speech-level signal, sampled ~8 times a
 * second rather than every animation frame.
 */
export function useAudioActivity(track: MediaStreamTrack | null | undefined, enabled = true): boolean {
    const [speaking, setSpeaking] = useState(false);

    useEffect(() => {
        if (!track || !enabled || track.readyState !== "live") {
            setSpeaking(false);
            return;
        }

        let lastLoudAt = 0;
        const stop = sampleTrack(track, SAMPLE_MS, (rms) => {
            const now = performance.now();
            if (rms > THRESHOLD) lastLoudAt = now;
            const next = now - lastLoudAt < HOLD_MS;
            setSpeaking((current) => (current === next ? current : next));
        });

        return () => {
            stop?.();
            setSpeaking(false);
        };
    }, [track, enabled]);

    return speaking;
}

/** Quiet room (-60 dBFS) reads 0, a raised voice (-12 dBFS) reads 1. */
export const levelFromRms = (rms: number): number => {
    if (rms <= 0) return 0;
    const db = 20 * Math.log10(rms);
    return Math.min(1, Math.max(0, (db + 60) / 48));
};

const METER_MS = 60;
const RELEASE = 0.65;

/**
 * Microphone level from 0 to 1 for a level meter: rises at once, falls back
 * smoothly, and only re-renders when the value moves visibly.
 */
export function useAudioLevel(track: MediaStreamTrack | null | undefined, enabled = true): number {
    const [level, setLevel] = useState(0);

    useEffect(() => {
        if (!track || !enabled || track.readyState !== "live") {
            setLevel(0);
            return;
        }

        let smoothed = 0;
        const stop = sampleTrack(track, METER_MS, (rms) => {
            const target = levelFromRms(rms);
            smoothed = target > smoothed ? target : smoothed * RELEASE + target * (1 - RELEASE);
            const next = Math.round(smoothed * 20) / 20;
            setLevel((current) => (current === next ? current : next));
        });

        return () => {
            stop?.();
            setLevel(0);
        };
    }, [track, enabled]);

    return level;
}
