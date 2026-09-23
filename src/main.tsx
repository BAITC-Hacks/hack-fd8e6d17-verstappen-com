import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import TeamApp from "./team/TeamApp";
import { useHashRoute } from "./router";

function Root() {
  const route = useHashRoute();
  if (route.startsWith("/team")) return <TeamApp />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
