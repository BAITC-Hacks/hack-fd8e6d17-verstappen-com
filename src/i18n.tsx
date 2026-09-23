import { useEffect, useState } from "react";
export type Lang="ru"|"en";
const KEY="ai-sana-lang";
export function getLang():Lang{try{return localStorage.getItem(KEY)==="en"?"en":"ru"}catch{return"ru"}}
export function setLanguage(lang:Lang){try{localStorage.setItem(KEY,lang)}catch{} window.dispatchEvent(new CustomEvent("ai-sana-language",{detail:lang}))}
export function useLanguage(){const [lang,setLang]=useState<Lang>(getLang);useEffect(()=>{const f=(e:Event)=>setLang((e as CustomEvent<Lang>).detail);window.addEventListener("ai-sana-language",f);return()=>window.removeEventListener("ai-sana-language",f)},[]);return [lang,(v:Lang)=>setLanguage(v)] as const}
export function LanguageSwitch(){const [lang,setLang]=useLanguage();return <div className="lang-switch" aria-label="Language"><button className={lang==="ru"?"active":""} onClick={()=>setLang("ru")}>RU</button><button className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button></div>}
export const tr=(lang:Lang,ru:string,en:string)=>lang==="ru"?ru:en;
