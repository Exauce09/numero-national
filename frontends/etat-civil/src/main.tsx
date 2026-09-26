import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { wipeAllAdultsOnce } from "./registry";
import { seedBatchBirths } from "./seedBatchBirths";
import "./styles.css";

wipeAllAdultsOnce();

void seedBatchBirths().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
});
