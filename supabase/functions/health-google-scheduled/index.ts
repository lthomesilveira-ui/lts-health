import {googleHealthConfig,googleHealthService,googleHealthHandlers} from '../_shared/google-health-runtime.mjs';
import {handleGoogleHydrationSchedule} from '../_shared/google-health-schedule.mjs';

// Custom single-use ticket authentication precedes configuration and owner lookup.
// Only this server endpoint disables gateway JWT verification. The owner route keeps it.
Deno.serve(req=>handleGoogleHydrationSchedule(req,{
  db:googleHealthService(googleHealthConfig()),ready:googleHealthHandlers.scheduledReady,read:googleHealthHandlers.scheduledRead
}));
