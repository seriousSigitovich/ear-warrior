export const FPS: number;
export const DURATION: number;
export const T: { listen: number; earDown: number; play: number; miss: number; fix: number; chord: number };
export const HEARD_BEAT: number;
export interface HeardNote { t: number; midi: number; f: number }
export interface PlayedNote { t: number; midi: number; f: number; ok: boolean; idx: number }
export const HEARD: HeardNote[];
export const ATTEMPTS: PlayedNote[];
