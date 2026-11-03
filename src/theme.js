// "Editorial atelier": ivory paper, ink type, hairline rules and a single
// gold accent. Serif (Fraunces) for headings and figures, Inter for UI.
export const C = {
  paper: '#FBF9F4',
  card: '#FFFFFF',
  ink: '#1A1814',
  inkSoft: '#3D3A33',
  muted: '#8C8577',
  faint: '#B5AE9F',
  rule: '#E9E3D6',
  ruleSoft: '#F1ECE1',
  wash: '#F6F2E8',
  gold: '#A8864A',
  goldWash: '#F5EEDF',
  blue: '#2B5BA8',
  blueWash: '#EAF0FA',
  green: '#3F6B3A',
  greenWash: '#ECF2E8',
  red: '#A33A2B',
  redWash: '#FBECE8',
}

export const SERIF = "'Fraunces', Georgia, serif"
export const SANS = "Inter, system-ui, sans-serif"

export const panel = { background: C.card, border: `1px solid ${C.rule}`, borderRadius: '14px' }
export const input = { padding: '9px 12px', border: `1px solid ${C.rule}`, borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', width: '100%', fontFamily: SANS, background: C.card, color: C.ink }
export const label = { display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '6px', letterSpacing: '0.04em' }
export const button = { background: 'transparent', color: C.ink, border: `1px solid ${C.rule}`, borderRadius: '99px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500, fontFamily: SANS }
export const primary = { ...button, background: C.ink, color: C.paper, border: `1px solid ${C.ink}` }
export const outline = { ...button, border: `1px solid ${C.ink}` }
export const eyebrow = { fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, fontWeight: 600 }
export const th = { padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: C.muted, letterSpacing: '0.06em', borderBottom: `1px solid ${C.rule}` }
export const td = { padding: '14px 16px', fontSize: '13px', borderBottom: `1px solid ${C.ruleSoft}`, verticalAlign: 'middle' }
export const empty = { padding: '64px 24px', textAlign: 'center', color: C.muted, fontFamily: SERIF, fontSize: '16px' }
