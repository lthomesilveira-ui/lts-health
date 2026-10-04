// Custom revocable key auth is checked in receiveHealthExport BEFORE reading the body.
import {config,service} from '../_shared/health-auto-export-runtime.mjs';
import {receiveHealthExport} from '../_shared/health-auto-export-handler.mjs';
Deno.serve(req=>receiveHealthExport(req,service(config())));
