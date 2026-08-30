export function strictLabNumeric(raw, decimalSeparator){
  if(raw===null||raw===undefined)return null;
  if(decimalSeparator!==','&&decimalSeparator!=='.')throw new Error('decimal_separator_required');
  const text=String(raw).trim();
  if(!text)return null;
  const pattern=decimalSeparator===','?/^[+-]?\d+(?:,\d+)?$/:/^[+-]?\d+(?:\.\d+)?$/;
  if(!pattern.test(text))return null;
  const normalized=decimalSeparator===','?text.replace(',','.'):text;
  const value=Number(normalized);
  return Number.isFinite(value)?value:null;
}

export function normalizeLabResult(raw,decimalSeparator){
  return{
    result_raw:raw===null||raw===undefined?null:String(raw),
    result_numeric:strictLabNumeric(raw,decimalSeparator)
  };
}
