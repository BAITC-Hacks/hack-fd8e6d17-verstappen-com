import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import TeamApp from "./team/TeamApp";
import BusinessApp from "./business/BusinessApp";
import { useHashRoute } from "./router";

function Root() {
  const route = useHashRoute();
  if (route.startsWith("/team")) return <TeamApp />;
  if (route.startsWith("/business")) return <BusinessApp />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
