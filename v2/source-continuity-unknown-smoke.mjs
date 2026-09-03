import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  await page.goto('http://127.0.0.1:4173/?fixture=1#hoje',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const m=await import('./src/integrated-analysis.js');
    const ready={body:'ready',segmental:'ready',workouts:'ready',exercises:'ready',sets:'ready'};
    const body=[{measured_at:'2026-08-01',source_family:'inbody',weight_kg:80},{measured_at:'2026-08-15',weight_kg:79},{measured_at:'2026-09-01',source_family:'inbody',weight_kg:78}];
    const trend=m.bodyTrendModel({body},ready,12);
    const change=m.bodyChangeModel({body:body.slice(1)},ready);
    const segmental=[{measured_at:'2026-08-15',lean_trunk_kg:30},{measured_at:'2026-09-01',source_family:'inbody',lean_trunk_kg:31}];
    const seg=m.segmentalContextModel({segmental,workouts:[],exercises:[],sets:[]},ready);
    return{trendPoints:trend.points.length,trendReason:trend.reason,changeAvailable:change.available,changeReason:change.reason,segAvailable:seg.available,segReason:seg.reason};
  });
  if(result.trendPoints!==1||result.trendReason!=='source_changed'||result.changeAvailable!==false||result.changeReason!=='source_changed'||result.segAvailable!==false||result.segReason!=='source_changed')throw new Error(JSON.stringify(result));
  await page.close();
}
await browser.close();
console.log('source continuity unknown smoke passed');
