export type LinkedInProfileUrlAudit = { normalizedUrl: string | null; reason: "valid" | "missing" | "malformed" | "unsupported_domain" | "unsupported_path" };
export function auditLinkedInProfileUrl(value: unknown): LinkedInProfileUrlAudit {
  const raw=String(value||"").trim(); if(!raw)return{normalizedUrl:null,reason:"missing"};
  let parsed:URL; try{parsed=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`)}catch{return{normalizedUrl:null,reason:"malformed"}}
  const host=parsed.hostname.toLowerCase().replace(/^www\./,"");
  if(host!=="linkedin.com"&&!host.endsWith(".linkedin.com"))return{normalizedUrl:null,reason:"unsupported_domain"};
  const parts=parsed.pathname.split("/").filter(Boolean);
  if(parts.length!==2||parts[0].toLowerCase()!=="in"||!/^[a-z0-9_%.-]+$/i.test(parts[1]))return{normalizedUrl:null,reason:"unsupported_path"};
  return{normalizedUrl:`https://www.linkedin.com/in/${parts[1]}`,reason:"valid"};
}
export const supportedLinkedInProfileUrl=(value:unknown)=>auditLinkedInProfileUrl(value).normalizedUrl;
