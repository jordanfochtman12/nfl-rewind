import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Keep a failed lazy screen from replacing the game with the browser's generic error view. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("NFL Rewind could not render this screen", error, info.componentStack);
  }

  private reload = () => {
    try {
      sessionStorage.removeItem("rewind:chunk-recovery");
    } catch {
      // Reloading is still available when storage is disabled.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-recovery" role="alert">
        <div className="app-recovery-card">
          <div className="app-recovery-mark" aria-hidden="true">NR</div>
          <p className="app-recovery-kicker">NFL REWIND · GAME PRESENTATION</p>
          <h1>This screen didn’t load</h1>
          <p className="app-recovery-copy">
            The game is still here. A screen file may have changed while this tab was open.
            Reload to reconnect to the current version.
          </p>
          <button className="app-recovery-button" onClick={this.reload} type="button">
            Reload game <span aria-hidden="true">↻</span>
          </button>
          <p className="app-recovery-footnote">Your dynasty save is stored separately and is not cleared by reloading.</p>
        </div>
      </main>
    );
  }
}
