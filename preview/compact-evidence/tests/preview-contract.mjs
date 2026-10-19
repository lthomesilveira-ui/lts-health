import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
// Generic build hashes live in the test. No public JSON payload is introduced.
const manifest={
  "candidate_commit": "79e23905b9c4a106a979942020dac3cd1f1a0976",
  "build": "health-dashboard-20261019.72",
  "files": {
    "accessibility.css": "9ee0d8b2fd8bc00d1c039e9dcf8598f695a273cea119614e14181cb4f1879389",
    "analysis.css": "eab9c40cf89e4250d43f3211a1415ce0d05dc4d5c61896563f345f5e61263c1c",
    "bio.css": "9ec3191e86f2e53cbc29486c01303a480e021b0d9d6a9efba0078938a4732562",
    "body-interval.css": "ea7509f603febe4147f6411737b7e015b336cdaea3ddc13f15b9e17abd16061e",
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
    "evolution-product.css": "342f71b109b1ae835b979c6080111446e5a61183d522ea1cfba45e3e9b4b27b4",
    "evolution.css": "1ec73c327865ecbe99acc8ccc9fd1816dc288ccc9f492085feb72561d7d6f63e",
    "executive-shell.css": "76e903ad654a2592443f6270dc22facc190f047d46a782ac8c2dac77e844d0b7",
    "health-auto-export.css": "de23cf04121625dfa1ce4dd60039708903e0cc8348e27e11099e51441433cb6a",
    "health-dashboard.css": "a7b8010a601bf179117fbbbd267883edaef677f377656768e81c1962c1f503fd",
    "health.css": "cb1f904927c5e7f44927d83145abe0076bc618547f27460e8854336a5dfa5004",
    "history-depth.css": "a1a32d6a4c79a65d89223a7c1a3bcdd657d0af586b5a3d2fb400942f93e21cb0",
    "home-overview.css": "b0df7017b66de8a418fac54a6d4851bc223b0594d63f5998d195c478dc2a1ffc",
    "home-reference-experience.css": "94c100a731c1a163bbcbdbf3b6b9c9da9b945c09be5087d322b86034af87ab19",
    "home-reference.css": "33a736c10df124c86f1ff8be54d41be05d0443235b8a688b6923307eb8ff2377",
    "index.html": "8105f79beee4eab0bf6d00ab54556ff443b6e38c58f9d3ecf057cec43db76f76",
    "integrated-review.css": "a83434613ae31b91bfb5fda9f529cbf95d71b66f732b5f490d59599eedc57ec3",
    "labs-model-v2.css": "bbbf9acfa364c27edd8b09c8feb64dd64ec80a25b0b38e6b26102cc0ed3943f1",
    "longitudinal-story.css": "ecb43a3a94892a99f2d06ebfce6303072ef3208f3298d27693bffa3a69945b44",
    "mfp-water-extractor.css": "a28f5aa6885b9605efd7294d485f8f2eec14b4bfee29901316acc753e933b590",
    "mobile-study.css": "a834a6977c280b3142b9ac8c2f35784b63a4b4aa3a8d50fdab7cc38fd6ff041b",
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
    "src/body-interval-model.js": "339fbc37a19b23af45e9987b5deaf9ddedf769df7fcd9bc95bd3218490fec923",
    "src/body-interval-view.js": "59b21ecf7f6bab1da1ee5f0e6362e7cd5c1a3390b27c46953ac4062c2af7c7c8",
    "src/care-followup.js": "be61c324f78294f759c901932c832ebb6e0ceb39ab5aef17adcea7c2fc8b3dcd",
    "src/composition-layout-v2.js": "cc924b0e94c64b2938d6bc4b9a6e1f5df93955bcaa2414034a2fe3be1127b12c",
    "src/core.js": "4a25b9092a380de5e8a7d359e1759d4c954d0f714026698168875e7431d8a83e",
    "src/dashboard-reference-runtime.js": "184d98212c45dafbfb6a9ff73d8c5f37b20ca1ae79eb8bad284c661e5349b0e0",
    "src/data-layer.js": "85434da5419c3276f354e34abfbbdc03d586a9125b83e5a795e74fac6a920717",
    "src/data-screen.js": "e6702fa0101b5a5e16b437dbf3ba8384c1558a2bb78813c77f0ae6ff624810de",
    "src/documented-nutrition-plan.js": "a7a4fa51a6d982cc9edad5f566466a35d2ace003da291c4337cbcca7c8411d46",
    "src/documented-water-reference.js": "a5e46672d5050cba9746fadbb9821ba8978a78fc69cf9b8822652603866fe213",
    "src/entry.js": "47bda0c131be40b18555c0f4b02285199094541a3ff47a9a22e1ffb28ddac925",
    "src/evidence-insights-view.js": "b2dababf8c8ae008af62c3f49362e9e2f62173653eb566dec5504c28a58a6141",
    "src/evidence-insights.js": "46fd88e8c3d7be0ab6de361201581d5a6cab1c4ee785ebf3f53f2bac9387f1a3",
    "src/evidence-priority.js": "a35801fda348552067a5e334643b364ad75304db92c72494325f2c83b275a47a",
    "src/evolution-model.js": "c95f4f64ff555f51c04cc10e233da9b83cc5e0e9871567791e5f444353486f49",
    "src/evolution-screen.js": "4b0e1328954de031c8c8a7ade77bb839c3b11f4cf2b9b0564c53b7005d74d57e",
    "src/executive-cockpit.js": "d16048560dc7506980afa191b001fcdd3ffc3cbcc8198e12fd952439ca72c0db",
    "src/health-auto-export-connection.js": "2cac80a8e2936e40aa6f39c806d635d965b6c30fe5e451c097c375f6bd7f1dae",
    "src/health-auto-export-data.js": "241dd41d8a5372f25dbd7c395028c51ebb43b25490f135a22b5fcffde5b415f2",
    "src/health-context.js": "26af9d2436d1145f0e4b155eb1ea26c7138adf6a68db12e26d7dd7fe4c359bf7",
    "src/health-dashboard-body.js": "29c26568e4f0cca387df73a40b1cc157d22bd46e73476e5eb156a70416134f42",
    "src/health-dashboard-context.js": "af6986230dab59649a4fe68e226e5a7e4f543c2e1c155ee2d6efb25368cdb12c",
    "src/health-dashboard-guidance.js": "40383b198066d52e5e4f8d3b725747b49ae1024815dfd219dd2baaf5244a191a",
    "src/health-dashboard-labs.js": "45262b82d63fffb723c06e44a80c7cf6daffc96fd20f3f132c8e600f8410e3ee",
    "src/health-dashboard-model.js": "3fa97ff1f28dff85b96cdf888622622bd1057372d44d025ca4503393f57dc7f8",
    "src/health-dashboard-training.js": "309e7137ba62c5e44797a31fa70968cf6fb30484bce436254e840c0178d8925d",
    "src/health-dashboard.js": "97ab1d4549d1dc16195537629af575da5d386167dda6ef1f31d3a89bacdba800",
    "src/health-lab-reviewed-numeric.js": "71070a17d4925105c654cf4ca2530e248ae60bd399bc5f33a88f2df95cbcb7cc",
    "src/health-screen.js": "0fa9211bcd57d80e4a000c92c646389e37ffb45f98872f677433c106b2309895",
    "src/history-tools.js": "1f89aa73bf582b91a36a163a770a8dc9f6be4ca1c52935986e2e989b328251f3",
    "src/home-cockpit.js": "9388bdddf4aed2528a3536629e94ff8a98f130785eccfdb18017652c38b84c6f",
    "src/home-evidence-insights.js": "c1a3fe6a08e6271d7aec24940428215cfdfa2473a2006eecbb4d23c49cef95e7",
    "src/home-lab-history.js": "c2382d0762ef86dc15a2ed2887c4ea94d08341b0b94e2bc94d179ad627d9e91c",
    "src/home-overview.js": "2d08723ecce7f700f3dc3263706b75c20c85d08812ed9d3233138ae0ffdd5aa5",
    "src/home-period-model.js": "99188efaa8f112be422584390a062ac442ea482e2522692febc4a1dba827f900",
    "src/home-reference-experience.js": "8dc96430d36d70fc5a80e8c33d8baca658fb1db163e0eed3a97070a773458427",
    "src/home-reference.js": "f23182afbbdc87dd2861a3171951cae2fa5febe8f1affd2aa2df9ae987f78267",
    "src/home-useful-content.js": "2be13d47f2b8beab91347fc47588a50f4df6fdc4c19f8615dae861b9d440062e",
    "src/hydration.js": "ac08d5f9c599e7937da7f6c73019d3faaf73b08c87039760d2c89cd2aeeb24ff",
    "src/integrated-analysis.js": "3a32d46636af4853d20cf02a6692d1751c3351d9446cbf6cec7d405afc677ea4",
    "src/integrated-review-view.js": "c2d7a62cd2e0178942176685c2143c55c69f6623f71836f593aa6c63cadec485",
    "src/integrated-review.js": "0a2b5f6414b706e06fa385bed405b9108ddca7c41140207a8b3908fef508b631",
    "src/intelligence-engine.js": "83d2b9177b7642d8c2eccfe2d68d4df2269e426887de65998c49bba26027246a",
    "src/labs-layout-v2.js": "6092306cde0fc2aa00ae5fa4c75544be5adcf2eebba57ece43afb2334afa2a74",
    "src/longitudinal-model.js": "c06b9b2502b1ac95158076f65c2f352348bd787bc27842a8d9cb4bbc2f53fe84",
    "src/longitudinal-story.js": "d2b764d06c1073f0ae57e49290c8e39609ea2095ce6533cc9e8f99ade0c35c12",
    "src/main.js": "232d1db871fafe174f3057374e23103dfc41a2d791af4b9f6d61bad2740ce1d1",
    "src/mfp-water-extractor.js": "4f7be9329688ec004c2b4514829a7ec0c5474bd098fd77cf99d30d5e5822a81f",
    "src/mfp-water-transfer.js": "93b5f1d900fdec823bd2e0b1f60538833c56f1ba7053e18fbf9a1e3ac65ec15e",
    "src/mobile-study.js": "41309f835798cc9c8c88bd4bd56933fc5ca47b94bc52eaac29de2df716b2e082",
    "src/nutrition-archive.js": "3e9cb8ca446b34bb206543f010b54c1164b8bdff1d929f073f2dfa342499c34a",
    "src/nutrition-plan-comparison.js": "ec7ae5bbe82c4425001b7ae34e8b64a290d7b0311d87e04e4dee0ac22505efd8",
    "src/nutrition-plan-view.js": "d62ee0f80fe7d05f7d903b4c3ac3c7a01d7f3d25f4553e38cdea07a1d5b3435b",
    "src/nutrition-product.js": "b88dcb191dcb8ac5fe3d8bf56eb7159f2b0672096a6b172faddebd853109f80c",
    "src/nutrition-screen.js": "25efdbf671db9358d6fbec292ae1fd6580869baf8731b4c0b3be634019434aba",
    "src/nutrition-source-review.js": "724561e77c78d4f885216b257cf151e323d92d4d562551f6d799231eaf38eaf6",
    "src/personal-goals.js": "8451a8c46108fb01124e1774958f4319498a46b8dc991279bd49f381c03b6d3f",
    "src/polar-connection.js": "18ce96581a1449b1f665d694f016c3e2ad8580b1e12cf47f03aa1ea064e9eca4",
    "src/preview-readonly.js": "ca267422b70a50f4bbddb3edfad7f5ed6d7d1bef8edad324e546f043a944a994",
    "src/product-layout-runtime.js": "88166bace919239650d043f4efb9a1ea96b9262c5f1b4c4361210c320f268fc9",
    "src/product-layout-v2.js": "39ced48a76c7a6b01556c7c5c54d73de279bdc06d5f08dabce692d00dd0b1f05",
    "src/product-shell.js": "b28304fe107abd7f33936f35a564cf4c595fb894b6794069bf82c39effdce114",
    "src/recovery-layout-v2.js": "4e49271bb7d60a68952c2b122bf34662ed52052dbf3e034c3cff11b62234d720",
    "src/reports-model.js": "e79d30443cff18c5ddfd53ca1481f8133ab8783c951ec8cdeefe89a900cf17ae",
    "src/reports-screen.js": "5601d46a0a55b201ec87c43089e725b5e3a50db72fbd35a285763e2b0bafdd26",
    "src/shell-accessibility.js": "fd6f3c38276ee014523ca2e72a234157daa43c62e6da6f7d202c041228ff77b5",
    "src/source-display.js": "9e1e68fa7382145291a3fc339ba7c2b118038e3ec68e0943f6f985ad52e87d00",
    "src/source-status.js": "f51f73a6d73d5880b0615b89101693ff2333a7d2021311d96bd80cf4a57b179f",
    "src/study-findings.js": "112a5925feb0fcb9267e6c1d5483f9b1ee1befcfc7444336cbe1b603ab550e80",
    "src/timeline-screen.js": "2ac900d93dca94ac5a1782e1d81b56542962148601ab894e44ec149ffee94612",
    "src/today-screen.js": "0686db7acb46bd8147e9c5bf8aa6e30d2bd5f670fdfa0e1a1c5eab397bf4313c",
    "src/training-comparability.js": "29cbde79fed598028c4fffcf6789d8793909b7df64c9f7bec31c2a3a8919cc99",
    "src/training-history.js": "c60a23eb9633cc08419c8f21b4ac5ac0c8b3b6b781a8aa90e3bebe755604ec5d",
    "src/training-reference-runtime.js": "4c4beddd0c7d62983c603632f0b178a1fdcba823e2f9bdf63a490ca7f9907b23",
    "src/training-reference-v2.js": "a04b2f0880eead514913b56ba22d3585a699dc579547b61747b3d5f092faf633",
    "src/training-screen.js": "255481f1cfc2439d091bc7e0b138259206f1920804b8fcf795c53d90a229c759",
    "src/training-session-summary.js": "48bd4cad251ec9d2ea5b4d20f4fda79496a8874da1128f53ba246a1516e4bd43",
    "src/training-session.js": "82bd2d255b7c9c5ef6aa44f6eca4427d963fb324bf74ad4fe33b984d7e217538",
    "src/treatment-screen.js": "c250c6cf20f2fda4bab774b5a85e3a3a47b529421b088c83afe02a31969d7374",
    "src/user-facing-errors.js": "bd8af0c7ac826a0d911a09906b64b547962f81402902d8a819e682f605cb5b2a",
    "src/water-reference-context.js": "05f44d253519d19db310bac7a586a05bbc1b5959f0aedc2aaf1dec13d1271ae5",
    "src/workout-evidence.js": "8c9c6a4c7e965a0bd24e1f23285354f37815660068e31c9a8e90878a08b1ad91",
    "src/writes.js": "2056c98acaaf7b40e29e6d86e146965c0d2227b65098e99ee2b82f1310ecf60d",
    "styles.css": "90ca5a32254ba77ebb7394dffc85254f1790b7a70d6071c5772cf5b60336a274",
    "today.css": "c52c17b8471960e744307201f228dd3fcc6e3ed58819489add627a349f1fd21d",
    "training-reference-v2.css": "e74964662b20228ddbf2be53c2da2bcb9462b5361acd3428cfecb4a9f34a76fd",
    "training-reference.css": "4336e64042148a3ea94353dc3f98d3e5010930f14635d90158c480a440c6df10",
    "training.css": "123b48543b6e97893371bba86c15784644fad7096da4e4a2a1d38a99d72970ce",
    "ux-coherence.css": "5f51f49e3d9312c54523257544daa86769ee093f31a35c349aefb73b0abbe6f7",
    "visual-convergence-20260914.css": "84580ab11e8775919f130a587625631ed1ef0ea212dceeb9cc49e336e5a4abd7",
    "water.css": "4b1245f9c6637f712d59847ac8e7da326f1451ba7bcda3f424a8aad3251038dd"
  }
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.build,'health-dashboard-20261019.72');
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
const index=fs.readFileSync(path.join(root,'index.html'),'utf8'),guardTag='<script src="./src/preview-readonly.js?v=health-dashboard-20261019.72"></script>';
assert.ok(index.includes(guardTag)&&index.indexOf(guardTag)<index.indexOf('<script type="module"'),'blocking classic guard loads before application modules');
assert.ok(index.indexOf(guardTag)>index.indexOf('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'),'guard installs after SDK');
assert.match(index,/Prévia · somente leitura/);
assert.equal(fs.existsSync(path.join(root,'manifest.json')),false,'no public manifest JSON');
await import('./preview-readonly-test.mjs');
await import('./preview-presentation-test.mjs');
await import('./nutrition-source-contract-test.mjs');
const reader=fs.readFileSync(path.join(root,'src/data-layer.js'),'utf8');
assert.match(reader,/numeric_kind:source_payload->>numeric_kind/);
assert.match(reader,/document_date:source_payload->>documented_on/);
assert.match(reader,/started_by_user_confirmation:source_payload->started_by_user_confirmation/);
assert.match(reader,/hoje:\[[^\]]*'polarSessions'/);
console.log('Isolated preview: exact runtime hashes, closed JS/CSS dependencies, read-only guard before modules, unchanged authentication/configuration and production build.');
