// Tiny HTML reader used only by Node rendering tests, not the application.
// It models native closed <details> and ignores attributes/scripts/styles;
// browser acceptance additionally checks actual CSS visibility and geometry.
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
export const decodeHtml=value=>String(value).replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,v)=>String.fromCodePoint(v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v))).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,v)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[v]));
export function htmlText(html,{expanded=false,allOptions=false}={}){
  const root={tag:'root',children:[]},stack=[root];
  for(const match of String(html).matchAll(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|[^<]+|</g)){
    const token=match[0];if(token.startsWith('<!--'))continue;
    if(token.startsWith('</')){const tag=token.slice(2).match(/^[\w-]+/)?.[0].toLowerCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tag===tag){stack.length=i;break;}continue;}
    if(token.startsWith('<')&&/^<[a-zA-Z]/.test(token)){const tag=token.slice(1).match(/^[\w-]+/)[0].toLowerCase(),node={tag,attrs:token,children:[]};stack.at(-1).children.push(node);if(!voidTags.has(tag)&&!token.endsWith('/>'))stack.push(node);continue;}
    stack.at(-1).children.push(decodeHtml(token));
  }
  function read(node){
    if(typeof node==='string')return node;
    if(['script','style','svg'].includes(node.tag))return '';
    if(node.tag==='option'&&!allOptions&&!/\sselected(?:[\s=>])/i.test(node.attrs))return '';
    const children=node.tag==='details'&&!expanded&&!/\sopen(?:[\s=>])/i.test(node.attrs)?node.children.filter(child=>typeof child!=='string'&&child.tag==='summary').slice(0,1):node.children;
    return children.map(read).join(' ')+'\n';
  }
  return read(root).split('\n').map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}
export const backendTerms=/\b(?:can[oô]nic[ao]s?|candidat[ao]s?|retid[ao]s?|canonical|candidate|held|quarantined|care_followup|payload|source_record_id|canonical_status|RPC|SQLSTATE|PostgREST)\b|dados (?:n[aã]o conferidos|recebidos)|column .*does not exist|relation .*does not exist/ig;
export function technicalMatches(text){return [...String(text).matchAll(backendTerms)].map(match=>({term:match[0],context:String(text).slice(Math.max(0,match.index-70),match.index+match[0].length+110).replace(/\n/g,' ')}));}
