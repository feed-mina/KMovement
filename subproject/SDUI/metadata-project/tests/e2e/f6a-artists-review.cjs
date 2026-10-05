// F6-A UI integration: actual local Next app, explicitly synthetic API fixtures.
// Backend SQL/approval tests run separately in ArtistCatalogControllerTest.
const {chromium, expect: baseExpect} = require('@playwright/test');
const expect = baseExpect.configure({timeout: 20000});
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.F6A_REVIEW_URL || 'http://localhost:3103';
const out = process.env.F6A_EVIDENCE_DIR || path.resolve(__dirname, '../../../../../work-map-guide/f6a-implementation-20261005-7ac9/browser');
const artists = Array.from({length:10},(_,i)=>({id:i+1,slug:`artist-${i+1}`,nameKo:i===0?'검증용 긴 이름 아티스트 — 모바일에서도 이름과 소개가 잘리지 않아야 합니다':`검증 아티스트 ${i+1}`,nameEn:`Test Artist ${i+1}`,profile:'화면 검증용 예시 데이터입니다. 실제 아티스트 정보가 아닙니다.',approved:true}));
const hidden={id:99,slug:'hidden',nameKo:'비공개 검증 대상',approved:false};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const evidence=[];
 try {
  for(const width of [360,390,768,960,1440]){
   const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
   const page=await context.newPage();
   page.setDefaultNavigationTimeout(120000);
   const errors=[],reads=[],forbidden=[],shellAuth=[];
   let failOnce=false;
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const request=route.request(),u=new URL(request.url());
    if(u.origin!==base && !u.protocol.startsWith('data')) return route.abort();
    if(!u.pathname.startsWith('/api/')) return route.continue();
    if(u.pathname==='/api/auth/refresh'){shellAuth.push({path:u.pathname,method:request.method()});return route.fulfill({status:401,json:{status:'error'}});}
    if(/follow|bookmark|saved-items|analysis|events|product-candidates/.test(u.pathname)||request.method()!=='GET') forbidden.push({path:u.pathname,method:request.method()});
    if(u.pathname==='/api/auth/me')return route.fulfill({status:401,json:{status:'error'}});
    // Metadata failure is deliberate: F6-A must still render its public controller.
    if(u.pathname.startsWith('/api/ui/'))return route.fulfill({status:500,json:{status:'error'}});
    if(u.pathname.startsWith('/api/v1/kpop/artists')){
     reads.push({path:u.pathname,query:u.search,method:request.method(),cookie:Boolean(request.headers().cookie)});
     if(failOnce){failOnce=false;return route.fulfill({status:500,json:{status:'error'}});}
     const ref=u.pathname.split('/')[5];
     if(ref){
      const a=[...artists,hidden].find(x=>String(x.id)===ref||x.slug.toLowerCase()===ref.toLowerCase());
      if(!a?.approved)return route.fulfill({status:404,json:{status:'error'}});
      return route.fulfill({json:{status:'success',data:a}});
     }
     const q=(u.searchParams.get('q')||'').trim().toLowerCase(),n=Number(u.searchParams.get('page')||1);
     const matched=artists.filter(x=>x.nameKo.toLowerCase().includes(q)||x.nameEn.toLowerCase().includes(q));
     return route.fulfill({json:{status:'success',data:{items:matched.slice((n-1)*8,n*8),totalCount:matched.length,page:n,pageSize:8,query:q}}});
    }
    return route.fulfill({json:{status:'success',data:[]}});
   });
   const root=()=>page.getByRole('region',{name:'아티스트 공개 카탈로그'});
   const shot=async name=>page.screenshot({path:path.join(out,`${width}-${name}.png`),fullPage:true});
   await page.goto(base+'/view/KPOP_EXPLORE');
   const consent=page.getByRole('button',{name:'거부',exact:true});
   await expect(root().getByRole('article')).toHaveCount(8);
   await consent.click();
   await expect(root().getByRole('button',{name:'팔로우',exact:true})).toHaveCount(0);
   await expect(root().getByText('비공개 검증 대상')).toHaveCount(0);
   const layout=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));
   expect(layout.documentWidth).toBeLessThanOrEqual(width);
   await shot('list');
   await root().getByRole('button',{name:'다음',exact:true}).click();
   await expect(root().getByRole('article')).toHaveCount(2);
   await expect(page).toHaveURL(/page=2/);
   await root().getByRole('button',{name:'상세 보기'}).first().click();
   await expect(root().getByText('검증 아티스트 9',{exact:true})).toBeVisible();
   await expect(page).toHaveURL(/KPOP_ARTIST_DETAIL\/artist-9\?page=2/);
   await shot('slug-detail');
   await root().getByRole('link',{name:'아티스트 목록으로'}).click();
   await expect(root().getByRole('article')).toHaveCount(2);
   await root().getByLabel('아티스트 이름').fill('Test Artist 3');
   await root().getByLabel('아티스트 이름').press('Enter');
   await expect(root().getByRole('article')).toHaveCount(1);
   await expect(root().getByText('검증 아티스트 3',{exact:true})).toBeVisible();
   await expect(page).not.toHaveURL(/page=2/);
   await expect(root().locator('h2')).toBeFocused();
   await shot('search');
   await root().getByLabel('아티스트 이름').fill('nothing');
   await root().getByRole('button',{name:'검색',exact:true}).click();
   await expect(root().getByText(/조건에 맞는 아티스트가 없어요/)).toBeVisible();
   await shot('empty');
   await root().getByRole('button',{name:'초기화'}).click();
   await expect(root().getByRole('article')).toHaveCount(8);
   await page.goto(base+'/view/KPOP_ARTIST_DETAIL/9');
   await expect(root().getByText('검증 아티스트 9',{exact:true})).toBeVisible();
   await shot('numeric-detail');
   await page.goto(base+'/view/KPOP_ARTIST_DETAIL/99999');
   await expect(root().getByText(/아티스트를 찾을 수 없어요/)).toBeVisible();
   await shot('404');
   await page.goto(base+'/view/KPOP_ARTIST_DETAIL/hidden');
   await expect(root().getByText(/아티스트를 찾을 수 없어요/)).toBeVisible();
   failOnce=true;
   await page.goto(base+'/view/KPOP_EXPLORE?q=Test+Artist+3');
   await expect(root().getByRole('alert')).toBeVisible();
   await expect(root().getByText(/조건에 맞는 아티스트가 없어요/)).toHaveCount(0);
   await shot('500');
   await root().getByRole('button',{name:'다시 시도'}).focus();
   await page.keyboard.press('Enter');
   await expect(root().getByText('검증 아티스트 3',{exact:true})).toBeVisible();
   await expect(root().getByLabel('아티스트 이름')).toHaveValue('Test Artist 3');
   await shot('recovered');
   expect(forbidden).toEqual([]);expect(errors).toEqual([]);
   evidence.push({width,source:'local Next app + synthetic artist API fixtures; no real catalog data',layout,checks:['A01 page8/next2','A02 search/reset/page1','A03 numeric','A04 slug/back to page2','A05 missing404','A06 hidden fixture excluded','empty','500/retry','guest/no F8','keyboard Enter/focus'],forbidden,errors,reads});
   evidence[evidence.length-1].shellAuth=shellAuth;
   expect(reads.every(read=>read.method==='GET'&&!read.cookie)).toBe(true);
   fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
   await context.close();
  }
 } finally {await browser.close();}
 console.log(`PASS ${evidence.length} widths; evidence ${out}`);
})().catch(e=>{console.error(e);process.exitCode=1});
