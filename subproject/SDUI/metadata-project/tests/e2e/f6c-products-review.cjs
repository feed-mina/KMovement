// Actual Next UI -> loopback HTTP -> actual controller, isolated H2 and real ephemeral Redis.
const {chromium,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:20000});
const fs=require('node:fs'),path=require('node:path');
const base=process.env.F6C_REVIEW_URL||'http://localhost:3105',api=process.env.F6C_API_URL,out=process.env.F6C_EVIDENCE_DIR;
if(!api||!out)throw new Error('Use PublicProductBrowserEvidenceTest');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});const evidence=[];
 try{for(const width of [360,390,768,960,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultNavigationTimeout(120000);
  const reads=[],forbidden=[],errors=[],screens=[],apiProbes=[];let phase='C02',failOnce=false;
  page.on('pageerror',e=>errors.push(e.message));
  if(width===360){for(const suffix of ['q='+ 'a'.repeat(121),'artistId=0','eventId=-1']){
   const res=await context.request.get(api+'/api/v1/kpop/product-candidates?view=public&'+suffix);expect(res.status()).toBe(400);
   apiProbes.push({request:'GET /api/v1/kpop/product-candidates?view=public&'+suffix,status:res.status(),body:await res.json()});
  }}
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());if(u.origin!==base)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();
   if(u.pathname==='/api/auth/me'||u.pathname==='/api/auth/refresh')return route.fulfill({status:401,json:{status:'error'}});
   if(u.pathname.startsWith('/api/ui/'))return route.fulfill({status:500,json:{status:'error'}});
   if(/upload|analysis|jobs|chroma|saved-items|payment/.test(u.pathname)||req.method()!=='GET')forbidden.push({path:u.pathname,method:req.method()});
   if(u.pathname==='/api/v1/kpop/product-candidates'){
    if(failOnce){failOnce=false;reads.push({phase,path:u.pathname+u.search,status:500,source:'intentional UI failure injection'});return route.fulfill({status:500,json:{status:'error'}});}
    const res=await route.fetch({url:api+u.pathname+u.search});reads.push({phase,path:u.pathname+u.search,method:req.method(),cookie:Boolean(req.headers().cookie),status:res.status(),headers:res.headers(),body:await res.json(),source:'actual controller / isolated H2 / real Redis'});return route.fulfill({response:res});
   }return route.fulfill({json:{status:'success',data:[]}});
  });
  const root=()=>page.getByRole('region',{name:'공개 상품 후보'});
  const shot=async name=>{await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));const layout=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));expect(layout.documentWidth).toBeLessThanOrEqual(width);screens.push({name,layout});await page.screenshot({path:path.join(out,`${width}-${name}.png`),fullPage:true});};
  const search=async q=>{await root().getByLabel('상품명 또는 브랜드').fill(q);const pending=q.trim().length<=120?page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/api/v1/kpop/product-candidates'&&u.searchParams.get('q')===q.trim();}):null;await root().getByRole('button',{name:'후보 검색',exact:true}).click();if(pending)await pending;};
  await page.goto(base+'/view/KPOP_PRODUCTS');await expect(root().getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button',{name:'거부',exact:true}).click();
  await expect(root().getByText('운영 검수 카탈로그',{exact:false})).toHaveCount(3);await expect(root().getByText(/시간대 미기록/)).toHaveCount(3);
  await expect(root().getByRole('link')).toHaveCount(1);await expect(root().getByRole('button',{name:/저장/})).toHaveCount(0);await shot('C02-evidence');
  phase='C01';await search(' light ');await expect(root().getByRole('listitem')).toHaveCount(1);await expect(root().getByRole('heading',{name:'응원봉 후보'})).toBeVisible();await shot('C01-brand');
  await search('응원봉');await expect(root().getByRole('heading',{name:'공개 후보 1개'})).toBeVisible();await shot('C01-name');
  const before=reads.length;await search('a'.repeat(121));await expect(root().getByRole('alert')).toContainText('120자');expect(reads.length).toBe(before);await shot('C01-invalid');
  phase='C03';await search('WEAK');await expect(root().getByRole('status')).toContainText('공개 근거가 충분한 후보가 없어요');await expect(root().getByText(/동일 상품·정품·구매 적합성을 보증하지/)).toBeVisible();await shot('C03-insufficient');
  await search('no-match');await expect(root().getByRole('heading',{name:'공개 후보 0개'})).toBeVisible();await shot('C03-unmatched');
  phase='C06';await root().getByRole('button',{name:'초기화'}).click();await expect(root().getByRole('listitem')).toHaveCount(3);
  const link=root().getByRole('link');await expect(link).toHaveAttribute('href','https://example.com/products/1');await expect(link).toHaveAttribute('target','_blank');
  await context.route('https://example.com/products/1',r=>r.fulfill({contentType:'text/html',body:'<h1>출처 이동 검증용 응답</h1>'}));
  const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState();expect(popup.url()).toBe('https://example.com/products/1');await popup.close();await shot('C06-link');
  phase='500';failOnce=true;await search('LIGHT');await expect(root().getByRole('alert')).toContainText('불러오지 못했어요');await shot('500');
  await root().getByRole('button',{name:'다시 시도'}).focus();await page.keyboard.press('Enter');await expect(root().getByRole('listitem')).toHaveCount(1);await expect(root().locator('h2')).toBeFocused();await shot('retry');
  expect(forbidden).toEqual([]);expect(errors).toEqual([]);expect(reads.filter(x=>x.status!==500).every(x=>x.method==='GET'&&!x.cookie)).toBe(true);
  evidence.push({width,source:'Next -> loopback MVC/SQL/H2 + ephemeral Redis, no deployed security/proxy; 500 and external destination stubbed',screens,reads,apiProbes,forbidden,errors});fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await context.close();
 }}finally{await browser.close();}console.log(`PASS ${evidence.length} widths / C01-C06 with separate cache meter evidence`);
})().catch(e=>{console.error(e);process.exitCode=1;});
