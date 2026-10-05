(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.SheetPO=Object.assign(root.SheetPO||{},api);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  function detectDelimiter(text){
    const first=String(text||"").split(/\r?\n/).find(Boolean)||"";
    const candidates=[",","\t",";"];
    let best=",",score=-1;
    for(const d of candidates){
      let count=0,inQuotes=false;
      for(let i=0;i<first.length;i++){
        if(first[i]==='"'){
          if(inQuotes&&first[i+1]==='"') i++;
          else inQuotes=!inQuotes;
        } else if(!inQuotes&&first[i]===d) count++;
      }
      if(count>score){score=count;best=d;}
    }
    return best;
  }

  function parseDelimited(text,delimiter){
    const input=String(text||"").replace(/^\uFEFF/,"");
    const d=delimiter||detectDelimiter(input);
    const rows=[];let row=[],cell="",quoted=false;
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(ch==='"'){
        if(quoted&&input[i+1]==='"'){cell+='"';i++;}
        else quoted=!quoted;
      } else if(ch===d&&!quoted){row.push(cell);cell="";}
      else if((ch==="\n"||ch==="\r")&&!quoted){
        if(ch==="\r"&&input[i+1]==="\n") i++;
        row.push(cell);cell="";
        if(row.some(v=>String(v).trim()!=="")) rows.push(row);
        row=[];
      } else cell+=ch;
    }
    row.push(cell);
    if(row.some(v=>String(v).trim()!=="")) rows.push(row);
    return rows;
  }

  function csvEscape(value){
    const s=value==null?"":String(value);
    return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }

  function toCsv(rows){
    return rows.map(row=>row.map(csvEscape).join(",")).join("\r\n")+"\r\n";
  }

  function tableFromRows(rows,headerIndex){
    const index=Math.max(0,Number(headerIndex)||0);
    const source=Array.isArray(rows)?rows:[];
    if(!source[index]) return {headers:[],rows:[],headerIndex:index};
    const width=Math.max(...source.slice(index).map(r=>r.length),0);
    const headers=Array.from({length:width},(_,i)=>{
      const raw=String(source[index][i]??"").trim();
      return raw||("Column "+(i+1));
    });
    const body=source.slice(index+1)
      .filter(r=>r.some(v=>String(v??"").trim()!==""))
      .map((r,offset)=>({
        sourceRow:index+offset+2,
        values:Array.from({length:width},(_,i)=>String(r[i]??"").trim())
      }));
    return {headers,rows:body,headerIndex:index};
  }

  return {detectDelimiter,parseDelimited,toCsv,tableFromRows,csvEscape};
});
