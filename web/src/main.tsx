import "./styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { getActiveToken, getSavedUsers } from "./auth";
import { applyThemeHue, DEFAULT_THEME_HUE } from "./theme";

const activeToken = getActiveToken();
const activeUser = getSavedUsers().find((user) => user.token === activeToken);
applyThemeHue(activeUser?.themeHue ?? DEFAULT_THEME_HUE);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.log("Service worker registration failed:", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
