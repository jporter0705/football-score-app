const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function harness(){
  const state={memory:new Map(),revision:0,fetches:[],writes:[],onSet:null,onFetch:null};
  const clone=x=>x==null?x:structuredClone(x);
  function getStore(options){const name=typeof options==='string'?options:options.name,key=k=>name+'/'+k;
    return {get:async k=>clone(state.memory.get(key(k))?.data||null),getWithMetadata:async k=>clone(state.memory.get(key(k))||null),
      setJSON:async(k,data,condition)=>{state.writes.push(key(k));const hook=state.onSet&&await state.onSet(key(k),data,condition);if(hook)return hook;const old=state.memory.get(key(k));if(condition?.onlyIfNew&&old||condition?.onlyIfMatch&&condition.onlyIfMatch!==old?.etag)return{modified:false};const etag=String(++state.revision);state.memory.set(key(k),{data:clone(data),etag,metadata:clone(condition?.metadata)});return{modified:true,etag}},
      list:options=>{const all=[...state.memory.keys()].filter(k=>k.startsWith(name+'/'+(options.prefix||''))).sort().map(k=>({key:k.slice(name.length+1)}));const i=Number(options.cursor||0),blobs=all.slice(i,i+2),page={blobs,next_cursor:i+2<all.length?String(i+2):undefined};return options.paginate?{async *[Symbol.asyncIterator](){for(let n=0;n<all.length;n+=2)yield{blobs:all.slice(n,n+2)}}}:Promise.resolve(page)}};
  }
  const env={BET_ACCESS_TOKEN:'test-access',BET_IMPORT_TOKEN:'test-import'};
  const context=vm.createContext({console,Date,Map,Set,Number,String,Array,Object,JSON,Math,Promise,Buffer,Intl,Response,Request,URL,AbortSignal,process:{env},fetch:async(url,options)=>{state.fetches.push(String(url));if(state.onFetch)return state.onFetch(url,options);return{ok:true,json:async()=>({events:[]})}}});
  const cache=new Map();async function load(name){if(cache.has(name))return cache.get(name);let m;
    if(name==='@netlify/blobs')m=new vm.SyntheticModule(['getStore'],function(){this.setExport('getStore',getStore)},{context});
    else if(name==='node:crypto'){const crypto=require(name),keys=['createHmac','timingSafeEqual','randomUUID'];m=new vm.SyntheticModule(keys,function(){keys.forEach(k=>this.setExport(k,crypto[k]))},{context})}
    else m=new vm.SourceTextModule(fs.readFileSync(name,'utf8'),{context,identifier:name});cache.set(name,m);await m.link((s,p)=>load(s.startsWith('.')?path.resolve(path.dirname(p.identifier),s):s));return m;
  }
  async function moduleFor(name){const m=await load(path.resolve('netlify/functions/'+name+'.mjs'));if(m.status!=='evaluated')await m.evaluate();return m.namespace}
  const request=(route,method='GET',body,headers={})=>new Request('https://example.netlify.app/api/'+route,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
  return{state,env,moduleFor,request,getStore};
};
