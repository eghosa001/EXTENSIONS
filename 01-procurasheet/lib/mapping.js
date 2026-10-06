(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.SheetPO=Object.assign(root.SheetPO||{},api);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const FIELDS=[
    {key:"sku",label:"Shopify SKU",required:false},
    {key:"barcode",label:"Barcode",required:false},
    {key:"supplierSku",label:"Supplier SKU",required:false},
    {key:"quantity",label:"Quantity",required:true},
    {key:"cost",label:"Cost",required:false},
    {key:"tax",label:"Tax",required:false}
  ];

  const SYNONYMS={
    sku:["shopify sku","variant sku","product sku","internal sku","our sku","sku"],
    barcode:["variant barcode","barcode","upc","ean","gtin","isbn"],
    supplierSku:["supplier sku","vendor sku","supplier code","vendor code","supplier item","item number","item no","part number","mpn","ref","reference"],
    quantity:["order quantity","order qty","quantity ordered","qty ordered","quantity","qty","units","pcs","pieces"],
    cost:["unit cost","net cost","purchase price","buy price","unit price","wholesale price","cost","price"],
    tax:["tax percentage","tax percent","tax rate","vat percentage","vat percent","vat rate","tax","vat"]
  };

  function cleanHeader(value){
    return String(value||"").toLowerCase().replace(/[_\-\/]+/g," ").replace(/[^a-z0-9% ]/g," ").replace(/\s+/g," ").trim();
  }

  function scoreHeader(header,field){
    const h=cleanHeader(header);
    if(!h) return 0;
    let best=0;
    for(const term of SYNONYMS[field]||[]){
      if(h===term) best=Math.max(best,100);
      else if(h.startsWith(term+" ")||h.endsWith(" "+term)) best=Math.max(best,80);
      else if(h.includes(term)) best=Math.max(best,60);
    }
    return best;
  }

  function detectHeaderRow(rows){
    const source=Array.isArray(rows)?rows:[];
    const limit=Math.min(source.length,25);
    let winner={index:0,score:-1};
    for(let i=0;i<limit;i++){
      const row=source[i]||[];
      const matched=new Set();
      let exact=0;
      row.forEach(cell=>{
        FIELDS.forEach(field=>{
          const score=scoreHeader(cell,field.key);
          if(score>=60) matched.add(field.key);
          if(score===100) exact++;
        });
      });
      const nonEmpty=row.filter(v=>String(v??"").trim()!=="").length;
      const score=matched.size*100+exact*10+Math.min(nonEmpty,10);
      if(score>winner.score) winner={index:i,score};
    }
    return winner.score>=205?winner.index:0;
  }

  function autoMap(headers){
    const result={};const used=new Set();
    for(const field of FIELDS) result[field.key]=-1;
    const priority=["supplierSku","barcode","quantity","cost","tax","sku"];
    for(const key of priority){
      let best={index:-1,score:0};
      headers.forEach((h,index)=>{
        if(used.has(index)) return;
        const score=scoreHeader(h,key);
        if(score>best.score) best={index,score};
      });
      result[key]=best.score>=60?best.index:-1;
      if(result[key]>=0) used.add(result[key]);
    }
    return result;
  }

  function numberValue(value){
    if(typeof value==="number") return Number.isFinite(value)?value:0;
    const raw=String(value==null?"":value).trim();
    const accountingNegative=/^\(.*\)$/.test(raw);
    let s=raw.replace(/[^0-9,.-]/g,"");
    if(!s) return 0;
    const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
    if(comma>-1&&dot>-1){
      s=comma>dot?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
    }else if(comma>-1){
      const decimals=s.length-comma-1;
      s=decimals===2?s.replace(",","."):s.replace(/,/g,"");
    }
    const n=Number(s);
    if(!Number.isFinite(n)) return 0;
    return accountingNegative?-Math.abs(n):n;
  }

  function cleanIdentity(value){return String(value==null?"":value).trim();}
  function cleanBarcode(value){return String(value==null?"":value).trim().replace(/\s+/g,"").replace(/\.0$/,"");}
  function taxValue(value){
    const raw=String(value==null?"":value).trim();
    if(!raw) return "";
    return numberValue(raw);
  }

  function normalizeRows(table,mapping,savedSkuMap){
    const dictionary=savedSkuMap||{};
    return table.rows.map(row=>{
      const get=(key)=>mapping[key]>=0?row.values[mapping[key]]:"";
      const supplierSku=cleanIdentity(get("supplierSku"));
      let sku=cleanIdentity(get("sku"));
      if(!sku&&supplierSku&&dictionary[supplierSku]) sku=dictionary[supplierSku];
      return {
        sourceRow:row.sourceRow,
        sku,
        barcode:cleanBarcode(get("barcode")),
        supplierSku,
        quantity:numberValue(get("quantity")),
        cost:get("cost")===""?"":numberValue(get("cost")),
        tax:get("tax")===""?"":taxValue(get("tax"))
      };
    });
  }

  function validateRows(rows,catalog){
    const skuCounts=new Map(),barcodeCounts=new Map();
    for(const row of rows){
      const sku=cleanIdentity(row.sku).toLowerCase();
      const barcode=cleanBarcode(row.barcode);
      if(sku) skuCounts.set(sku,(skuCounts.get(sku)||0)+1);
      if(barcode) barcodeCounts.set(barcode,(barcodeCounts.get(barcode)||0)+1);
    }
    return rows.map(row=>{
      const errors=[],warnings=[];
      const sku=cleanIdentity(row.sku);
      const barcode=cleanBarcode(row.barcode);
      const quantity=Number(row.quantity);
      const cost=row.cost===""?"":Number(row.cost);
      const tax=row.tax===""?"":Number(row.tax);

      if(!sku&&!barcode) errors.push("Add Shopify SKU or Barcode");
      if(!Number.isFinite(quantity)||quantity<=0) errors.push("Quantity must be greater than 0");
      else if(!Number.isInteger(quantity)) errors.push("Quantity must be a whole number");

      if(cost!==""&&(!Number.isFinite(cost)||cost<0)) errors.push("Cost must be 0 or greater");
      if(tax!==""&&(!Number.isFinite(tax)||tax<0||tax>100)) errors.push("Tax must be between 0 and 100 percent");
      else if(tax!==""&&tax>0&&tax<1) warnings.push("Tax is below 1%; confirm this is the intended percentage");

      if(sku&&skuCounts.get(sku.toLowerCase())>1) errors.push("Duplicate Shopify SKU in this file");
      if(barcode&&barcodeCounts.get(barcode)>1) errors.push("Duplicate barcode in this file");

      if(barcode&&!/^\d+$/.test(barcode)) warnings.push("Barcode contains non-digits");
      if(barcode&&/^\d+$/.test(barcode)&&![8,12,13,14].includes(barcode.length)) warnings.push("Unusual GTIN length; check for lost leading zeros");
      if(row.cost==="") warnings.push("Cost is blank");

      if(catalog&&sku&&barcode&&catalog.byBarcode&&catalog.byBarcode.has(barcode)){
        const expected=catalog.byBarcode.get(barcode);
        if(String(expected).toLowerCase()!==sku.toLowerCase()) errors.push("SKU and barcode match different catalog variants");
      }

      return Object.assign({},row,{sku,barcode,errors,warnings,status:errors.length?"blocked":(warnings.length?"review":"ready")});
    });
  }

  function catalogIndexes(table){
    const map=autoMap(table.headers);
    const byBarcode=new Map(),bySku=new Map();
    for(const row of table.rows){
      const sku=map.sku>=0?cleanIdentity(row.values[map.sku]):"";
      const barcode=map.barcode>=0?cleanBarcode(row.values[map.barcode]):"";
      if(sku) bySku.set(sku.toLowerCase(),sku);
      if(barcode&&sku&&!byBarcode.has(barcode)) byBarcode.set(barcode,sku);
    }
    return {byBarcode,bySku,map};
  }

  function applyCatalog(rows,indexes){
    return rows.map(row=>{
      if(row.sku) return row;
      if(row.barcode&&indexes.byBarcode.has(row.barcode)) return Object.assign({},row,{sku:indexes.byBarcode.get(row.barcode)});
      return row;
    });
  }

  function shopifyRows(rows){
    return [
      ["SKU","Barcode","Supplier SKU","Quantity","Cost","Tax"],
      ...rows.map(r=>[r.sku,r.barcode,r.supplierSku,r.quantity,r.cost,r.tax])
    ];
  }

  return {FIELDS,SYNONYMS,cleanHeader,scoreHeader,detectHeaderRow,autoMap,numberValue,normalizeRows,validateRows,catalogIndexes,applyCatalog,shopifyRows};
});
