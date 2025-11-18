import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { VesselProvider } from "./contexts/VesselContext";

createRoot(document.getElementById("root")!).render(
  <VesselProvider>
    <App />
  </VesselProvider>
);
