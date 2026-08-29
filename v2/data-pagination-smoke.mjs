import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto('http://127.0.0.1:4173/?fixture=1',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');

const result=await page.evaluate(async()=>{
  const {fetchAll}=await import('./src/data-layer.js');
  const source=Array.from({length:2505},(_,i)=>({
    source_record_id:`row-${String(i).padStart(4,'0')}`,
    nutrition_date:i<1500?'2026-02-02':'2026-02-01',
    value:i
  }));
  const traces=[];
  const client={
    from(table){
      const ctx={table,from:0,to:999,orders:[]};
      const q={
        select(){return q;},
        range(from,to){ctx.from=from;ctx.to=to;return q;},
        order(column,options={}){ctx.orders.push({column,ascending:options.ascending!==false});return q;},
        then(resolve,reject){
          try{
            const sorted=[...source].sort((a,b)=>{
              for(const order of ctx.orders){
                const av=String(a[order.column]??''),bv=String(b[order.column]??'');
                if(av===bv)continue;
                const cmp=av.localeCompare(bv);
                return order.ascending?cmp:-cmp;
              }
              return 0;
            });
            traces.push({table:ctx.table,from:ctx.from,to:ctx.to,orders:ctx.orders.map(x=>({...x}))});
            resolve({data:sorted.slice(ctx.from,ctx.to+1),error:null});
          }catch(error){reject(error);}
        }
      };
      return q;
    }
  };
  const rows=await fetchAll('health_daily_nutrition','source_record_id,nutrition_date,value','nutrition_date',false,'source_record_id',client);
  return {count:rows.length,first:rows[0]?.source_record_id,last:rows.at(-1)?.source_record_id,traces};
});

if(result.count!==2505)throw new Error(`pagination truncated rows: ${result.count}`);
if(result.traces.length!==3)throw new Error(`expected 3 pages, got ${result.traces.length}`);
const expectedRanges=[[0,999],[1000,1999],[2000,2999]];
result.traces.forEach((trace,i)=>{
  const [from,to]=expectedRanges[i];
  if(trace.from!==from||trace.to!==to)throw new Error(`page ${i+1} range mismatch: ${trace.from}-${trace.to}`);
  if(trace.orders.length!==2)throw new Error(`page ${i+1} missing stable secondary order`);
  if(trace.orders[0].column!=='nutrition_date'||trace.orders[0].ascending!==false)throw new Error(`page ${i+1} primary order incorrect`);
  if(trace.orders[1].column!=='source_record_id'||trace.orders[1].ascending!==true)throw new Error(`page ${i+1} tie-break order incorrect`);
});
if(result.first!=='row-0000'||result.last!=='row-2504')throw new Error(`stable page order mismatch: ${result.first} -> ${result.last}`);

await browser.close();
console.log('LTS Health v2 data pagination smoke passed');
