import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
// Generic build hashes live in the test. No public JSON payload is introduced.
const manifest={
  "candidate_commit": "075f3720915b75597528c9aaa69e3ded122356f6",
  "build": "health-dashboard-20261019.74",
  "files": {
    "accessibility.css": "9ee0d8b2fd8bc00d1c039e9dcf8598f695a273cea119614e14181cb4f1879389",
    "analysis.css": "eab9c40cf89e4250d43f3211a1415ce0d05dc4d5c61896563f345f5e61263c1c",
    "bio.css": "9ec3191e86f2e53cbc29486c01303a480e021b0d9d6a9efba0078938a4732562",
    "body-interval.css": "ea7509f603febe4147f6411737b7e015b336cdaea3ddc13f15b9e17abd16061e",
    "calendar-reports.css": "a26983c37dbd9b54fdec2f6488f5aa47477490f8bb89c98792c2ede36c3e3836",
    "cockpit.css": "75d94843fa9861bafc82bb8870c305fddbf140b5c2ba31b3308f186ea88a51bd",
    "composition-model-v2.css": "f312bd24a583e482eea8d23c53f3d4e84d175e9f61ab7d8c3f576db9c2b70907",
    "dashboard-final-polish.css": "e827badad263a43f1283c7d120e732872d85342f206bb37afa926842353cfa67",
    "dashboard-parity.css": "c370a25ea7e501fc4bff32e5d9463cbcbb489f7cb6e026fbccf260485ea20826",
    "dashboard-pixel-parity.css": "391ee883ea04982dd5f8c133fd3621a64972f3e1b8bee093a4e3cf8772cfe639",
    "dashboard-reference-contract.css": "f6af7d09fa862026cf9fb2da3ea39e8abe9999e786d5199d5544b2f075ac7d93",
    "data.css": "d1e0252be7859f2b71988511a0459ec3ee3da170afb65b422566db150951b2d7",
    "details.css": "9dc9aba99add9f399f395bf9312c0db6b690a21739cba44e38036d24f1df8eb0",
    "domain-reference-parity-20260914.css": "1de1275a52a7af5d07bd6a0a74f8cb0badd7d57969f91c92ef3e8d1cdab7cde1",
    "entry.css": "4f3332171fadb4d23e68e4a3c0fdee2d9f483f175aecc4ac099ef9439daa0558",
    "evidence-priority.css": "a2de4cffa12b132bc6d610672f602b6db2f83950c88a04e0b51de27f2f3c36ba",
    "evolution-access.css": "13ade8c7da88fbb2342fa1ba3031d5a5ee0bae93ac232a05ccf7f4477e41021b",
    "evolution-product.css": "8cb9de5242128c6fa5232f1467542924782c4aa1eea9ffaf5bb5884b474757e3",
    "evolution.css": "1ec73c327865ecbe99acc8ccc9fd1816dc288ccc9f492085feb72561d7d6f63e",
    "executive-shell.css": "76e903ad654a2592443f6270dc22facc190f047d46a782ac8c2dac77e844d0b7",
    "health-auto-export.css": "a07db1e6dcfb099c7dfdb38e5fb0392e866d7070324d657dde8675f3dee84572",
    "health-cockpit.css": "eb5fe4a858fde9b1c2b33f9ea0cb1c513a0c1a384c3a5ccc6093137712c5a3cb",
    "health-dashboard.css": "d0778e0d97c3639cd73a68ea31455e4ab29f22d4206466c70987d2b7be270257",
    "health.css": "cb1f904927c5e7f44927d83145abe0076bc618547f27460e8854336a5dfa5004",
    "history-depth.css": "a1a32d6a4c79a65d89223a7c1a3bcdd657d0af586b5a3d2fb400942f93e21cb0",
    "home-overview.css": "b0df7017b66de8a418fac54a6d4851bc223b0594d63f5998d195c478dc2a1ffc",
    "home-reference-experience.css": "94c100a731c1a163bbcbdbf3b6b9c9da9b945c09be5087d322b86034af87ab19",
    "home-reference.css": "33a736c10df124c86f1ff8be54d41be05d0443235b8a688b6923307eb8ff2377",
    "index.html": "03e96abc9f48195a54d40ecde4bdc32156d952367fdc04cd3010fa2957614ef3",
    "integrated-review.css": "a83434613ae31b91bfb5fda9f529cbf95d71b66f732b5f490d59599eedc57ec3",
    "labs-model-v2.css": "b9893528310433cfff662c348caae38794e4917a1d377712717e9ecb36757c47",
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
    "public-audit-remediation.css": "d4e988460ec5ba1390aa4cb9aa4bed9621faac756ad74faee2e22894a9c76332",
    "reference-parity-20260914.css": "80a5ca60b66b069a311f49826de103259ffe852b40e18f244b8e3f2946eed781",
    "reports.css": "a485719dd8341ac56c980ded1414bda12cb094798214401e90d14d386ec70e52",
    "secondary.css": "fd73b47ce49f986c90b669b3bee0c7f941c960dbd2556cd1cbd195bb8698ac79",
    "shell-route-actions.css": "96bc060143db2e88aae18f8ebaca290de2e049819d11c4bb81224bbb9e702717",
    "shell.css": "dff8bbe1d931c717806362a8b54705b41b61753f5e23b5def86d1e5e5a068582",
    "sidebar-mountain-reference.svg": "2d8df4525f6d87b06e8d61ceb158035f6842bd080b02b68c36f246b67fa4ba3d",
    "src/analysis-screen.js": "3f170f6edba644f5cfc254f61a6a9ef2cca1c0635442180c4f22a09b2ad4fd88",
    "src/backup-traceability.js": "0af8635ca3742a1c4c64e28aae92ae56965449fcd1751212e2f61428da429cc9",
    "src/bio-screen.js": "17db7ce7cc76b99a1f0429530cad34c8701591fc3b380592d483fc1d7794b786",
    "src/body-interval-model.js": "8971c33a6693e1c382d80442ac5bc27e2febf63d0b3dd1ce07ff60b1769633e2",
    "src/body-interval-view.js": "59b21ecf7f6bab1da1ee5f0e6362e7cd5c1a3390b27c46953ac4062c2af7c7c8",
    "src/calendar-report-highlights.js": "3cccf50528715fe13fee11c016694f339358ecb0e7bea12344e1b31c2de614e7",
    "src/calendar-report-model.js": "b9f0dacb657ab05aa591928221224a9a73e6827556d3b9563a33348ea177f89a",
    "src/calendar-report-overview.js": "fadae161e7244f50e79dab5a28557d84684cfce746947c199a3bf4a0c71fa823",
    "src/calendar-report-view.js": "4e216354b48bbc3de827d995bd2657fef2e99d87821e87820650a88c8b2a096d",
    "src/care-followup.js": "d27adde998c8a5c643c357c22e010206f1abf3ac819479832e3cacc115d5c7e8",
    "src/composition-layout-v2.js": "a6afcfc84ca5da933c21ce01c686b6abd044eaba2853d66ed4f133f1f6358c21",
    "src/core.js": "99e1a949e70cf71afc62abf32e40a4b6418ddabd1a22a8fa834c2e5555be79c0",
    "src/dashboard-changes.js": "2826da829e3fe46cd62c1939e53e9cb2faa3b097d3bea11757a188faa991fc7a",
    "src/dashboard-reference-runtime.js": "184d98212c45dafbfb6a9ff73d8c5f37b20ca1ae79eb8bad284c661e5349b0e0",
    "src/data-layer.js": "ae272c0a7cd37e3f2a31dbab94e540ddf43be34cf73728b10b209a7511d652fa",
    "src/data-screen.js": "0132cca33e626cc9be154e42619ad4196bee3b58a90b753a6cd1a3ae869b4e4f",
    "src/documented-nutrition-plan.js": "a7a4fa51a6d982cc9edad5f566466a35d2ace003da291c4337cbcca7c8411d46",
    "src/documented-training-plan.js": "6d0d1415c129327585047b8e8c3477ddcec178fdb8c4c9ad43a25524a56d3bf5",
    "src/documented-water-reference.js": "a5e46672d5050cba9746fadbb9821ba8978a78fc69cf9b8822652603866fe213",
    "src/entry.js": "9d53b3798f0d01ace62ac7917934e2fa2634bc0a0dd2e12203e055e4b2194e9a",
    "src/evidence-insights-view.js": "b2dababf8c8ae008af62c3f49362e9e2f62173653eb566dec5504c28a58a6141",
    "src/evidence-insights.js": "46fd88e8c3d7be0ab6de361201581d5a6cab1c4ee785ebf3f53f2bac9387f1a3",
    "src/evidence-priority.js": "a35801fda348552067a5e334643b364ad75304db92c72494325f2c83b275a47a",
    "src/evolution-body-chart.js": "7215d36dcd0c39f0f71a372114e94ec13ee4b969038b41ed5c1e255a47a592ae",
    "src/evolution-model.js": "c95f4f64ff555f51c04cc10e233da9b83cc5e0e9871567791e5f444353486f49",
    "src/evolution-overview.js": "719d9dc90f9c75d22f10f5897e5e7d119a06771ecdf7cb370c5947618296179e",
    "src/evolution-screen.js": "4b0e1328954de031c8c8a7ade77bb839c3b11f4cf2b9b0564c53b7005d74d57e",
    "src/executive-cockpit.js": "d16048560dc7506980afa191b001fcdd3ffc3cbcc8198e12fd952439ca72c0db",
    "src/fleury-preview.js": "7759d42b3b62800f405ba9cb216cd6ea51b61051f7421bef293bcddcb40f3855",
    "src/google-health-connection.js": "b990f9328ae0c5f62cfd0e4b59938dc17d838dec57e710ffef45bcea14aa3549",
    "src/health-auto-export-connection.js": "0b7c3deab61df8671c32acc779ef5d71b2f18e3a035b36ebb4d4f5fdd36b621c",
    "src/health-auto-export-data.js": "241dd41d8a5372f25dbd7c395028c51ebb43b25490f135a22b5fcffde5b415f2",
    "src/health-cockpit.js": "f8719c5d5330cccd337b146694ae8631fc35a2e931e265311fb4cf61b9cf6883",
    "src/health-context.js": "26af9d2436d1145f0e4b155eb1ea26c7138adf6a68db12e26d7dd7fe4c359bf7",
    "src/health-dashboard-body.js": "29c26568e4f0cca387df73a40b1cc157d22bd46e73476e5eb156a70416134f42",
    "src/health-dashboard-context.js": "5a08075d0e970346f646aa5d37e1665a8e25a5024da596e185efaa1515533a41",
    "src/health-dashboard-guidance.js": "40383b198066d52e5e4f8d3b725747b49ae1024815dfd219dd2baaf5244a191a",
    "src/health-dashboard-labs.js": "ff872dce35a698e382bbe557bd33d169edb6d6825aa15cb22736eddd5fd86bdf",
    "src/health-dashboard-model.js": "482adf1a28498dac3e950dd815194a8db23be75a65b60dcc4bb644d28235061a",
    "src/health-dashboard-training.js": "309e7137ba62c5e44797a31fa70968cf6fb30484bce436254e840c0178d8925d",
    "src/health-dashboard.js": "53bf0b6246502792e46c7ee797505a1de9492be32bdec855e8ce1746912075c0",
    "src/health-data-quality-view.js": "aa48eb819ef7624801a65574f2b7d993f38f8b49fad4b616d0c138644b595a0d",
    "src/health-data-quality.js": "1fd3a3f8ba59475e52616414187a6cff5c11578ac506c50eefe3de9c6d10c41d",
    "src/health-lab-documentary-numeric.js": "d6ffaced7ecd6e09c78b37b79019fce42573155690c844ce3490ef37dca61b7e",
    "src/health-lab-reviewed-numeric.js": "d3ee1812c2df272d579c791df3abeb0458960cb24e02dfc7695bf5d3d1509b66",
    "src/health-screen.js": "0fa9211bcd57d80e4a000c92c646389e37ffb45f98872f677433c106b2309895",
    "src/history-tools.js": "d46d52f9f254adbe36b2c4eff394aefb7f83baaa3bd28b023c6fdbe14532e97c",
    "src/home-cockpit.js": "9c60da3cc418113e059e7cc477448dd71cfc2a69b859de5248435ee0892478fe",
    "src/home-evidence-insights.js": "c1a3fe6a08e6271d7aec24940428215cfdfa2473a2006eecbb4d23c49cef95e7",
    "src/home-lab-history.js": "c2382d0762ef86dc15a2ed2887c4ea94d08341b0b94e2bc94d179ad627d9e91c",
    "src/home-overview.js": "2d08723ecce7f700f3dc3263706b75c20c85d08812ed9d3233138ae0ffdd5aa5",
    "src/home-period-model.js": "2e39cbaea6762b2b16799a266bd22c50165405d1d5b9eecd97bba012f0098c0c",
    "src/home-reference-experience.js": "8dc96430d36d70fc5a80e8c33d8baca658fb1db163e0eed3a97070a773458427",
    "src/home-reference.js": "f23182afbbdc87dd2861a3171951cae2fa5febe8f1affd2aa2df9ae987f78267",
    "src/home-useful-content.js": "2be13d47f2b8beab91347fc47588a50f4df6fdc4c19f8615dae861b9d440062e",
    "src/water-source-review.js": "bb081a00da3bf64814a737bc1b9200b0e6444c470304bf952b6423dcef721b08",
    "src/hydration.js": "9664ed7df262e117e17255e621bfa178b35005d24b579f2b0c984c5031a9e391",
    "src/integrated-analysis.js": "3a32d46636af4853d20cf02a6692d1751c3351d9446cbf6cec7d405afc677ea4",
    "src/integrated-review-view.js": "d77bc1c336601b272d15ca432dd630e9281abcd6d41907f6faaaf491d7a458fb",
    "src/integrated-review.js": "0a2b5f6414b706e06fa385bed405b9108ddca7c41140207a8b3908fef508b631",
    "src/intelligence-engine.js": "83d2b9177b7642d8c2eccfe2d68d4df2269e426887de65998c49bba26027246a",
    "src/lab-original-link.js": "9624bd8e469ca3be2aff6bb8cbfc1cc03b400d143d33d19080846cd35d0bd998",
    "src/labs-layout-v2.js": "97aaf8510f927f51d9365f29944a9ad5a093211e2093c685a2ba2ccb68143a3c",
    "src/longitudinal-model.js": "c06b9b2502b1ac95158076f65c2f352348bd787bc27842a8d9cb4bbc2f53fe84",
    "src/longitudinal-story.js": "d2b764d06c1073f0ae57e49290c8e39609ea2095ce6533cc9e8f99ade0c35c12",
    "src/main.js": "7b7a6e20a231cf7d48422c9e603bf1f3bd3845c5302cd3b12acbf8e83ad5dbf1",
    "src/progress-photos.js": "a634ba17cab35b6581de797aab2569367c8f745b6b56285f1f1355ccedafaca3",
    "src/mfp-water-extractor.js": "4f7be9329688ec004c2b4514829a7ec0c5474bd098fd77cf99d30d5e5822a81f",
    "src/mfp-water-transfer.js": "582373491971cc31de92783596265808625f746dd828142ef78222cdabaf9d82",
    "src/mobile-study.js": "110f7b52b14bf6c2a893fd953bdb84f3f59bb1f7af3eaac6008efd1065c1529b",
    "src/nutrition-archive.js": "3e9cb8ca446b34bb206543f010b54c1164b8bdff1d929f073f2dfa342499c34a",
    "src/nutrition-plan-comparison.js": "ec7ae5bbe82c4425001b7ae34e8b64a290d7b0311d87e04e4dee0ac22505efd8",
    "src/nutrition-plan-view.js": "e7a68a59c374215734ff4f3be79d3f91d70dc814fe3a5215a3d70fbf78a025cc",
    "src/nutrition-product.js": "7e4ad89347a1a3e9c0b61d9ec74c19beaa277570f69d2c10a307674e4f809424",
    "src/nutrition-screen.js": "25efdbf671db9358d6fbec292ae1fd6580869baf8731b4c0b3be634019434aba",
    "src/nutrition-source-review.js": "47709c72d0fb86d6391241d2c0677492dd1d657c80f71c7f2b4f693733bc865b",
    "src/personal-goals.js": "8451a8c46108fb01124e1774958f4319498a46b8dc991279bd49f381c03b6d3f",
    "src/plan-original-link.js": "fe9ccd46f0286c5ccef49d060caa9276d2b62189f53b2c07f67ca4213d2fec26",
    "src/polar-connection.js": "9f8a36a7e85b81d4c3778284f09ff89a116489ad4c8ba4139e7fed73155ea224",
    "src/preview-readonly.js": "a37032572f796651d3d41b323baace2a85eb899db69e6862aac3d4ef4c49f81e",
    "src/product-layout-runtime.js": "8365fad2c3232ad318fd52e9e934d4d2e865984178c0952aeb28e746d89440ac",
    "src/product-layout-v2.js": "a70967aea9eed353798c630bcd6d3f576d9b1c7709af3c3cfd7164f508452a16",
    "src/product-shell.js": "b28304fe107abd7f33936f35a564cf4c595fb894b6794069bf82c39effdce114",
    "src/recovery-layout-v2.js": "154e8ae21f55df9de451049ee82c7f401ed51bc62dea66792d1e32643d0f0beb",
    "src/reports-model.js": "3b7ebb67c86efa89b34e6a7df8db02544399f19c27a48b51905acc17a58878ba",
    "src/reports-screen.js": "2a841473d51db38dcffd4b4d064f2e79843aeed0d6673a231de748655601b691",
    "src/shell-accessibility.js": "fd6f3c38276ee014523ca2e72a234157daa43c62e6da6f7d202c041228ff77b5",
    "src/source-display.js": "f74016c74f3bb5ac14ef885894e48f295c2c7d50facf4cc796e45ed9cfb3b8be",
    "src/source-status.js": "87ea9723814f317944f6d53215bf0ffb7464e151367fb23cfcc5b28c61d80fbe",
    "src/source-window-view.js": "84a30d5a0c1ddc262ead5a6fa16bff6fc75d372ce3495e461a19f8958fe08730",
    "src/steps-evidence-view.js": "fe5ce4e8299e684b7061b49ace897bd115afb3fc4e64bdcdf759e20b6e528b6b",
    "src/steps-evidence.js": "288fe0eaa92554e6e99d1a7bf4a5c00feaeacaa3c0eea706b219fab35a9f20da",
    "src/study-findings.js": "112a5925feb0fcb9267e6c1d5483f9b1ee1befcfc7444336cbe1b603ab550e80",
    "src/timeline-screen.js": "f9e0ed4aa1ece79e6af3d268c0fc18dd903e2e87e04f1adee6572d8f6a86a4df",
    "src/today-screen.js": "0686db7acb46bd8147e9c5bf8aa6e30d2bd5f670fdfa0e1a1c5eab397bf4313c",
    "src/training-comparability.js": "29cbde79fed598028c4fffcf6789d8793909b7df64c9f7bec31c2a3a8919cc99",
    "src/training-history.js": "b1e565b2d74d07a3be82958ac08cff3f4161909735cabd12d7dee32e09552e55",
    "src/training-load-qualifier.js": "f3024be1f935a1b2b18d3f02d160a210ceefe2466af8b7ac2a97dd08cf23a9a8",
    "src/training-plan-view.js": "2b859001112a578207586c83d64594431f29b4c8981d0df49bf3ae2954fa6b63",
    "src/training-reference-runtime.js": "4c4beddd0c7d62983c603632f0b178a1fdcba823e2f9bdf63a490ca7f9907b23",
    "src/training-reference-v2.js": "3d3af25d07e182988aacf404b4c79fc6a077c778f7011b7bc38c081967f7332c",
    "src/training-screen.js": "255481f1cfc2439d091bc7e0b138259206f1920804b8fcf795c53d90a229c759",
    "src/training-session-summary.js": "48bd4cad251ec9d2ea5b4d20f4fda79496a8874da1128f53ba246a1516e4bd43",
    "src/training-session-visuals.js": "c5818d875368342aeb0aa36d5cf80f0647d14d916feb4419400f484fa918399a",
    "src/training-session.js": "7a443f136305290cd8c21231588387d4d02337afa775d7115e5d537ff6af2f98",
    "src/treatment-screen.js": "239808d3fbddc678a7a0b57312c501a71f19aa4b06bf6e3a1aa4e4194b10bd8d",
    "src/user-facing-errors.js": "bd8af0c7ac826a0d911a09906b64b547962f81402902d8a819e682f605cb5b2a",
    "src/water-reference-context.js": "05f44d253519d19db310bac7a586a05bbc1b5959f0aedc2aaf1dec13d1271ae5",
    "src/workout-composer.js": "e0467b238f336cd35e36502efc0baafa3cabf0c04d5879693190c0dedb00e956",
    "src/workout-entry-ui.js": "010b8eb04bd608167239e5839b5f45648ef28ab7c9429343dffdd4eb72daae85",
    "src/workout-evidence.js": "d964bca40266d0651ff269cb4d586b29945db1ff7b6bc9c629bb8f0b812f0960",
    "src/writes.js": "f1e332a53118605615789ab37e811692bbab605429e2d1ca1af9270994994f4b",
    "styles.css": "90ca5a32254ba77ebb7394dffc85254f1790b7a70d6071c5772cf5b60336a274",
    "today.css": "c52c17b8471960e744307201f228dd3fcc6e3ed58819489add627a349f1fd21d",
    "training-reference-v2.css": "693588e165e2cf58eda43dc1583394dd0917efcdd9d20b32da7f699a09c86862",
    "training-reference.css": "4336e64042148a3ea94353dc3f98d3e5010930f14635d90158c480a440c6df10",
    "training.css": "123b48543b6e97893371bba86c15784644fad7096da4e4a2a1d38a99d72970ce",
    "ux-coherence.css": "5f51f49e3d9312c54523257544daa86769ee093f31a35c349aefb73b0abbe6f7",
    "visual-convergence-20260914.css": "84580ab11e8775919f130a587625631ed1ef0ea212dceeb9cc49e336e5a4abd7",
    "water.css": "4b1245f9c6637f712d59847ac8e7da326f1451ba7bcda3f424a8aad3251038dd",
    "src/navigation-history.js": "5667e32730da8a6ea50075ff89bca1d09d789ef09ab71ee193e35e5dfea8543f"
  }
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.build,'health-dashboard-20261019.74');
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
const productionIndex=fs.readFileSync(path.join(production,'index.html'),'utf8');
assert.match(productionIndex,/mobile-parity-20261014\.58|health-integrated-20261119\.155/,'production is either the legacy entry or the independently tested integrated build');
if(productionIndex.includes('health-integrated-20261112.133'))await import('../../../v2/production-integration-contract.mjs');
assert.match(fs.readFileSync(path.join(root,'src/main.js'),'utf8'),/if\(!session\)\{showLogin\(\);\}/,'missing auth stays behind login');
assert.doesNotMatch(core,/service_role|sb_secret_/);
const index=fs.readFileSync(path.join(root,'index.html'),'utf8'),guardTag='<script src="./src/preview-readonly.js?v=health-dashboard-20261019.74"></script>';
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
