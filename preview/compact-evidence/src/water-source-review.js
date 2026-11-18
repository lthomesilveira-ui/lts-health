// Only server-authenticated source records participate in this comparison.
// A daily total for one publisher and an individual event are never added.
const takeout = /^google_health_takeout:(water|water-source|water-event):[a-f0-9]{64}$/;

function channel(row) {
  if (row.source_family === 'health_auto_export' && row.confidence === 'authenticated_auto_export' &&
      row.canonical_status === 'canonical' && row.metric_type === 'dietary_water_ml' &&
      String(row.source_record_id).startsWith('health_auto_export:')) return 'iphone';
  if (row.source_family !== 'google_health_takeout' || row.confidence !== 'authenticated_google_takeout') return null;
  const kind = takeout.exec(row.source_record_id)?.[1];
  if (row.source_name === 'MyFitnessPal · Google Health') {
    if (kind === 'water' && row.canonical_status === 'canonical' && row.metric_type === 'dietary_water_ml') return 'mfp';
    if (kind === 'water-source' && row.canonical_status === 'held' && row.metric_type === 'dietary_water_source_total_ml') return 'mfp';
  }
  if (kind === 'water-event' && row.canonical_status === 'held' &&
      row.metric_type === 'dietary_water_source_event_ml' && row.source_name === 'Google Health App') return 'events';
  return null;
}

function validWaterObservation(row) {
  if (row?.unit !== 'mL' || !['string','number'].includes(typeof row.value) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.metric_date)) return false;
  const value = Number(row.value), day = new Date(row.metric_date + 'T12:00:00Z');
  return Number.isFinite(value) && value > 0 && value <= 100000 &&
    Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === row.metric_date;
}

export function originalMyFitnessPalWater(row) {
  return row?.source_family === 'myfitnesspal' && row.source_name === 'MyFitnessPal' &&
    row.confidence === 'account_authenticated_export' && row.canonical_status === 'canonical' &&
    row.metric_type === 'dietary_water_ml' && row.source_record_id === 'mfp-water:' + row.metric_date &&
    validWaterObservation(row) && Number.isInteger(Number(row.value));
}

export function latestIPhoneWaterDate(rows = []) {
  let latest = null;
  for (const row of rows) {
    if (row && channel(row) === 'iphone' && validWaterObservation(row) && (!latest || row.metric_date > latest))
      latest = row.metric_date;
  }
  return latest;
}

export function waterSourceReview(rows = []) {
  const byDate = new Map();
  for (const row of rows) {
    if (!validWaterObservation(row)) continue;
    const value = Number(row.value), date = row.metric_date;
    const type = channel(row);
    if (!type) continue;
    if (!byDate.has(date)) byDate.set(date, {date, mfp: new Map(), iphone: new Map(), events: new Map()});
    // The original row hash is the same if a documented source total later
    // acquires canonical status. A mirror must not create a second observation.
    const identity = type === 'mfp' ? row.source_record_id.split(':').at(-1) : row.source_record_id;
    byDate.get(date)[type].set(identity + '/' + value, value);
  }
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!originalMyFitnessPalWater(row)) continue;
    const group = byDate.get(row.metric_date);
    if (group) (group.original ??= new Set()).add(Number(row.value));
  }
  const result = [];
  for (const {date, mfp, iphone, events, original} of byDate.values()) {
    if (!mfp.size && !events.size && !(original && iphone.size)) continue;
    const totals = [...mfp.values(), ...iphone.values(), ...(original || [])];
    result.push({date, mfp: [...mfp.values()], iphone: [...iphone.values()], events: [...events.values()],
      ...(original ? {original: [...original]} : {}),
      conflict: mfp.size > 1 || ((mfp.size > 0 || Boolean(original)) && new Set(totals).size > 1)});
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function reviewedWaterConflictDates(rows) {
  return new Set(waterSourceReview(rows).filter(row => row.conflict).map(row => row.date));
}
