/** Same-tab login draft only. Never stores identity, tokens or generated results. */
export interface RouteDraft {region:string;purpose:string;duration:string;budgetMin:number;budgetMax:number;visitDate:string;acknowledged:boolean;responseLocale:'ko'|'en'|'ja'}
const KEY='kride.route-draft.v1',TTL=10*60*1000;
export function rememberRouteDraft(draft:RouteDraft):void {try{sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),draft}))}catch{/* Login remains available if browser storage is disabled. */}}
export function consumeRouteDraft():RouteDraft|null {
 try{const raw=sessionStorage.getItem(KEY);sessionStorage.removeItem(KEY);if(!raw)return null;const {at,draft:d}=JSON.parse(raw);
  if(!Number.isFinite(at)||Date.now()-at<0||Date.now()-at>TTL||!d||!['서울','부산','제주'].includes(d.region)||!['성지순례','맛집투어','자연·힐링'].includes(d.purpose)||!['당일치기','1박2일'].includes(d.duration)||!['ko','en','ja'].includes(d.responseLocale)||typeof d.acknowledged!=='boolean'||!Number.isSafeInteger(d.budgetMin)||!Number.isSafeInteger(d.budgetMax)||d.budgetMin<0||d.budgetMax<d.budgetMin||d.budgetMax>100000000||typeof d.visitDate!=='string'||(d.visitDate!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(d.visitDate)))return null;
  return d;
 }catch{return null}
}
