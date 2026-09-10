import React, { Component, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message || "Erreur d’affichage" };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("ONIP render error", err, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "Segoe UI, sans-serif", maxWidth: 520 }}>
          <h1 style={{ color: "#ce1126" }}>ONIP — erreur d’affichage</h1>
          <p>{this.state.error}</p>
          <p style={{ color: "#5a6a85" }}>
            Sur Edge : Ctrl+Shift+R pour forcer le rechargement, ou ouvrez une fenêtre InPrivate.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.textContent = "Erreur: élément #root introuvable.";
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
