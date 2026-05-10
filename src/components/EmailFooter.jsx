export default function EmailFooter() {
  return (
    <div style={{
      marginTop: "40px",
      paddingTop: "20px",
      borderTop: "1px solid rgba(255, 255, 255, 0.1)",
      textAlign: "center",
      fontSize: "12px",
      color: "#a8a8c0"
    }}>
      <div style={{ marginBottom: "16px" }}>
        <svg width="120" height="40" viewBox="0 0 120 40" style={{ display: "inline-block" }}>
          {/* Outlined M letter with neon glow */}
          <defs>
            <filter id="neonGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* M letter outline */}
          <text x="12" y="28" fontSize="28" fontWeight="bold" fill="none" stroke="#a764e6" strokeWidth="2" filter="url(#neonGlow)">M</text>
          
          {/* iO text */}
          <text x="48" y="28" fontSize="24" fontWeight="600" fill="#f4f4fa">iO</text>
        </svg>
      </div>
      
      <p style={{ margin: "8px 0" }}>Marketing iO</p>
      <p style={{ margin: "4px 0", fontSize: "11px" }}>
        <a href="https://marketingio.co.za" style={{ color: "#a764e6", textDecoration: "none" }}>marketingio.co.za</a>
      </p>
      
      <div style={{ marginTop: "16px", fontSize: "11px" }}>
        <p style={{ margin: "4px 0" }}>© 2026 Marketing iO. All rights reserved.</p>
        <p style={{ margin: "4px 0", color: "#6b6b85" }}>
          <a href="{{unsubscribe_link}}" style={{ color: "#6b6b85", textDecoration: "none" }}>Unsubscribe</a> | 
          <a href="https://marketingio.co.za/privacy" style={{ color: "#6b6b85", textDecoration: "none", marginLeft: "4px" }}>Privacy</a>
        </p>
      </div>
    </div>
  );
}