(function(root){
  async function inflateRaw(bytes){
    if(typeof DecompressionStream==="undefined") throw new Error("This browser cannot read compressed XLSX files. Save the sheet as CSV and retry.");
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function u16(view,o){return view.getUint16(o,true)}
  function u32(view,o){return view.getUint32(o,true)}

  async function unzip(buffer){
    const bytes=new Uint8Array(buffer),view=new DataView(buffer);
    let eocd=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
      if(u32(view,i)===0x06054b50){eocd=i;break;}
    }
    if(eocd<0) throw new Error("Invalid XLSX/ZIP file.");
    const entries=u16(view,eocd+10),central=u32(view,eocd+16);
    let p=central;const files={};const dec=new TextDecoder();
    for(let n=0;n<entries;n++){
      if(u32(view,p)!==0x02014b50) break;
      const method=u16(view,p+10),compressed=u32(view,p+20);
      const nameLen=u16(view,p+28),extraLen=u16(view,p+30),commentLen=u16(view,p+32),local=u32(view,p+42);
      const name=dec.decode(bytes.slice(p+46,p+46+nameLen));
      const localName=u16(view,local+26),localExtra=u16(view,local+28);
      const start=local+30+localName+localExtra;
      const chunk=bytes.slice(start,start+compressed);
      let out;
      if(method===0) out=chunk;
      else if(method===8) out=await inflateRaw(chunk);
      else throw new Error("Unsupported XLSX compression method "+method+". Save the sheet as CSV and retry.");
      files[name]=out;
      p+=46+nameLen+extraLen+commentLen;
    }
    return files;
  }

  function xml(bytes){
    return new DOMParser().parseFromString(new TextDecoder().decode(bytes),"application/xml");
  }

  function textOf(node,name){
    const el=node&&node.getElementsByTagName(name)[0];
    return el?el.textContent||"":"";
  }

  function columnIndex(ref){
    const match=String(ref||"").match(/^[A-Z]+/i);
    const letters=(match?match[0]:"A").toUpperCase();
    let n=0;
    for(const c of letters)n=n*26+(c.charCodeAt(0)-64);
    return n-1;
  }

  function sharedStrings(files){
    const data=files["xl/sharedStrings.xml"];
    if(!data)return[];
    const doc=xml(data);
    return Array.from(doc.getElementsByTagName("si")).map(function(si){
      return Array.from(si.getElementsByTagName("t")).map(function(t){return t.textContent||"";}).join("");
    });
  }

  function workbookSheets(files){
    const wb=files["xl/workbook.xml"];
    if(!wb)throw new Error("Workbook metadata is missing.");
    const doc=xml(wb),relsData=files["xl/_rels/workbook.xml.rels"];
    const rels=new Map();
    if(relsData){
      const rd=xml(relsData);
      Array.from(rd.getElementsByTagName("Relationship")).forEach(function(r){
        rels.set(r.getAttribute("Id"),r.getAttribute("Target"));
      });
    }
    return Array.from(doc.getElementsByTagName("sheet")).map(function(s,i){
      const rid=s.getAttribute("r:id")||s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
      let target=rels.get(rid)||("worksheets/sheet"+(i+1)+".xml");
      target=target.replace(/^\//,"").replace(/^xl\//,"");
      target=target.replace(/^worksheets\/\.\.\//,"");
      if(target.startsWith("../")) target=target.slice(3);
      if(!target.startsWith("worksheets/")) target="worksheets/"+target.split("/").pop();
      return {name:s.getAttribute("name")||("Sheet "+(i+1)),path:"xl/"+target};
    });
  }

  function parseSheet(files,path,shared){
    const data=files[path];
    if(!data)throw new Error("Worksheet "+path+" is missing.");
    const doc=xml(data),rows=[];
    for(const rowNode of Array.from(doc.getElementsByTagName("row"))){
      const row=[];
      for(const c of Array.from(rowNode.getElementsByTagName("c"))){
        const index=columnIndex(c.getAttribute("r"));
        const type=c.getAttribute("t");
        let value="";
        if(type==="inlineStr") value=Array.from(c.getElementsByTagName("t")).map(function(t){return t.textContent||"";}).join("");
        else{
          const raw=textOf(c,"v");
          value=type==="s"?(shared[Number(raw)]||""):raw;
        }
        row[index]=value;
      }
      rows.push(Array.from({length:row.length},function(_,i){return row[i]||"";}));
    }
    return rows;
  }

  async function parseXlsx(buffer){
    const files=await unzip(buffer),shared=sharedStrings(files),sheets=workbookSheets(files);
    const parsed=[];
    for(const sheet of sheets) parsed.push({name:sheet.name,rows:parseSheet(files,sheet.path,shared)});
    return parsed;
  }

  root.SheetPO=Object.assign(root.SheetPO||{},{parseXlsx});
})(typeof globalThis!=="undefined"?globalThis:this);
