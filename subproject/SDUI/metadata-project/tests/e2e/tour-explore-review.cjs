const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const phase = process.argv[2] || 'baseline';
const out = path.resolve('../../..', 'work-map-guide/tour-explore-ui-20261005', phase);
const pois = [
 {contentId:'review-1',title:'서울숲 카페',addr:'서울 성동구 서울숲길',mapX:127.043,mapY:37.545,recommendReason:'산책 후 쉬어 가는 장소'},
 {contentId:'review-2',title:'경복궁 식당',addr:'서울 종로구 사직로',mapX:126.977,mapY:37.579},
 {contentId:'review-3',title:'한강 전망 공간',addr:'서울 영등포구 여의동로',mapX:126.934,mapY:37.526},
 {contentId:'review-4',title:'주소만 있는 장소',addr:'서울 중구'},
];
(async () => {
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const records=[];
 for(const width of [360,390,768,960,1440]) {
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const u=new URL(route.request().url()); let data=[];
   if(u.pathname.endsWith('/auth/me')) return route.fulfill({status:401,json:{success:false}});
   if(u.pathname.endsWith('/tour/areas')) data=u.searchParams.has('areaCode')?[{code:'1',name:'강남구'},{code:'23',name:'종로구'}]:[{code:'1',name:'서울'},{code:'2',name:'인천'},{code:'6',name:'부산'}];
   if(/\/tour\/(restaurants|poi|holy)$/.test(u.pathname)) data=pois;
   return route.fulfill({json:{success:true,data}});
  });
  await page.goto(`${process.env.REVIEW_ORIGIN || 'http://localhost:3100'}/view/TOUR_EXPLORE`,{waitUntil:'networkidle',timeout:120000});
  await page.getByRole('button',{name:'서울숲 카페 상세 보기',exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:path.join(out,`${width}.png`),fullPage:true});
  records.push({width,source:`${process.env.REVIEW_ORIGIN || 'http://localhost:3100'} / fixture public API responses`,errors,layout:await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,timeCard:document.querySelector('.record-time-summary')?.getBoundingClientRect().toJSON(),timeCopy:document.querySelector('.record-time-summary-copy')?.getBoundingClientRect().toJSON()}))});
  if(phase!=='baseline') {
   await page.getByLabel('불러온 장소 검색').fill('카페');
   if(await page.getByRole('button',{name:'경복궁 식당 상세 보기',exact:true}).count()) throw Error('Search did not filter cards');
   await page.getByLabel('불러온 장소 검색').fill('');
   await page.getByRole('button',{name:'세부 필터',exact:true}).click();
   await page.getByRole('button',{name:'종로구',exact:true}).click();
   await page.getByRole('button',{name:'필터 초기화',exact:true}).first().click();
   records.at(-1).searchAndFilter='passed';
  }
  await page.close();
 }
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(records,null,2));
 await browser.close(); console.log(JSON.stringify(records,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
