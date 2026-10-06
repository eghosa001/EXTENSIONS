(function(root){
  const MAX_ARCHIVE_BYTES=25*1024*1024;
  const MAX_ENTRIES=5000;
  const MAX_ENTRY_BYTES=32*1024*1024;
  const MAX_TOTAL_UNCOMPRESSED=80*1024*1024;
  const MAX_SHEETS=100;
  const MAX_ROWS_PER_SHEET=25050;
  const MAX_COLUMNS=16384;
  const MAX_CELLS_PER_SHEET=500000;
  const MAX_SHARED_STRINGS=500000;

  function fail(message){throw new Error(message);}

  async function inflateRaw(bytes,maxBytes){
    if(typeof DecompressionStream==="undefined")fail("This browser cannot read compressed XLSX files. Save the sheet as CSV and retry.");
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const reader=stream.getReader();
    const chunks=[];let total=0;
    try{
      while(true){
        const part=await reader.read();
        if(part.done)break;
        total+=part.value.byteLength;
        if(total>maxBytes){
          await reader.cancel();
          fail("XLSX entry is too large to process safely.");
        }
        chunks.push(part.value);
      }
    }catch(error){
      if(String(error&&error.message||"").includes("too large"))throw error;
      fail("The XLSX archive contains invalid compressed data.");
    }
    const out=new Uint8Array(total);let offset=0;
    for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength;}
    return out;
  }

  function u16(view,o){
    if(o<0||o+2>view.byteLength)fail("Invalid XLSX/ZIP structure.");
    return view.getUint16(o,true);
  }
  function u32(view,o){
    if(o<0||o+4>view.byteLength)fail("Invalid XLSX/ZIP structure.");
    return view.getUint32(o,true);
  }

  async function unzip(buffer){
    if(!(buffer instanceof ArrayBuffer))fail("Invalid XLSX input.");
    if(buffer.byteLength>MAX_ARCHIVE_BYTES)fail("XLSX file is larger than the 25 MB safety limit.");
    const bytes=new Uint8Array(buffer),view=new DataView(buffer);
    if(bytes.length<22)fail("Invalid XLSX/ZIP file.");

    let eocd=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
      if(u32(view,i)===0x06054b50){eocd=i;break;}
    }
    if(eocd<0)fail("Invalid XLSX/ZIP file.");

    const disk=u16(view,eocd+4),centralDisk=u16(view,eocd+6);
    const entriesOnDisk=u16(view,eocd+8),entries=u16(view,eocd+10);
    const centralSize=u32(view,eocd+12),central=u32(view,eocd+16);
    if(disk!==0||centralDisk!==0||entriesOnDisk!==entries)fail("Multi-volume XLSX archives are not supported.");
    if(entries>MAX_ENTRIES)fail("XLSX contains too many archive entries.");
    if(central+centralSize>eocd||central>bytes.length)fail("Invalid XLSX central directory.");

    let p=central,totalDeclared=0;
    const files=Object.create(null);
    const dec=new TextDecoder("utf-8",{fatal:false});

    for(let n=0;n<entries;n++){
      if(p+46>bytes.length||u32(view,p)!==0x02014b50)fail("Invalid XLSX central directory entry.");
      const flags=u16(view,p+8),method=u16(view,p+10),compressed=u32(view,p+20),uncompressed=u32(view,p+24);
      const nameLen=u16(view,p+28),extraLen=u16(view,p+30),commentLen=u16(view,p+32),local=u32(view,p+42);
      const endHeader=p+46+nameLen+extraLen+commentLen;
      if(endHeader>bytes.length)fail("Invalid XLSX central directory bounds.");
      if(flags&1)fail("Encrypted XLSX archives are not supported.");
      if(uncompressed>MAX_ENTRY_BYTES)fail("XLSX entry is too large to process safely.");
      totalDeclared+=uncompressed;
      if(totalDeclared>MAX_TOTAL_UNCOMPRESSED)fail("XLSX expands beyond the safe processing limit.");

      const name=dec.decode(bytes.slice(p+46,p+46+nameLen));
      if(!name||name.includes("\0"))fail("Invalid XLSX archive entry name.");
      if(Object.prototype.hasOwnProperty.call(files,name))fail("XLSX contains duplicate archive entries.");

      if(local+30>bytes.length||u32(view,local)!==0x04034b50)fail("Invalid XLSX local file header.");
      const localName=u16(view,local+26),localExtra=u16(view,local+28);
      const start=local+30+localName+localExtra;
      const end=start+compressed;
      if(start>bytes.length||end>bytes.length||end<start)fail("Invalid XLSX compressed-data bounds.");
      const chunk=bytes.slice(start,end);

      let out;
      if(method===0)out=chunk;
      else if(method===8)out=await inflateRaw(chunk,Math.min(MAX_ENTRY_BYTES,uncompressed||MAX_ENTRY_BYTES));
      else fail("Unsupported XLSX compression method "+method+". Save the sheet as CSV and retry.");

      if(out.byteLength!==uncompressed)fail("XLSX entry size does not match its archive metadata.");
      files[name]=out;
      p=endHeader;
    }
    if(p>central+centralSize)fail("Invalid XLSX central directory size.");
    return files;
  }

  function xml(bytes){
    if(!bytes)fail("Required XLSX XML data is missing.");
    const source=new TextDecoder().decode(bytes);
    if(/<!DOCTYPE|<!ENTITY/i.test(source))fail("Unsafe XML declarations are not allowed in XLSX files.");
    const doc=new DOMParser().parseFromString(source,"application/xml");
    if(doc.getElementsByTagName("parsererror").length)fail("The XLSX file contains invalid XML.");
    return doc;
  }

  function textOf(node,name){
    const el=node&&node.getElementsByTagName(name)[0];
    return el?el.textContent||"":"";
  }

  function columnIndex(ref){
    const match=String(ref||"").match(/^[A-Z]+/i);
    const letters=(match?match[0]:"A").toUpperCase();
    let n=0;
    for(const c of letters){
      n=n*26+(c.charCodeAt(0)-64);
      if(n>MAX_COLUMNS)fail("Worksheet contains a column beyond Excel's supported range.");
    }
    return n-1;
  }

  function sharedStrings(files){
    const data=files["xl/sharedStrings.xml"];
    if(!data)return[];
    const doc=xml(data);
    const nodes=Array.from(doc.getElementsByTagName("si"));
    if(nodes.length>MAX_SHARED_STRINGS)fail("XLSX contains too many shared strings.");
    return nodes.map(function(si){
      return Array.from(si.getElementsByTagName("t")).map(function(t){return t.textContent||"";}).join("");
    });
  }

  function workbookSheets(files){
    const wb=files["xl/workbook.xml"];
    if(!wb)fail("Workbook metadata is missing.");
    const doc=xml(wb),relsData=files["xl/_rels/workbook.xml.rels"];
    const rels=new Map();
    if(relsData){
      const rd=xml(relsData);
      Array.from(rd.getElementsByTagName("Relationship")).forEach(function(r){
        rels.set(r.getAttribute("Id"),r.getAttribute("Target"));
      });
    }
    const sheetNodes=Array.from(doc.getElementsByTagName("sheet"));
    if(sheetNodes.length>MAX_SHEETS)fail("Workbook contains too many worksheets.");
    return sheetNodes.map(function(s,i){
      const rid=s.getAttribute("r:id")||s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
      let target=rels.get(rid)||("worksheets/sheet"+(i+1)+".xml");
      target=String(target||"").replace(/^\//,"").replace(/^xl\//,"");
      target=target.replace(/^worksheets\/\.\.\//,"");
      while(target.startsWith("../"))target=target.slice(3);
      if(!target.startsWith("worksheets/"))target="worksheets/"+target.split("/").pop();
      return {name:(s.getAttribute("name")||("Sheet "+(i+1))).slice(0,120),path:"xl/"+target};
    });
  }

  function parseSheet(files,path,shared){
    const data=files[path];
    if(!data)fail("Worksheet "+path+" is missing.");
    const doc=xml(data),rows=[];
    const rowNodes=Array.from(doc.getElementsByTagName("row"));
    if(rowNodes.length>MAX_ROWS_PER_SHEET)fail("Worksheet has more than 25,000 rows. Split it into smaller files.");
    let cellCount=0;
    for(const rowNode of rowNodes){
      const row=[];
      const cells=Array.from(rowNode.getElementsByTagName("c"));
      cellCount+=cells.length;
      if(cellCount>MAX_CELLS_PER_SHEET)fail("Worksheet contains too many cells to process safely.");
      for(const c of cells){
        const index=columnIndex(c.getAttribute("r"));
        const type=c.getAttribute("t");
        let value="";
        if(type==="inlineStr")value=Array.from(c.getElementsByTagName("t")).map(function(t){return t.textContent||"";}).join("");
        else{
          const raw=textOf(c,"v");
          if(type==="s"){
            const sharedIndex=Number(raw);
            value=Number.isInteger(sharedIndex)&&sharedIndex>=0&&sharedIndex<shared.length?shared[sharedIndex]:"";
          }else value=raw;
        }
        if(value.length>100000)fail("Worksheet contains an excessively large cell value.");
        row[index]=value;
      }
      rows.push(Array.from({length:row.length},function(_,i){return row[i]||"";}));
    }
    return rows;
  }

  async function parseXlsx(buffer){
    const files=await unzip(buffer);
    const shared=sharedStrings(files),sheets=workbookSheets(files);
    if(!sheets.length)fail("Workbook contains no worksheets.");
    const parsed=[];
    for(const sheet of sheets)parsed.push({name:sheet.name,rows:parseSheet(files,sheet.path,shared)});
    return parsed;
  }

  root.SheetPO=Object.assign(root.SheetPO||{},{parseXlsx});
})(typeof globalThis!=="undefined"?globalThis:this);
