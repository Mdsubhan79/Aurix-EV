import React from "react";

// Catches render-time crashes anywhere below it and shows a real message
// instead of leaving the whole page blank. Also logs the full error and
// stack to the console so it's visible in DevTools (F12 -> Console) even
// on the deployed site.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("VoltLine crashed:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", background: "#12151A", color: "#F2F3F0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "monospace", padding: 24, textAlign: "center"
        }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#FF6B6B" }}>
              Something crashed while loading the app
            </div>
            <div style={{ fontSize: 13, color: "#8B93A1", marginBottom: 16 }}>
              Open DevTools (F12) → Console for the full error. Most common causes:
              a missing/incorrect VITE_API_URL environment variable, or the backend
              being unreachable (CORS / mixed http-vs-https).
            </div>
            <pre style={{
              background: "#171B23", border: "1px solid #232833", borderRadius: 8,
              padding: 14, fontSize: 12, textAlign: "left", overflowX: "auto", color: "#FF6B6B"
            }}>{String(this.state.error?.message || this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
