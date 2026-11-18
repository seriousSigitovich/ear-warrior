// A wood-cut cover with the tune's name added: the hook frame (`render-rising.mjs --cover`, copied to public/<name>-cover-base.png) plus a composer / title
// block over the dark foot of the neck, in the film's own type (Baskerville, cream + lilac). Rendered by `render-rising.mjs --titled`.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { SERIF, WOOD } from './RisingWood';

export const TitleCover: React.FC<{ base: string; kicker: string; title: string }> = ({ base, kicker, title }) => (
  <AbsoluteFill style={{ background: '#130A22' }}>
    <Img src={staticFile(base)} style={{ width: 1080, height: 1920 }} />
    <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(19,10,34,0) 66%, rgba(19,10,34,0.82) 80%, rgba(19,10,34,0.92) 100%)' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1560, textAlign: 'center', fontFamily: SERIF, textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}>
      <div style={{ fontSize: 40, letterSpacing: '0.42em', textTransform: 'uppercase', color: WOOD.lilac, marginBottom: 6, paddingLeft: '0.42em' }}>{kicker}</div>
      <div style={{ fontSize: 150, lineHeight: 1.05, fontStyle: 'italic', color: WOOD.cream }}>{title}</div>
    </div>
  </AbsoluteFill>
);
