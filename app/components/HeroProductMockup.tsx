const waveform = [26, 42, 18, 58, 34, 72, 48, 84, 40, 66, 30, 54, 76, 38, 62, 24, 48, 68, 36, 52, 28, 44, 60, 32];

export function HeroProductMockup() {
  return (
    <div className="hero-product" aria-label="Easy License product preview" data-reveal="hero-product" data-parallax="24" data-tilt>
      <div className="hero-product-glow" />
      <div className="product-window">
        <div className="product-window-top">
          <span className="window-dot" />
          <span className="window-dot" />
          <span className="window-dot" />
          <span className="window-title">Your licensed music</span>
          <span className="status-pill status-live"><i /> Licence recorded</span>
        </div>
        <div className="product-window-body">
          <aside className="mock-sidebar" aria-hidden="true">
            <span className="mock-logo">e</span>
            <span className="mock-side-line is-active" />
            <span className="mock-side-line" />
            <span className="mock-side-line" />
            <span className="mock-side-line short" />
          </aside>
          <div className="mock-content">
            <div className="mock-content-head">
              <div>
                <span className="mock-kicker">NOW PLAYING</span>
                <strong>Window Seat</strong>
                <small>Catalogue preview</small>
              </div>
              <button className="round-play" type="button" aria-label="Play catalogue preview">▶</button>
            </div>
            <div className="waveform" aria-hidden="true">
              {waveform.map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} className={index < 9 ? "is-played" : ""} />
              ))}
            </div>
            <div className="mock-meta-row">
              <span>Dreamy</span>
              <span>76 BPM</span>
              <span>Instrumental</span>
              <span>2:41</span>
            </div>
            <div className="mock-license-card">
              <div className="mock-license-icon">✓</div>
              <div>
                <span>Licence active</span>
                <strong>Creator · 1 channel covered</strong>
              </div>
              <button type="button">Copy credit</button>
            </div>
          </div>
        </div>
      </div>
      <div className="floating-card floating-channel">
        <span className="floating-icon">▶</span>
        <span><small>YouTube channel</small><strong>Connected</strong></span>
        <i />
      </div>
      <div className="floating-card floating-rights">
        <span className="floating-check">✓</span>
        <span><small>Rights status</small><strong>Ready for review</strong></span>
      </div>
    </div>
  );
}
