"use client";
import { useEffect, useRef, type ReactNode } from "react";

export default function TransactionalDrawer({id,title,description,onCancel,children,footer}:{id:string;title:string;description:string;onCancel:()=>void;children:ReactNode;footer:ReactNode}){
 const panelRef=useRef<HTMLElement|null>(null),closeRef=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  closeRef.current?.focus();
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();onCancel();return}
   if(event.key!=="Tab"||!panelRef.current)return;
   const focusable=[...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')];
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener("keydown",keydown);document.body.style.overflow="hidden";
  return()=>{document.removeEventListener("keydown",keydown);document.body.style.overflow="";previous?.focus()};
 },[onCancel]);
 return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-[2px]" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onCancel()}}>
  <section ref={panelRef} id={id} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="flex h-full w-full max-w-2xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl shadow-black/60">
   <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-5 sm:px-7">
    <div><h2 id={`${id}-title`} className="text-xl font-semibold text-white">{title}</h2><p id={`${id}-description`} className="mt-1 text-sm text-slate-400">{description}</p></div>
    <button ref={closeRef} type="button" onClick={onCancel} aria-label={`Close ${title}`} className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:border-slate-500 hover:text-white">Close</button>
   </header>
   <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
   <footer className="sticky bottom-0 border-t border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur sm:px-7">{footer}</footer>
  </section>
 </div>
}
