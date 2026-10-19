// Test-only geometry. Range can return both the full run and the ellipsized
// run of one text node. Neither the invisible tail nor that duplicate is ink.
// Keep raw rectangles in the evidence; compare only independently painted text.
export function visibleTextGeometry(raw,width){
  const visible=[],clipped=[];
  for(const item of raw){
    const rect={nodeId:item.nodeId,text:item.text,...item.rect};
    for(const clip of item.clips||[]){
      if(clip.x){rect.left=Math.max(rect.left,clip.left);rect.right=Math.min(rect.right,clip.right);}
      if(clip.y){rect.top=Math.max(rect.top,clip.top);rect.bottom=Math.min(rect.bottom,clip.bottom);}
    }
    if(['left','right','top','bottom'].some(key=>rect[key]!==item.rect[key]))clipped.push({raw:item,visible:rect.right>rect.left&&rect.bottom>rect.top?rect:null});
    if(rect.right<=rect.left||rect.bottom<=rect.top)continue;
    if(!visible.some(other=>other.nodeId===rect.nodeId&&['left','right','top','bottom'].every(key=>other[key]===rect[key])))visible.push(rect);
  }
  const overlaps=[];
  for(let a=0;a<visible.length;a++)for(let b=a+1;b<visible.length;b++){
    const first=visible[a],second=visible[b];
    if(first.nodeId===second.nodeId)continue;
    if(Math.min(first.right,second.right)-Math.max(first.left,second.left)>1&&Math.min(first.bottom,second.bottom)-Math.max(first.top,second.top)>1)overlaps.push({first,second});
  }
  return {visibleText:visible,clippedText:clipped,overflowingText:visible.filter(rect=>rect.left<-1||rect.right>width+1),overlaps};
}
export function contrastRatio(foreground,background){
  const luminance=rgb=>rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  const a=luminance(foreground),b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
