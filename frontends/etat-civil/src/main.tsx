import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { syncHospitalFacilitiesFromRequests } from "./accountRegistration";
import { migrateAccountsToCurrentRoles } from "./auth";
import { refreshHealthSessionRoleTitle } from "./healthAuth";
import { purgeLocalDraftActsOnce, wipeAllAdultsOnce } from "./registry";
import { applyDevResetFromUrl } from "./resetLocalDevStore";
import "./styles.css";

applyDevResetFromUrl();
wipeAllAdultsOnce();
purgeLocalDraftActsOnce();
syncHospitalFacilitiesFromRequests();
migrateAccountsToCurrentRoles();
refreshHealthSessionRoleTitle();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
