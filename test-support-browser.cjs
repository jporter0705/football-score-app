const fs=require('node:fs'),vm=require('node:vm');
module.exports=function browserHarness(production=true){
  const elements={},storage=new Map(),requests=[];
  const node=()=>({style:{},parentElement:{},setAttribute(){},classList:{toggle(){}},textContent:'',innerHTML:''});
  const ctx={console,Date,Map,Set,Number,String,Array,Object,JSON,Math,Promise,AbortSignal,URLSearchParams,encodeURIComponent,setTimeout,location:{hostname:'example.netlify.app',search:''},navigator:{},window:{},setInterval(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{hidden:false,head:{appendChild(){}},createElement:node,addEventListener(){},getElementById:id=>elements[id]||(elements[id]=node()),querySelectorAll:()=>[],querySelector:()=>null}};
  vm.createContext(ctx);const html=fs.readFileSync(production?'dist/index.html':'index.html','utf8').replace('startHistory();setInterval','setInterval');
  for(const s of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){const src=s[1].match(/src="([^"]+)"/);vm.runInContext(src?fs.readFileSync((production?'dist/':'')+src[1].replace(/^\//,'').split('?')[0],'utf8'):s[2],ctx);}
  return{ctx,elements,storage,run:code=>vm.runInContext(code,ctx,{timeout:5000})};
};
