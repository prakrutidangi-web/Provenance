import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "@fontsource-variable/instrument-sans";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./styles.css";
import "./design.css"; // design tokens and the final visual layer

// Tracking is NOT initialized here: the pixel snippet in index.html handles it,
// exactly as it would on any advertiser's site, React or not.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
