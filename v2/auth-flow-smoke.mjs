import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:4173/?fixture=1#bio',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');

// Return to the fixture login screen through the real logout control.
await page.locator('#logoutBtn').click();
await page.waitForSelector('#login:not(.hidden)');
await page.locator('#email').fill('fixture@example.com');
await page.locator('#password').fill('fixture-password');

// Fire button + Enter synchronously. The first attempt must lock the second before its first await.
const locked=await page.evaluate(()=>{
  const button=document.querySelector('#loginBtn');
  const password=document.querySelector('#password');
  button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  password.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  return {disabled:button.disabled,busy:button.getAttribute('aria-busy'),message:document.querySelector('#loginMsg')?.textContent};
});
if(!locked.disabled||locked.busy!=='true'||locked.message!=='Entrando…')throw new Error(`login was not synchronously locked: ${JSON.stringify(locked)}`);

await page.waitForSelector('#app:not(.hidden)');
await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');
await page.waitForFunction(()=>document.querySelector('#loginBtn')?.disabled===false&&!document.querySelector('#loginBtn')?.hasAttribute('aria-busy'));
if(errors.length)throw new Error(`browser errors: ${errors.join(' | ')}`);

await browser.close();
console.log('LTS Health v2 auth flow smoke passed');
