const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const distRoot=path.join(root,"dist");
const baseManifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
const commonFiles=[
  "popup.html",
  "popup.js",
  "index.html",
  "styles.css",
  "app.js",
  "lib",
  "assets",
  "samples"
];

const targets={
  chrome(manifest){return manifest;},
  edge(manifest){return manifest;},
  opera(manifest){return manifest;},
  firefox(manifest){
    delete manifest.minimum_chrome_version;
    manifest.browser_specific_settings={
      gecko:{
        id:"procurasheet@procurasheet.onrender.com",
        data_collection_permissions:{
          required:["none"],
          optional:["authenticationInfo"]
        }
      }
    };
    return manifest;
  },
  safari(manifest){
    delete manifest.minimum_chrome_version;
    return manifest;
  }
};

function copyRuntime(targetDir){
  for(const item of commonFiles){
    const source=path.join(root,item);
    const destination=path.join(targetDir,item);
    fs.cpSync(source,destination,{recursive:true});
  }
}

fs.rmSync(distRoot,{recursive:true,force:true});
fs.mkdirSync(distRoot,{recursive:true});

for(const [browser,transform] of Object.entries(targets)){
  const targetDir=path.join(distRoot,browser);
  fs.mkdirSync(targetDir,{recursive:true});
  copyRuntime(targetDir);
  const manifest=transform(structuredClone(baseManifest));
  fs.writeFileSync(path.join(targetDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
}

console.log("Built ProcuraSheet "+baseManifest.version+" for "+Object.keys(targets).join(", "));
