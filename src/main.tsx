import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import BusinessApp from "./business/BusinessApp";
import TeamApp from "./team/TeamApp";
import Waves from "./Waves";
import { useHashRoute } from "./router";

//   #/              — лендинг
//   #/new           — лендинг с открытым мастером создания задачи
//   #/team          — рабочее место команды
//   #/business[/id] — кабинет бизнеса (id — сразу открыть задачу)
function Page() {
  const route = useHashRoute();
  if (route.startsWith("/team")) return <TeamApp />;
  if (route.startsWith("/business")) return <BusinessApp route={route} />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Waves />
    <Page />
  </StrictMode>
);
