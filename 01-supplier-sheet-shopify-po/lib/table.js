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

  function tableFromRows(rows){
    if(!rows||!rows.length) return {headers:[],rows:[]};
    const width=Math.max(...rows.map(r=>r.length));
    const headers=Array.from({length:width},(_,i)=>{
      const raw=String(rows[0][i]??"").trim();
      return raw||("Column "+(i+1));
    });
    const body=rows.slice(1).filter(r=>r.some(v=>String(v??"").trim()!=="")).map((r,index)=>({
      sourceRow:index+2,
      values:Array.from({length:width},(_,i)=>String(r[i]??"").trim())
    }));
    return {headers,rows:body};
  }

  return {detectDelimiter,parseDelimited,toCsv,tableFromRows,csvEscape};
});
