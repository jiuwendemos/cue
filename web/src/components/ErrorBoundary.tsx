import { Component, type ErrorInfo, type ReactNode } from "react";
import { Icon } from "./Icon";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("CUE render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty" style={{ paddingTop: 60, maxWidth: 640, margin: "0 auto" }}>
          <div className="empty-icon"><Icon name="alert" size={22} /></div>
          <h1 className="page-title">This surface hit a snag.</h1>
          <p className="page-sub" style={{ margin: "10px auto 8px" }}>
            The show is still in the pack. The surface failed to render.
          </p>
          <pre className="mono xsmall" style={{ whiteSpace: "pre-wrap", textAlign: "left", color: "var(--bad)", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginTop: 12 }}>
            {this.state.error.message}
          </pre>
          <div className="row gap8 mt12" style={{ justifyContent: "center" }}>
            <button className="btn primary" onClick={() => { this.setState({ error: null }); }}>
              Try again
            </button>
            <button className="btn" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
