// Минимальный hash-роутер без зависимостей.
//   #/          — лендинг
//   #/team      — рабочее место команды
//   #/business  — кабинет бизнеса, #/new — мастер создания задачи
import { useEffect, useState } from "react";

export function useHashRoute(): string {
  const read = () => window.location.hash.replace(/^#/, "") || "/";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function go(route: string) {
  window.location.hash = route;
}
