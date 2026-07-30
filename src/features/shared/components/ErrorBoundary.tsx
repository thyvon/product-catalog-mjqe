import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-sm font-bold text-foreground">Something went wrong</h2>
            <p className="text-xs text-muted-foreground font-mono bg-muted p-3 rounded-xl">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <Button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            >
              <RefreshCw /> Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
