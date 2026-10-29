// Deterministic public installation assets. No patient content or credentials.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'tools/health-home-screen'),target=path.join(root,'v2');
export function prepareHealthHomeScreen(html,build){
  for(const file of ['app-install.js','home-screen.css','sw.js'])fs.copyFileSync(path.join(source,file),path.join(target,file));
  fs.copyFileSync(path.join(source,'legacy-sw.js'),path.join(root,'sw.js'));
  fs.mkdirSync(path.join(target,'app-icons'),{recursive:true});
  for(const file of fs.readdirSync(path.join(source,'icons')))fs.copyFileSync(path.join(source,'icons',file),path.join(target,'app-icons',file));
  const manifest=prefix=>({id:prefix,name:'LTS Health',short_name:'LTS Health',description:'Seu histórico de saúde, em contexto.',start_url:prefix+'#hoje',scope:prefix,display:'standalone',background_color:'#f4f8fe',theme_color:'#07131f',lang:'pt-BR',icons:[{src:prefix+'app-icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:prefix+'app-icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:prefix+'app-icons/icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]});
  fs.writeFileSync(path.join(target,'manifest.webmanifest'),JSON.stringify(manifest('./'),null,2)+'\n');
  fs.writeFileSync(path.join(root,'manifest.webmanifest'),JSON.stringify(manifest('./v2/'),null,2)+'\n');
  const head=`  <link rel="manifest" href="./manifest.webmanifest">\n  <link rel="apple-touch-icon" sizes="180x180" href="./app-icons/icon-180.png">\n  <link rel="icon" type="image/png" sizes="192x192" href="./app-icons/icon-192.png">\n  <meta name="apple-mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-title" content="LTS Health">\n  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n  <link rel="stylesheet" href="./home-screen.css?v=${build}">\n`;
  const button='<button type="button" class="healthInstallOpen" data-health-install>Health na Tela de Início ↗</button>';
  html=html.replace('</head>',head+'</head>').replace('<div id="loginMsg"',button+'\n        <div id="loginMsg"');
  const moreEnd='</div>\n    </div>\n  </div>\n  <div id="entryModal"';
  if(!html.includes(moreEnd))throw Error('Reviewed More sheet insertion boundary changed');
  html=html.replace(moreEnd,`</div>${button}\n    </div>\n  </div>\n  <div id="entryModal"`);
  const panel=`<dialog id="healthInstallGuide" class="healthInstallGuide" aria-labelledby="healthInstallTitle"><header><img src="./app-icons/icon-180.png" width="56" height="56" alt=""><h2 id="healthInstallTitle">Health no seu iPhone</h2></header><p>Abra seu cockpit direto pela Tela de Início.</p><ol><li>Abra este Health no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> e em <b>Adicionar à Tela de Início</b>.</li><li>Mantenha <b>Abrir como App da Web</b> ativado e toque em <b>Adicionar</b>.</li></ol><small>Na primeira abertura pelo ícone, o Health pode pedir seu login. As próximas versões chegam pelo mesmo ícone.</small><button type="button" data-health-install-close>Entendi</button></dialog><aside id="healthAppUpdate" class="healthAppUpdate" role="status" aria-live="polite" hidden><p>Há uma atualização do Health disponível.</p><div><button type="button" data-health-update>Atualizar</button><button type="button" data-health-update-later>Depois</button></div></aside><script type="module" src="./app-install.js?v=${build}"></script>`;
  return html.replace('</body>',panel+'\n</body>');
}
