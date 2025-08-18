import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter basename="/admin">
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// Register service worker for push notifications if supported
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/src/service-worker.ts").catch((err) => {
      console.error("Service worker registration failed", err);
    });
  });
}
