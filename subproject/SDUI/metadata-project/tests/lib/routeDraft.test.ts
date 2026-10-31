import {consumeRouteDraft,rememberRouteDraft,RouteDraft} from '@/lib/kride/routeDraft';
const draft:RouteDraft={region:'서울',purpose:'성지순례',duration:'당일치기',budgetMin:10000,budgetMax:50000,visitDate:'2026-11-04',acknowledged:false,responseLocale:'ko'};
beforeEach(()=>sessionStorage.clear());
test('restores an explicit draft once without changing optional consent',()=>{rememberRouteDraft(draft);expect(consumeRouteDraft()).toEqual(draft);expect(consumeRouteDraft()).toBeNull()});
test('discards an expired login draft',()=>{sessionStorage.setItem('kride.route-draft.v1',JSON.stringify({at:Date.now()-11*60*1000,draft}));expect(consumeRouteDraft()).toBeNull()});
test.each([{...draft,budgetMax:-1},{...draft,region:'unknown'},{...draft,acknowledged:'true'},{...draft,responseLocale:'xx'}])('rejects invalid stored input',input=>{sessionStorage.setItem('kride.route-draft.v1',JSON.stringify({at:Date.now(),draft:input}));expect(consumeRouteDraft()).toBeNull()});
