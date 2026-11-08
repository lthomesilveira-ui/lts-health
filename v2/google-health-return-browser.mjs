import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {createGoogleHealthHandlers} from '../supabase/functions/_shared/google-health-connection.mjs';

// Invented callbacks only. No owner sign-in, provider request, private record
// or production write is used by this browser regression.
const app='https://lthomesilveira-ui.github.io/lts-health/v2/';
const html=await fs.readFile(new URL('google-health-return.html',import.meta.url),'utf8');
const config={enabled:true,url:'https://abcdefghijklmnopqrst.supabase.co',clientId:'123456-synthetic.apps.googleusercontent.com',clientSecret:'synthetic-test-only',encryptionKey:btoa('x'.repeat(32))};
let providerCalls=0,saves=0;
const handlers=createGoogleHealthHandlers({config:()=>config,authenticate:async()=>null,storeFactory:()=>({consume:async()=>null,save:async()=>{saves++;}}),fetcher:async()=>{providerCalls++;throw Error('Provider access prohibited');}});
await fs.mkdir('artifacts/google-health-return',{recursive:true});
const outcomes=[
  ['invalid_request','Não foi possível concluir a conexão'],
  ['expired','Esta autorização expirou'],
  ['not_authorized','A autorização não foi concluída'],
  ['account','Não foi possível confirmar a conta'],
  ['unavailable','Conexão indisponível no momento'],
  ['%3Csvg%20onload%3Dalert(1)%3E','Não foi possível concluir a conexão']
];
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    for(const width of [320,393,1440]){
      const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage(),errors=[],consoleErrors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
      await page.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        assert.equal(request.method(),'GET');
        assert.equal(url.origin,'https://lthomesilveira-ui.github.io','no provider or arbitrary network destination');
        if(url.pathname==='/lts-health/v2/google-health-return.html')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
        if(url.pathname==='/lts-health/v2/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><title>Synthetic return destination</title><h1>Destino do aplicativo</h1></html>'});
        if(url.pathname==='/synthetic-callback'){
          const result=await handlers.callback(new Request(config.url+'/functions/v1/health-google-callback'+url.search,{headers:{Accept:'text/html'}}));
          return route.fulfill({status:result.status,headers:Object.fromEntries(result.headers),body:await result.text()});
        }
        throw Error('Unexpected synthetic request '+url.pathname);
      });
      // Exercise the actual server failure response and the actual static page.
      await page.goto('https://lthomesilveira-ui.github.io/synthetic-callback?state='+'x'.repeat(43)+'&code=synthetic-private-canary');
      try{await page.getByRole('heading',{name:'Esta autorização expirou',exact:true}).waitFor({timeout:10000});}
      catch(error){
        const u=new URL(page.url());
        console.error(JSON.stringify({engine:engineName,width,origin:u.origin,path:u.pathname,result:u.searchParams.get('result'),headings:await page.getByRole('heading').allTextContents(),consoleErrors,pageErrors:errors}));
        await page.screenshot({path:`artifacts/google-health-return/${engineName}-${width}-failure.png`,fullPage:true});
        throw error;
      }
      assert.equal(await page.url(),app+'google-health-return.html','only the fixed recovery location remains');
      for(const [result,title] of outcomes){
        await page.goto(app+'google-health-return.html?result='+result+'&code=synthetic-private-canary');
        await page.getByRole('heading',{name:title,exact:true}).waitFor();
        assert.equal(await page.url(),app+'google-health-return.html','input parameters are not retained');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'recovery fits '+engineName+' '+width);
        assert.doesNotMatch(await page.locator('body').innerText(),/synthetic-private-canary|invalid_state|<svg|OAuth|PKCE/);
        const link=page.getByRole('link',{name:'Voltar ao Health',exact:true}),box=await link.boundingBox();
        assert.ok(box&&box.height>=44&&box.x>=0&&box.x+box.width<=width,'usable return action');
        assert.equal(await link.getAttribute('href'),'./#dados');
      }
      await page.goto(app+'google-health-return.html?result=expired');
      await page.getByRole('heading',{name:'Esta autorização expirou',exact:true}).waitFor();
      await page.keyboard.press('Tab');
      assert.equal(await page.getByRole('link',{name:'Voltar ao Health'}).evaluate(e=>e===document.activeElement),true,'return is keyboard reachable');
      await page.screenshot({path:`artifacts/google-health-return/${engineName}-${width}.png`,fullPage:true});
      await page.getByRole('link',{name:'Voltar ao Health',exact:true}).click();
      await page.getByRole('heading',{name:'Destino do aplicativo',exact:true}).waitFor();
      assert.equal(await page.url(),app+'#dados');
      assert.deepEqual(errors,[]);
      await context.close();
    }
  }finally{await browser.close();}
}
assert.equal(providerCalls,0);assert.equal(saves,0);
console.log('Google callback recovery: Chromium/WebKit at320/393/1440, real failure redirect, fixed copy, no sensitive query reflection, no provider calls/writes, layout and keyboard return passed.');
