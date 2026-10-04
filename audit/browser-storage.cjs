// Runs storage against real IndexedDB in a disposable headless Edge profile.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root=path.join(__dirname,'..');
const browser='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'findash-storage-test-'));
const checks=`
(async()=>{
 const results=[];
 const check=(name,yes)=>{if(!yes)throw Error(name);results.push(name)};
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 await app.storage.load();
 check('Empty database has no fabricated transactions',app.data.transactions.length===0);
 app.data.transactions=[{id:1,amount:100,type:'Thu nhập',status:'paid',date:'2026-10-04',source:'VCB'}];
 app.data.wallets=[{id:2,walletName:'Test',initialCreditAvailable:700}];
 app.data.installmentPlans={p:{payments:[{paidAmount:100}]}};
 check('Snapshot saved',await app.storage.save());
 const saved=await idbReadAll();
 check('Wallet persisted',saved.fm_wallets[0].initialCreditAvailable===700);
 let rejected=false;
 try{await idbWriteAll({fm_transactions:[],fm_installments:()=>{}})}catch{rejected=true}
 check('Uncloneable write rejects',rejected);
 check('Abort rolls back ALL keys',equal(saved,await idbReadAll()));
 app.data.transactions[0].amount=200;const first=app.storage.save();
 app.data.transactions[0].amount=300;const second=app.storage.save();
 await Promise.all([first,second]);
 check('Latest queued snapshot wins',(await idbGet('fm_transactions'))[0].amount===300);
 app.data.wallets=[];await app.storage.load();
 check('Reload restores wallet',app.data.wallets.length===1);
 await app.storage.reset();
 check('Reset deletes database data',Object.values(await idbReadAll()).every(v=>v===undefined));
 localStorage.setItem('fm_configs',JSON.stringify({budgetLimit:555,apiKeys:{old:'secret'}}));
 await app.storage.load();
 check('Migration preserves settings',app.data.configs.budgetLimit===555);
 check('Migration commits before deleting source',localStorage.getItem('fm_configs')===null && (await idbGet('fm_configs')).budgetLimit===555);
 document.getElementById('result').textContent=JSON.stringify({status:'PASS',checks:results});
})().catch(error=>{document.getElementById('result').textContent=JSON.stringify({status:'FAIL',error:error.stack})});
`;
const page=`<!doctype html><meta charset="utf-8"><div id="result">RUNNING</div><script src="/js/1-data.js"></script><script src="/js/3-storage.js"></script><script>${checks}</script>`;
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(page)}
 if(['/js/1-data.js','/js/3-storage.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(fs.readFileSync(path.join(root,req.url)))}
 res.statusCode=404;res.end();
});
server.listen(0,'127.0.0.1',async()=>{
 let child, socket;
 const timeout=setTimeout(()=>{child?.kill();server.close();process.exit(1)},45000);
 try {
  child=spawn(browser,['--headless','--disable-gpu','--no-first-run','--disable-extensions','--remote-debugging-port=0',`--user-data-dir=${profile}`,`http://127.0.0.1:${server.address().port}/`],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');
  while(!fs.existsSync(portFile)) await new Promise(r=>setTimeout(r,100));
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  let target;
  while(!target){
   const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
   target=targets.find(t=>t.url.startsWith(`http://127.0.0.1:${server.address().port}`));
   if(!target)await new Promise(r=>setTimeout(r,100));
  }
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  const resultPromise=new Promise(resolve=>{socket.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id===1)resolve(msg)}});
  socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:`new Promise(resolve=>{const timer=setInterval(()=>{const text=document.getElementById('result')?.textContent;if(text && text!=='RUNNING'){clearInterval(timer);resolve(text)}},50)})`,awaitPromise:true,returnByValue:true}}));
  const response=await resultPromise;
  const result=response.result?.result?.value;
  if(!result?.includes('"status":"PASS"')) throw Error(result||JSON.stringify(response));
  console.log(result);fs.writeFileSync(path.join(__dirname,'browser-storage-results.json'),result);
  socket.send(JSON.stringify({id:2,method:'Browser.close'}));
 } catch(error){console.error(error);process.exitCode=1}
 finally{clearTimeout(timeout);socket?.close();child?.kill();server.close()}
});
