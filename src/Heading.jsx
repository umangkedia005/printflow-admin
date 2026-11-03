import { C, SERIF, eyebrow } from './theme'

export default function Heading({ eyebrow: kicker, title, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
      <div>
        {kicker && <div style={eyebrow}>{kicker}</div>}
        <h1 style={{ fontFamily: SERIF, fontSize: '30px', fontWeight: 500, letterSpacing: '-0.01em', marginTop: kicker ? '6px' : 0, color: C.ink }}>{title}</h1>
      </div>
      {children && <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}
