import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Qwixx from "./qwixx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Qwixx />
  </StrictMode>
);
