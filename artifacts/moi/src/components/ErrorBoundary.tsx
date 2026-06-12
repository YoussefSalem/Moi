import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback UI. Defaults to a full-page "Something went wrong" screen. */
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
  /** Called when an error is caught — use for logging. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in the subtree and shows a graceful fallback.
 * Wrap page-level sections and major UI islands so one crash doesn't
 * take down the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { fallback } = this.props;
    if (fallback !== undefined) {
      return typeof fallback === "function" ? fallback(this.reset) : fallback;
    }

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f5",
          gap: 20,
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28,
            fontWeight: 400,
            color: "#1e1814",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          Something went wrong
        </p>
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 12,
            color: "rgba(30,24,20,0.55)",
            letterSpacing: "0.06em",
            maxWidth: 300,
            lineHeight: 1.8,
            margin: 0,
          }}
        >
          Please refresh the page or try again.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            onClick={this.reset}
            style={{
              padding: "11px 28px",
              background: "transparent",
              color: "#1e1814",
              border: "1px solid rgba(30,24,20,0.3)",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "11px 28px",
              background: "#1e1814",
              color: "#faf8f5",
              border: "none",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Lighter inline fallback for non-critical sections (cart drawer, modals, etc.)
 * Shows a small error notice instead of a full-page takeover.
 */
export function InlineErrorFallback({ reset }: { reset?: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 120,
        gap: 12,
        padding: "24px 16px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 11,
          color: "rgba(30,24,20,0.55)",
          letterSpacing: "0.12em",
          margin: 0,
        }}
      >
        Something went wrong loading this section.
      </p>
      {reset && (
        <button
          onClick={reset}
          style={{
            padding: "8px 20px",
            background: "transparent",
            color: "#1e1814",
            border: "1px solid rgba(30,24,20,0.25)",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
