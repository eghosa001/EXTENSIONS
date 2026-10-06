(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.ProcuraSettings=Object.assign(root.ProcuraSettings||{},api);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const FIELD_KEYS=new Set(["sku","barcode","supplierSku","quantity","cost","tax"]);
  const BLOCKED_KEYS=new Set(["__proto__","prototype","constructor"]);
  const MAX_TEMPLATES=500;
  const MAX_SKU_ENTRIES=50000;

  function plainObject(value){
    return value&&typeof value==="object"&&!Array.isArray(value);
  }

  function safeString(value,max){
    const out=String(value==null?"":value).trim();
    if(out.length>max) throw new Error("Backup contains an overlong value.");
    return out;
  }

  function normalizeTemplate(template,counter){
    if(!plainObject(template)) throw new Error("Backup contains an invalid supplier template.");
    const mappingHeaders={};
    if(plainObject(template.mappingHeaders)){
      for(const key of Object.keys(template.mappingHeaders)){
        if(!FIELD_KEYS.has(key)||BLOCKED_KEYS.has(key)) continue;
        mappingHeaders[key]=safeString(template.mappingHeaders[key],160);
      }
    }
    const skuMap={};
    if(plainObject(template.skuMap)){
      for(const key of Object.keys(template.skuMap)){
        if(BLOCKED_KEYS.has(key)) continue;
        counter.count++;
        if(counter.count>MAX_SKU_ENTRIES) throw new Error("Backup contains too many SKU mappings.");
        const safeKey=safeString(key,256);
        const safeValue=safeString(template.skuMap[key],256);
        if(safeKey&&safeValue) skuMap[safeKey]=safeValue;
      }
    }
    const headerIndex=Number(template.headerIndex);
    const out={mappingHeaders,skuMap,headerIndex:Number.isInteger(headerIndex)&&headerIndex>=0&&headerIndex<=10000?headerIndex:0};
    const updatedAt=Number(template.updatedAt);
    if(Number.isFinite(updatedAt)&&updatedAt>=0) out.updatedAt=updatedAt;
    return out;
  }

  function validateTemplates(templates){
    if(!plainObject(templates)) throw new Error("Backup supplier templates are invalid.");
    const keys=Object.keys(templates).filter(key=>!BLOCKED_KEYS.has(key));
    if(keys.length>MAX_TEMPLATES) throw new Error("Backup contains too many supplier templates.");
    const result={};const counter={count:0};
    for(const rawKey of keys){
      const key=safeString(rawKey,120);
      if(!key) continue;
      result[key]=normalizeTemplate(templates[rawKey],counter);
    }
    return result;
  }

  function createBackup(templates,now){
    return {
      product:"ProcuraSheet",
      schemaVersion:1,
      createdAt:new Date(Number.isFinite(now)?now:Date.now()).toISOString(),
      templates:validateTemplates(templates||{})
    };
  }

  function validateBackup(payload){
    if(!plainObject(payload)||payload.product!=="ProcuraSheet") throw new Error("This is not a ProcuraSheet backup.");
    if(payload.schemaVersion!==1) throw new Error("Unsupported ProcuraSheet backup version.");
    return validateTemplates(payload.templates||{});
  }

  return {createBackup,validateBackup,validateTemplates};
});
