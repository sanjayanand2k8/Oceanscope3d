import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[OceanScope] page render failed", error, info.componentStack);
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <section role="alert" className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600">Page render interrupted</p>
          <h2 className="mt-2 text-lg font-semibold text-navy-900">This view could not finish rendering.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            The page hit a temporary layout or visualization error. Try rendering it again; your current filters and settings are preserved.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-md bg-navy-800 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
          >
            Try again
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
