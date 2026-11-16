import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@molcrafts/ui/styles.css";
import "@/styles/tailwind.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("MolPlot workbench needs #root");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
