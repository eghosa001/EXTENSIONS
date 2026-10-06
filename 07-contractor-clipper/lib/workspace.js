(function(root,factory){
  const api=factory(root.ContractorClipperCore);
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.ContractorClipperWorkspace=Object.assign(root.ContractorClipperWorkspace||{},api);
})(typeof globalThis!=="undefined"?globalThis:this,function(core){
  function clean(value,max=240){return String(value||"").trim().slice(0,max);}
  function clamp(value,max=100000000){return Math.min(max,core.nonNegative(value));}
  function percent(value){return Math.min(100,core.nonNegative(value));}

  function normalizeLibraryItem(raw){
    const src=raw&&typeof raw==="object"?raw:{};
    const images=(Array.isArray(src.images)?src.images:[src.image]).map(core.safeHttpUrl).filter(Boolean).slice(0,12);
    return {
      id:clean(src.id,160)||core.makeId("library"),title:clean(src.title),sku:clean(src.sku,120),
      brand:clean(src.brand,120),model:clean(src.model,120),description:clean(src.description,1200),
      material:clean(src.material,160),finish:clean(src.finish,160),color:clean(src.color,120),
      dimensions:clean(src.dimensions,240),availability:clean(src.availability,120),upc:clean(src.upc,80),
      url:core.safeHttpUrl(src.url),supplier:clean(src.supplier,120),currency:core.currencyCode(src.currency,"USD"),
      cost:clamp(src.cost),images,image:images[0]||"",category:clean(src.category,120),room:clean(src.room,120),
      markup:clamp(src.markup,1000),supplierDiscount:percent(src.supplierDiscount),delivery:clamp(src.delivery),
      createdAt:Number(src.createdAt)||Date.now(),updatedAt:Number(src.updatedAt)||Date.now()
    };
  }

  function normalizeSupplierRule(raw){
    const src=raw&&typeof raw==="object"?raw:{};
    return {
      id:clean(src.id,160)||core.makeId("supplier"),name:clean(src.name,120),host:clean(src.host,255).toLowerCase(),
      defaultMarkup:clamp(src.defaultMarkup,1000),defaultDelivery:clamp(src.defaultDelivery),
      defaultDiscount:percent(src.defaultDiscount),defaultCategory:clean(src.defaultCategory,120),
      defaultRoom:clean(src.defaultRoom,120),lastUsedAt:Number(src.lastUsedAt)||Date.now()
    };
  }

  function applySupplierDefaults(item,rule){
    const out={...item};
    if(!rule)return out;
    if(!core.nonNegative(out.markup)&&core.nonNegative(rule.defaultMarkup)) out.markup=core.nonNegative(rule.defaultMarkup);
    if(!core.nonNegative(out.delivery)&&core.nonNegative(rule.defaultDelivery)) out.delivery=core.nonNegative(rule.defaultDelivery);
    if(!core.nonNegative(out.supplierDiscount)&&core.nonNegative(rule.defaultDiscount)) out.supplierDiscount=core.nonNegative(rule.defaultDiscount);
    if(!clean(out.category)&&clean(rule.defaultCategory)) out.category=clean(rule.defaultCategory,120);
    if(!clean(out.room)&&clean(rule.defaultRoom)) out.room=clean(rule.defaultRoom,120);
    return out;
  }

  function normalizeLaborRate(raw){
    const src=raw&&typeof raw==="object"?raw:{};
    return {id:clean(src.id,160)||core.makeId("labor"),name:clean(src.name,120),rate:clamp(src.rate),unit:clean(src.unit,40)||"hour",createdAt:Number(src.createdAt)||Date.now()};
  }

  function normalizeAssembly(raw){
    const src=raw&&typeof raw==="object"?raw:{};
    return {
      id:clean(src.id,160)||core.makeId("assembly"),name:clean(src.name,120),
      items:(Array.isArray(src.items)?src.items:[]).slice(0,500).map(item=>({...normalizeLibraryItem(item),id:core.makeId("assembly_item"),qty:Math.max(1,clamp(item.qty,100000))})),
      laborItems:(Array.isArray(src.laborItems)?src.laborItems:[]).slice(0,100).map(l=>({id:core.makeId("labor_item"),name:clean(l.name,120),hours:clamp(l.hours,100000),rate:clamp(l.rate)})),
      createdAt:Number(src.createdAt)||Date.now()
    };
  }

  function normalizeQuoteTemplate(raw){
    const src=raw&&typeof raw==="object"?raw:{};
    return {
      id:clean(src.id,160)||core.makeId("template"),name:clean(src.name,120),
      taxPercent:clamp(src.taxPercent,100),notes:clean(src.notes,4000),validityDays:Math.min(365,Math.max(1,Math.floor(Number(src.validityDays)||30))),
      createdAt:Number(src.createdAt)||Date.now()
    };
  }

  function laborTotal(project){
    const list=Array.isArray(project?.laborItems)?project.laborItems:[];
    if(!list.length)return core.nonNegative(project?.labor);
    return list.reduce((sum,item)=>sum+clamp(item.hours)*clamp(item.rate),0);
  }

  function effectiveCost(item){
    const cost=core.nonNegative(item?.cost);
    const discount=percent(item?.supplierDiscount);
    return cost*(1-discount/100);
  }

  function sellUnit(item){return effectiveCost(item)*(1+core.nonNegative(item?.markup)/100);}
  function productTotal(item){return sellUnit(item)*Math.max(1,core.nonNegative(item?.qty,1));}

  function quoteTotals(project){
    const items=Array.isArray(project?.items)?project.items:[];
    const products=items.reduce((sum,item)=>sum+productTotal(item),0);
    const delivery=items.reduce((sum,item)=>sum+core.nonNegative(item?.delivery),0);
    const labor=laborTotal(project);
    const discount=core.nonNegative(project?.discount);
    const subtotal=Math.max(0,products+delivery+labor-discount);
    const taxPercent=core.nonNegative(project?.taxPercent);
    const tax=subtotal*taxPercent/100;
    return {products,delivery,materials:products+delivery,labor,discount,subtotal,tax,total:subtotal+tax};
  }

  function normalizeOrderStatus(value){
    const status=String(value||"planned").toLowerCase();
    return ["planned","ordered","shipped","delivered","cancelled"].includes(status)?status:"planned";
  }

  function makeAcceptanceReceipt(project,decision,name,now=Date.now()){
    const choice=String(decision||"").toLowerCase();
    if(!["accepted","declined"].includes(choice))throw new Error("Invalid acceptance decision.");
    return {
      product:"Contractor Clipper",version:1,projectId:clean(project?.id,160),quoteNumber:clean(project?.quoteNumber,120),
      projectName:clean(project?.name,240),client:clean(project?.client,240),decision:choice,
      name:clean(name,240),timestamp:new Date(now).toISOString()
    };
  }

  function validAcceptanceReceipt(receipt,project){
    const r=receipt&&typeof receipt==="object"?receipt:{};
    return r.product==="Contractor Clipper"&&r.version===1&&clean(r.projectId,160)===clean(project?.id,160)&&
      ["accepted","declined"].includes(String(r.decision||"").toLowerCase())&&Boolean(Date.parse(r.timestamp));
  }

  return {clean,normalizeLibraryItem,normalizeSupplierRule,applySupplierDefaults,normalizeLaborRate,normalizeAssembly,normalizeQuoteTemplate,laborTotal,effectiveCost,sellUnit,productTotal,quoteTotals,normalizeOrderStatus,makeAcceptanceReceipt,validAcceptanceReceipt};
});
