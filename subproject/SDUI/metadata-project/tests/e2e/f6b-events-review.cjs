// Actual Next screen -> loopback HTTP bridge -> actual KpopController/SQL -> isolated H2.
// The bridge is not the full Spring Security/Traefik deployment. See EventCatalogBrowserEvidenceTest.
const {chromium,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:20000});
const fs=require('node:fs'),path=require('node:path');
const base=process.env.F6B_REVIEW_URL||'http://localhost:3104',api=process.env.F6B_API_URL,out=process.env.F6B_EVIDENCE_DIR;
if(!api||!out)throw new Error('Run via EventCatalogBrowserEvidenceTest with evidence and source paths.');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});const evidence=[];
 try{for(const width of [360,390,768,960,1440]){
  const timezoneId=width<768?'America/Los_Angeles':'Asia/Tokyo';
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultNavigationTimeout(120000);
  const apiProbes=[];
  if(width===360){for(const suffix of ['?from=2026-10-07&to=2026-10-06','?to=2026-10-04','?from=2026-02-30']){
   const response=await context.request.get(api+'/api/v1/kpop/events'+suffix);
   expect(response.status()).toBe(400);
   apiProbes.push({request:'GET /api/v1/kpop/events'+suffix,status:response.status(),body:await response.json(),source:'actual controller validation'});
  }}
  const reads=[],forbidden=[],errors=[],screens=[];let failOnce=false,phase='default';
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin!==base)return route.abort();
   if(!u.pathname.startsWith('/api/'))return route.continue();
   if(u.pathname==='/api/auth/me'||u.pathname==='/api/auth/refresh')return route.fulfill({status:401,json:{status:'error'}});
   if(u.pathname.startsWith('/api/ui/'))return route.fulfill({status:500,json:{status:'error'}});
   if(/follow|bookmark|saved-items|product-candidates|analysis/.test(u.pathname)||req.method()!=='GET')forbidden.push({path:u.pathname,method:req.method()});
   if(/^\/api\/v1\/kpop\/events(?:\/\d+)?$/.test(u.pathname)){
    if(failOnce){failOnce=false;reads.push({phase,path:u.pathname+u.search,status:500,source:'intentional failure injection'});return route.fulfill({status:500,json:{status:'error'}});}
    const res=await route.fetch({url:api+u.pathname+u.search});
    reads.push({phase,path:u.pathname+u.search,method:req.method(),cookie:Boolean(req.headers().cookie),status:res.status(),headers:res.headers(),body:await res.json(),source:'actual controller SQL over isolated H2'});
    return route.fulfill({response:res});
   }
   return route.fulfill({json:{status:'success',data:[]}});
  });
  const root=()=>page.getByRole('region',{name:'이벤트 공개 목록'});
  const shot=async name=>{await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));const layout=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));expect(layout.documentWidth).toBeLessThanOrEqual(width);screens.push({name,layout});await page.screenshot({path:path.join(out,`${width}-${name}.png`),fullPage:true});};
  const reset=async()=>{await root().getByRole('button',{name:'초기화',exact:true}).click();await expect(root().getByRole('article')).toHaveCount(4);};
  const apply=async values=>{for(const [name,value] of Object.entries(values))await root().getByLabel({from:'시작일',to:'종료일',region:'지역'}[name],{exact:true}).fill(value);await root().getByRole('button',{name:'적용',exact:true}).click();};
  await page.goto(base+'/view/KPOP_EVENTS');await expect(root().getByRole('article')).toHaveCount(4);
  await page.getByRole('button',{name:'거부',exact:true}).click();
  await expect(root().getByText('지난 서울 일정',{exact:true})).toHaveCount(0);
  await expect(root().getByText('미승인 아티스트 일정',{exact:true})).toHaveCount(0);
  await expect(root().getByRole('button',{name:'일정 저장',exact:true})).toHaveCount(0);
  await shot('B05-default');
  phase='B01';await apply({from:'2026-10-06'});await expect(root().getByRole('article')).toHaveCount(2);await expect(root().getByText('부산 미래 일정',{exact:true})).toBeVisible();await shot('B01-from');await reset();
  phase='B02';await apply({to:'2026-10-05'});await expect(root().getByRole('article')).toHaveCount(2);await expect(root().getByText('오늘 서울 일정',{exact:true})).toBeVisible();await shot('B02-to');
  const countBefore=reads.length;await apply({from:'2026-10-07',to:'2026-10-06'});await expect(root().getByRole('alert')).toContainText('빠를 수');expect(reads.length).toBe(countBefore);await shot('B02-reversed');
  await apply({from:'',to:'2026-10-04'});await expect(root().getByRole('alert')).toContainText('오늘보다');await shot('B02-past-end');await reset();
  phase='B03';await apply({region:' 서울 '});await expect(root().getByRole('article')).toHaveCount(2);await expect(root().getByText('서울특별시 별도 지역',{exact:true})).toHaveCount(0);await shot('B03-region');
  phase='B04';await root().getByRole('button',{name:'상세 보기'}).first().click();await expect(root().getByRole('heading',{name:'오늘 서울 일정'})).toBeVisible();await shot('B04-detail');
  await root().getByRole('link',{name:'이벤트 목록으로',exact:true}).click();await expect(root().getByRole('article')).toHaveCount(2);await expect(root().getByLabel('지역',{exact:true})).toHaveValue('서울');
  await page.goto(base+'/view/KPOP_EVENT_DETAIL/999');await expect(root().getByRole('status')).toContainText('공개된 이벤트를 찾을 수 없어요');await shot('B04-404');
  await page.goto(base+'/view/KPOP_EVENT_DETAIL/6');await expect(root().getByRole('status')).toContainText('공개된 이벤트를 찾을 수 없어요');await shot('approval-404');
  phase='B05';await page.goto(base+'/view/KPOP_EVENTS?from=2026-10-04&to=2026-10-04');await expect(root().getByRole('article')).toHaveCount(1);await expect(root().getByText('종료된 일정 · 행사 날짜 지남')).toBeVisible();await shot('B05-ended');
  await root().getByRole('button',{name:'상세 보기'}).click();await expect(root().getByText('종료된 일정 · 행사 날짜 지남')).toBeVisible();await shot('B05-ended-detail');
  phase='B06';await page.goto(base+'/view/KPOP_EVENTS?from=2026-11-01&to=2026-11-30');await expect(root().getByRole('status')).toContainText('선택한 기간·지역에 공개된 일정이 없어요');await shot('B06-empty');await reset();
  phase='500';failOnce=true;await page.goto(base+'/view/KPOP_EVENTS?region=서울');await expect(root().getByRole('alert')).toContainText('일정을 불러오지 못했어요');await shot('500');
  await root().getByRole('button',{name:'다시 시도'}).focus();await page.keyboard.press('Enter');await expect(root().getByRole('article')).toHaveCount(2);await expect(root().locator('h2')).toBeFocused();await shot('retry');
  expect(forbidden).toEqual([]);expect(errors).toEqual([]);expect(reads.filter(x=>x.status!==500).every(x=>x.method==='GET'&&!x.cookie)).toBe(true);
  evidence.push({width,timezoneId,source:'Next -> HTTP bridge -> actual Spring MVC/controller -> isolated H2; no production security/proxy; service workers blocked',screens,reads,apiProbes,forbidden,errors});
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await context.close();
 }}finally{await browser.close();}
 console.log(`PASS ${evidence.length} widths / B01-B06; ${out}`);
})().catch(e=>{console.error(e);process.exitCode=1});
