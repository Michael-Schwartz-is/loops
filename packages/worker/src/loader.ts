export function generateLoader(apiBase: string, projectId: string, version: number, scripts: string[]): string {
  const scriptsJson = JSON.stringify(scripts);
  return `(function(){
"use strict";
if(!window.location.hostname.endsWith(".webflow.io"))return;

var API="${apiBase}";
var PID="${projectId}";
var LOG_URL=API+"/logs/"+PID;
var EVT_URL=API+"/events/"+PID;
var buf=[];
var sv=${version};
var SCRIPTS=${scriptsJson};
var TAB=Math.random().toString(36).slice(2,10);

function addLog(e){e.timestamp=new Date().toISOString();e.scriptVersion=sv;e.sessionId=TAB;buf.push(e)}
function flush(){if(!buf.length)return;var b=buf.splice(0);var bl=new Blob([JSON.stringify(b)],{type:"text/plain"});if(navigator.sendBeacon){navigator.sendBeacon(LOG_URL,bl)}else{fetch(LOG_URL,{method:"POST",body:JSON.stringify(b),headers:{"Content-Type":"application/json"},keepalive:true}).catch(function(){})}}
setInterval(flush,2000);
window.addEventListener("beforeunload",flush);

var oc={log:console.log.bind(console),warn:console.warn.bind(console),error:console.error.bind(console),info:console.info.bind(console),debug:console.debug.bind(console)};
function ser(a){return Array.prototype.map.call(a,function(v){if(v===undefined)return"undefined";if(v===null)return null;if(typeof v==="object"){try{return JSON.parse(JSON.stringify(v))}catch(e){return String(v)}}return v})}
["log","warn","error","info","debug"].forEach(function(l){console[l]=function(){oc[l].apply(console,arguments);addLog({type:l==="info"||l==="debug"?"log":l,args:ser(arguments)})}});

window.addEventListener("error",function(e){addLog({type:"unhandled-error",message:e.message,stack:e.error?e.error.stack:null,args:[e.message],url:e.filename})});
window.addEventListener("unhandledrejection",function(e){var r=e.reason;addLog({type:"unhandled-rejection",message:r?(r.message||String(r)):"Unknown",stack:r?r.stack:null,args:[r?(r.message||String(r)):"Unknown"]})});

var of=window.fetch;
window.fetch=function(){var u=arguments[0];if(typeof u==="object"&&u.url)u=u.url;if(typeof u==="string"&&u.indexOf(API)===0)return of.apply(window,arguments);return of.apply(window,arguments).then(function(r){if(!r.ok)addLog({type:"network-error",message:"HTTP "+r.status,url:typeof u==="string"?u:String(u),args:["Fetch "+r.status+" "+(typeof u==="string"?u:"")]});return r}).catch(function(e){addLog({type:"network-error",message:e.message,url:typeof u==="string"?u:String(u),args:["Fetch error: "+e.message]});throw e})};

var es=new EventSource(EVT_URL);
es.addEventListener("reload",function(){flush();setTimeout(function(){window.location.reload()},100)});

document.addEventListener("DOMContentLoaded",function(){var h=document.documentElement.outerHTML;h=h.replace(/<script[\\s\\S]*?<\\/script>/gi,"");h=h.replace(/<style[\\s\\S]*?<\\/style>/gi,"");h=h.replace(/<svg[\\s\\S]*?<\\/svg>/gi,"");var entry=[{type:"page-html",args:[h],page:window.location.href,timestamp:new Date().toISOString(),scriptVersion:sv,sessionId:TAB}];fetch(LOG_URL,{method:"POST",body:JSON.stringify(entry),headers:{"Content-Type":"application/json"},keepalive:true}).catch(function(){})});

SCRIPTS.forEach(function(s){var el=document.createElement("script");el.src=API+"/s/"+PID+"/"+s+"?v="+sv;document.head.appendChild(el)});

oc.log("[Loops] Connected — project "+PID+" v"+sv+" ("+SCRIPTS.length+" script"+(SCRIPTS.length===1?"":"s")+")");
})();`;
}
