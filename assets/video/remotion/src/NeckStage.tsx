// Shared stage for scenes 2 and 3: the fretboard tilted in perspective, a camera that glides to the latest note, a clip rect so zoom never spills.
import React, { ReactNode } from 'react';
import { BW, BH } from './Board';
import type { Cam } from './camera';

export const BOARD_TOP = 505;
export const BOARD_LEFT = (1080 - BW) / 2;

export const NeckStage: React.FC<{ cam: Cam; tilt: number; roll: number; children: ReactNode }> = ({ cam, tilt, roll, children }) => (
  <div style={{ position: 'absolute', left: BOARD_LEFT, top: BOARD_TOP, width: BW, height: BH, perspective: 2400 }}>
    <div style={{ width: BW, height: BH, transform: `rotateX(${tilt}deg) rotateZ(${roll}deg)`, transformOrigin: '50% 50%', boxShadow: '0 60px 120px rgba(0,0,0,0.5)', borderRadius: 30 }}>
      <div style={{ width: BW, height: BH, borderRadius: 30, overflow: 'hidden' }}>
        <div style={{ width: BW, height: BH, transformOrigin: '0 0', transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})` }}>{children}</div>
      </div>
    </div>
  </div>
);
