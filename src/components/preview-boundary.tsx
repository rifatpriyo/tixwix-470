"use client";
import { Component, type ReactNode } from "react";
export class PreviewBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="status">
        The 3D preview could not load. You can still choose seats using the map.
      </p>
    ) : (
      this.props.children
    );
  }
}
