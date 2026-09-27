import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { purgeLocalDraftActsOnce, wipeAllAdultsOnce } from "./registry";
import "./styles.css";

wipeAllAdultsOnce();
purgeLocalDraftActsOnce();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
