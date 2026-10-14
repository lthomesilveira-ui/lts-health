import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
// Generic build hashes live in the test. No public JSON payload is introduced.
const manifest={
  "candidate_commit": "e960481eb41562dc6abe6d07e6584623dd7c3099",
  "build": "compact-evidence-20261014.59",
  "files": {
    "accessibility.css": "fe77a056f36b55fa987367ac0899da57b613e2db4830c33781b8612f209bd3db",
    "analysis.css": "eab9c40cf89e4250d43f3211a1415ce0d05dc4d5c61896563f345f5e61263c1c",
    "bio.css": "9ec3191e86f2e53cbc29486c01303a480e021b0d9d6a9efba0078938a4732562",
    "cockpit.css": "75d94843fa9861bafc82bb8870c305fddbf140b5c2ba31b3308f186ea88a51bd",
    "composition-model-v2.css": "97da2b169549cb6a683514976e1dad004f71d9e889249837a8caa8493803a75d",
    "dashboard-final-polish.css": "e827badad263a43f1283c7d120e732872d85342f206bb37afa926842353cfa67",
    "dashboard-parity.css": "c370a25ea7e501fc4bff32e5d9463cbcbb489f7cb6e026fbccf260485ea20826",
    "dashboard-pixel-parity.css": "391ee883ea04982dd5f8c133fd3621a64972f3e1b8bee093a4e3cf8772cfe639",
    "dashboard-reference-contract.css": "f6af7d09fa862026cf9fb2da3ea39e8abe9999e786d5199d5544b2f075ac7d93",
    "data.css": "68c9d046e7ab488eec2fe2107fe49e8aca73d71ba76e6448096c3fd5bcc935aa",
    "details.css": "9dc9aba99add9f399f395bf9312c0db6b690a21739cba44e38036d24f1df8eb0",
    "domain-reference-parity-20260914.css": "af7f0c34b9d9055a8b13ea731aed32253c75f39ec1232a72b914fbe76381c912",
    "entry.css": "4448b31b193f468eb741f1e1ea646b293936abb615093b6232d1a224071152d4",
    "evidence-priority.css": "a2de4cffa12b132bc6d610672f602b6db2f83950c88a04e0b51de27f2f3c36ba",
    "evolution-product.css": "31634ddf817f1e0ee99eafef3e7b7984cafc01f54ff035ce05a86780c408dda7",
    "evolution.css": "1ec73c327865ecbe99acc8ccc9fd1816dc288ccc9f492085feb72561d7d6f63e",
    "executive-shell.css": "76e903ad654a2592443f6270dc22facc190f047d46a782ac8c2dac77e844d0b7",
    "health-auto-export.css": "de23cf04121625dfa1ce4dd60039708903e0cc8348e27e11099e51441433cb6a",
    "health.css": "cb1f904927c5e7f44927d83145abe0076bc618547f27460e8854336a5dfa5004",
    "history-depth.css": "c8ced015cc32ed0487678cb7998b4984981971c97d168749a65fc58fecf692db",
    "home-overview.css": "b0df7017b66de8a418fac54a6d4851bc223b0594d63f5998d195c478dc2a1ffc",
    "home-reference-experience.css": "94c100a731c1a163bbcbdbf3b6b9c9da9b945c09be5087d322b86034af87ab19",
    "home-reference.css": "33a736c10df124c86f1ff8be54d41be05d0443235b8a688b6923307eb8ff2377",
    "index.html": "6fae15e817e14e9a8daf88fd9396a56c9222b84499809f89bcad771f2bc1bfe4",
    "integrated-review.css": "a83434613ae31b91bfb5fda9f529cbf95d71b66f732b5f490d59599eedc57ec3",
    "labs-model-v2.css": "bbbf9acfa364c27edd8b09c8feb64dd64ec80a25b0b38e6b26102cc0ed3943f1",
    "longitudinal-story.css": "ecb43a3a94892a99f2d06ebfce6303072ef3208f3298d27693bffa3a69945b44",
    "mfp-water-extractor.css": "a28f5aa6885b9605efd7294d485f8f2eec14b4bfee29901316acc753e933b590",
    "model-convergence-shell.css": "01d76de76760cc0113db2e80b574a4a24039344b1e7d54029adfdab3fe52fb71",
    "nutrition.css": "9b3021736552698e90b9e1c80951b3fde8d52261edf769ed2363aed141423c76",
    "physical-iphone-remediation-20260915.css": "e2a023fa6648ebfa690c378eee42b41c711e10f7cb0d5443861d688d5ce4620b",
    "preview-readonly.css": "24d498bcceb8c801f5e82e72418033a51418b2bf1f129061b69dee2c007da341",
    "product-delivery.css": "c56c6bd062c474ee2ae60aa5cf696416d7eb6f5dea44213ff344de4b3e29ed5f",
    "product-experience.css": "5f3a0b0bdf6a3ae4661679abecdcffeba19f2c0cd46f8354a736d6f46a032d93",
    "product-finish.css": "0c4c95bf4c12f1e25a44433862393a7c54267ee8591ee5d4f8525eecaa7ac2f3",
    "product-layout-v2.css": "9d9dc8724c6e3b4a459174eaeef6784a08609272aa7406aec0332fd3492d4997",
    "product-redesign-v1.css": "0467e4407f7b1e86c470ad7f4714616709febaa95b356957d527de76f70f7a20",
    "public-audit-remediation.css": "86adc0ef1372e08c0dd07d42f68009b70f4da1bfc354e35dae0f5776e2421c62",
    "reference-parity-20260914.css": "80a5ca60b66b069a311f49826de103259ffe852b40e18f244b8e3f2946eed781",
    "reports.css": "b84d3cb7f5e47d108fd50b0b90462ecda9ea362878ff11f43dfff5a0fd392688",
    "secondary.css": "c1d5252112baa6a353640f2474ffcc7e7f8ffeb9d3e492a28e0c45db6fdfd231",
    "shell-route-actions.css": "96bc060143db2e88aae18f8ebaca290de2e049819d11c4bb81224bbb9e702717",
    "shell.css": "dff8bbe1d931c717806362a8b54705b41b61753f5e23b5def86d1e5e5a068582",
    "sidebar-mountain-reference.svg": "2d8df4525f6d87b06e8d61ceb158035f6842bd080b02b68c36f246b67fa4ba3d",
    "src/analysis-screen.js": "cfba98a4af94a8b2a8f7fe1c7d29e1bdc7bf51594158e221c4604112120ba041",
    "src/backup-traceability.js": "0af8635ca3742a1c4c64e28aae92ae56965449fcd1751212e2f61428da429cc9",
    "src/bio-screen.js": "e9dab2b169bfb559db08d6248d741d1dac51a964caaf4f08e5e4e321c9704eed",
    "src/care-followup.js": "be61c324f78294f759c901932c832ebb6e0ceb39ab5aef17adcea7c2fc8b3dcd",
    "src/composition-layout-v2.js": "88d23b8bb44c6d7bd42c57dd93b7ad4adf52eeb21231da1eb7714187e81d9b37",
    "src/core.js": "4a25b9092a380de5e8a7d359e1759d4c954d0f714026698168875e7431d8a83e",
    "src/dashboard-reference-runtime.js": "184d98212c45dafbfb6a9ff73d8c5f37b20ca1ae79eb8bad284c661e5349b0e0",
    "src/data-layer.js": "e37d773309f215e23f90a65c749b424e3419167e177e74e96f625667525430ab",
    "src/data-screen.js": "95451df04f99f8a1f0c9cc7f8062d2da3dd19d04bac62df28e7a407d3ec2693f",
    "src/entry.js": "47bda0c131be40b18555c0f4b02285199094541a3ff47a9a22e1ffb28ddac925",
    "src/evidence-insights-view.js": "dd958e5449666b24de752ebedb4d8093a03707688bbcc0e68d0271ab5493fe02",
    "src/evidence-insights.js": "958fc63fab789353391d49bbde83928c03ef37f13c93b5028188875e41376989",
    "src/evidence-priority.js": "29094dbe0b34c3df50b74dae3e458d37ac53e72a94ceec237ea251a85c5dfdfd",
    "src/evolution-model.js": "5bfe14064fbc7b53cce464172f9444fbd6df7cd8193b6b9cbe9f04e77175cfa8",
    "src/evolution-screen.js": "a9bd34f8ca95bc0305654ba8eba43623fcfb3cb2664cb7e38787a1219af4baba",
    "src/executive-cockpit.js": "d16048560dc7506980afa191b001fcdd3ffc3cbcc8198e12fd952439ca72c0db",
    "src/health-auto-export-connection.js": "da807104a4d207af93a10e526a21c7294912f6d4579b0d94955bfee52b8b77b5",
    "src/health-auto-export-data.js": "241dd41d8a5372f25dbd7c395028c51ebb43b25490f135a22b5fcffde5b415f2",
    "src/health-context.js": "e10ce4cd0590d096828ad3a20978381f312da6a451853dc3870aa96a03338b10",
    "src/health-screen.js": "0fa9211bcd57d80e4a000c92c646389e37ffb45f98872f677433c106b2309895",
    "src/history-tools.js": "a5308e26426b8681b55515a6434f67dc94a7c532b5225e904e619d7a442d9e88",
    "src/home-cockpit.js": "e60175cf5de5d09efde96e81f583fdaa38600b706ef3ad6d7bce31a48adb0ef7",
    "src/home-evidence-insights.js": "16f1b40f892f41f038b4e852d604f1082f3b18679bcdad23016b7918ad496870",
    "src/home-overview.js": "2d08723ecce7f700f3dc3263706b75c20c85d08812ed9d3233138ae0ffdd5aa5",
    "src/home-period-model.js": "093cd388410269a93348e0465dbf71c0b1c597b308834b443e9084274284dd3c",
    "src/home-reference-experience.js": "4eb48444a9ecb4e047bb50b11e624fe19b5f6cf1faed2f6487db4add75af0bcf",
    "src/home-reference.js": "f23182afbbdc87dd2861a3171951cae2fa5febe8f1affd2aa2df9ae987f78267",
    "src/hydration.js": "ac08d5f9c599e7937da7f6c73019d3faaf73b08c87039760d2c89cd2aeeb24ff",
    "src/integrated-analysis.js": "3a32d46636af4853d20cf02a6692d1751c3351d9446cbf6cec7d405afc677ea4",
    "src/integrated-review-view.js": "eb865eff15debcbc332f69985af99e188bfbc08b2a472176e62470c25fc8da78",
    "src/integrated-review.js": "f62990ed7f5b8c4694db283dc7c4c1fc150b8c87c24828f1cd9cda4920203d21",
    "src/intelligence-engine.js": "83d2b9177b7642d8c2eccfe2d68d4df2269e426887de65998c49bba26027246a",
    "src/labs-layout-v2.js": "a7495755ae0d0d08f7b56dc46bafe196e7c84de6d33369fd3180ebcaba762ae1",
    "src/longitudinal-model.js": "c06b9b2502b1ac95158076f65c2f352348bd787bc27842a8d9cb4bbc2f53fe84",
    "src/longitudinal-story.js": "d2b764d06c1073f0ae57e49290c8e39609ea2095ce6533cc9e8f99ade0c35c12",
    "src/main.js": "1260d4c67aefc06c733c7062ccda2e5e64e42b1965c559832c413945e5e11a39",
    "src/mfp-water-extractor.js": "4f7be9329688ec004c2b4514829a7ec0c5474bd098fd77cf99d30d5e5822a81f",
    "src/mfp-water-transfer.js": "93b5f1d900fdec823bd2e0b1f60538833c56f1ba7053e18fbf9a1e3ac65ec15e",
    "src/nutrition-product.js": "bd5b8ccb46cf0a285222a8d53176ebafdeeb7171ddbc297d3aaec8e1341d5006",
    "src/nutrition-screen.js": "25efdbf671db9358d6fbec292ae1fd6580869baf8731b4c0b3be634019434aba",
    "src/personal-goals.js": "2f8a8844cf323e60d53fad742cc443dbd8f3ff985b6d1cd0b3c3021646a5625b",
    "src/polar-connection.js": "295a0a3323e73a5ef51295f99aa2ce6b535386250ac16442ff0ae098741ab49c",
    "src/preview-readonly.js": "ca267422b70a50f4bbddb3edfad7f5ed6d7d1bef8edad324e546f043a944a994",
    "src/product-layout-runtime.js": "88166bace919239650d043f4efb9a1ea96b9262c5f1b4c4361210c320f268fc9",
    "src/product-layout-v2.js": "39ced48a76c7a6b01556c7c5c54d73de279bdc06d5f08dabce692d00dd0b1f05",
    "src/product-shell.js": "b28304fe107abd7f33936f35a564cf4c595fb894b6794069bf82c39effdce114",
    "src/recovery-layout-v2.js": "da6021640c05bc1bf09628901b448126a8d89e1aedf21266b1ec5c7d1a52e390",
    "src/reports-model.js": "ef5c7d6000387cfe5bbe4a1b634319a182e53be3cc57f6ba13a1f1a2f9844e56",
    "src/reports-screen.js": "9f89fc19afecb3586fc84faff5d64e8c1ecd800b8c6500152e3bce98209748ef",
    "src/shell-accessibility.js": "fd6f3c38276ee014523ca2e72a234157daa43c62e6da6f7d202c041228ff77b5",
    "src/source-status.js": "f51f73a6d73d5880b0615b89101693ff2333a7d2021311d96bd80cf4a57b179f",
    "src/timeline-screen.js": "83b00def84ef265c53e9508fd5dbf2cd748da803a196e0e432b6eca42cbd0273",
    "src/today-screen.js": "0686db7acb46bd8147e9c5bf8aa6e30d2bd5f670fdfa0e1a1c5eab397bf4313c",
    "src/training-history.js": "f9cc44296a4ffb1dd9c23fc8fb53d25add0879ac729c132bea29da91b937ca08",
    "src/training-reference-runtime.js": "4c4beddd0c7d62983c603632f0b178a1fdcba823e2f9bdf63a490ca7f9907b23",
    "src/training-reference-v2.js": "bebfd8984914efe17dcb97c2e45f091e84e06a18dd23b9b183a118dde52662f9",
    "src/training-screen.js": "255481f1cfc2439d091bc7e0b138259206f1920804b8fcf795c53d90a229c759",
    "src/training-session.js": "82bd2d255b7c9c5ef6aa44f6eca4427d963fb324bf74ad4fe33b984d7e217538",
    "src/treatment-screen.js": "234ed6866db660b34c4ae0856da8a4744fd1cab16a0804e688b72f981dc6ba70",
    "src/workout-evidence.js": "8c9c6a4c7e965a0bd24e1f23285354f37815660068e31c9a8e90878a08b1ad91",
    "src/writes.js": "2056c98acaaf7b40e29e6d86e146965c0d2227b65098e99ee2b82f1310ecf60d",
    "styles.css": "90ca5a32254ba77ebb7394dffc85254f1790b7a70d6071c5772cf5b60336a274",
    "today.css": "c52c17b8471960e744307201f228dd3fcc6e3ed58819489add627a349f1fd21d",
    "training-reference-v2.css": "46d7cd095f706ac667dcc5c65947b092f9e07439927a0d87479b926d42831571",
    "training-reference.css": "4336e64042148a3ea94353dc3f98d3e5010930f14635d90158c480a440c6df10",
    "training.css": "123b48543b6e97893371bba86c15784644fad7096da4e4a2a1d38a99d72970ce",
    "ux-coherence.css": "5f51f49e3d9312c54523257544daa86769ee093f31a35c349aefb73b0abbe6f7",
    "visual-convergence-20260914.css": "84580ab11e8775919f130a587625631ed1ef0ea212dceeb9cc49e336e5a4abd7",
    "water.css": "4b1245f9c6637f712d59847ac8e7da326f1451ba7bcda3f424a8aad3251038dd"
  }
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.build,'compact-evidence-20261014.59');
for(const [relative,expected] of Object.entries(manifest.files)){
 assert.ok(/^(index\.html|[\w-]+\.(?:css|svg)|src\/[\w-]+\.js)$/.test(relative),'allowlisted generic source only');
 const file=path.join(root,relative),body=fs.readFileSync(file,'utf8');assert.equal(hash(body),expected,'preview manifest matches '+relative);
 let links=relative.endsWith('.html')?[...body.matchAll(/(?:src|href)="(\.[^"]+)"/g)].map(m=>m[1]):relative.endsWith('.js')?[...body.matchAll(/\b(?:from|import)\s*(?:\(\s*)?['"](\.[^'"]+)['"]/g),...body.matchAll(/new URL\(['"](\.[^'"]+)['"]/g)].map(m=>m[1]):[];
 if(relative.endsWith('.css'))links.push(...[...body.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g)].map(m=>m[1]??m[2]??m[3]),...[...body.matchAll(/@import\s+(?:"([^"]+)"|'([^']+)')/g)].map(m=>m[1]??m[2]));
 for(const link of links){
   const clean=link.trim();if(/^(?:data:|https?:|#)/.test(clean))continue;
   const target=path.resolve(path.dirname(file),clean.split(/[?#]/)[0]);assert.ok(target.startsWith(root),'relative dependency cannot escape preview');assert.ok(fs.existsSync(target),'relative dependency exists: '+relative+' → '+link);
   assert.ok(Object.hasOwn(manifest.files,path.relative(root,target)),'runtime dependency is covered by hashes');
 }
}
const runtimeFiles=fs.readdirSync(root).filter(name=>/\.(css|svg|html)$/.test(name)).concat(fs.readdirSync(path.join(root,'src')).map(name=>'src/'+name));
assert.deepEqual(runtimeFiles.sort(),Object.keys(manifest.files).sort(),'every runtime asset is hashed; no unlisted payload');
const production=path.resolve(root,'../../v2'),core=fs.readFileSync(path.join(root,'src/core.js'),'utf8'),productionCore=fs.readFileSync(path.join(production,'src/core.js'),'utf8');
assert.equal(core,productionCore,'authentication/configuration is unchanged from production');
assert.match(fs.readFileSync(path.join(production,'index.html'),'utf8'),/mobile-parity-20261014\.58/,'production remains on its published build');
assert.match(fs.readFileSync(path.join(root,'src/main.js'),'utf8'),/if\(!session\)\{showLogin\(\);\}/,'missing auth stays behind login');
assert.doesNotMatch(core,/service_role|sb_secret_/);
const index=fs.readFileSync(path.join(root,'index.html'),'utf8'),guardTag='<script src="./src/preview-readonly.js?v=compact-evidence-20261014.59"></script>';
assert.ok(index.includes(guardTag)&&index.indexOf(guardTag)<index.indexOf('<script type="module"'),'blocking classic guard loads before application modules');
assert.ok(index.indexOf(guardTag)>index.indexOf('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'),'guard installs after SDK');
assert.match(index,/Prévia · somente leitura/);
assert.equal(fs.existsSync(path.join(root,'manifest.json')),false,'no public manifest JSON');
await import('./preview-readonly-test.mjs');
await import('./preview-presentation-test.mjs');
console.log('Isolated preview: exact runtime hashes, closed JS/CSS dependencies, read-only guard before modules, unchanged authentication/configuration and production build.');
