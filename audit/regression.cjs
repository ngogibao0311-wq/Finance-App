// Integration tests run against the real HTML/forms in an isolated jsdom document.
// No real browser storage, Firebase, files uploaded by the user, or network calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const results = [];
async function test(name, fn) { await fn(); results.push(name); console.log('PASS', name); }
(async () => {
 const html = read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
 const dom = new JSDOM(html, { url:'http://findash.test/', runScripts:'outside-only', pretendToBeVisual:true });
 await new Promise(resolve => setImmediate(resolve));
 const w=dom.window, ctx=dom.getInternalVMContext();
 const documentListener=w.document.addEventListener.bind(w.document);
 w.document.addEventListener=(type,...args)=>{if(type!=='DOMContentLoaded')documentListener(type,...args)};
 const errors=[];
 w.alert=()=>{}; w.confirm=()=>true; w.fetch=()=>{throw Error('Network disabled in tests')};
 w.console={...console, error:(...args)=>errors.push(args)};
 const applicationScripts = [...read('index.html').matchAll(/<script src="(js\/[^"?]+)(?:\?[^" ]*)?"><\/script>/g)].map(match=>match[1]);
 assert.ok(!applicationScripts.includes('js/domain-rules.js'));
 for(const file of applicationScripts) vm.runInContext(read(file),ctx,{filename:file});
 const run=code=>vm.runInContext(code,ctx);
 const app=run('app');
 const renderAll = app.ui.renderAll;
 let stored={}, writes=0;
 ctx.testWrite=async values=>{stored={...stored, ...JSON.parse(JSON.stringify(values))};writes++};
 ctx.testRead=async()=>structuredClone(stored);
 run('idbWriteAll = values => testWrite(values); idbReadAll = () => testRead();');
 app.storage.ready=true;
 const messages=[];
 app.ui.popup.show=(message,type)=>messages.push({message,type});
 app.ui.popup.confirm=(message,yes)=>yes();
 app.ui.popup.selectBudgetFunding=async()=> 'real';
 app.ui.renderAll=()=>{}; app.ui.init=()=>{};
 const input=(id,value)=>{const el=w.document.getElementById(id);assert.ok(el,id);el.value=value;return el};
 let submit;
 const form=w.document.getElementById('form-tx');
 const originalAdd=form.addEventListener.bind(form);
 form.addEventListener=(type,fn,...args)=>{if(type==='submit')submit=fn;originalAdd(type,fn,...args)};
 app.events.setup();
 assert.equal(typeof submit,'function');
 const tx=(extra={})=>({id:Date.now(),type:'Chi tiêu',status:'paid',source:'VCB',amount:100000,date:'2026-10-04T12:00:00+07:00',place:'Test',tags:'',...extra});
 const fill=(t)=>{
  form.reset(); input('tx-id',t.id ?? '');input('tx-type',t.type); input('tx-status',t.status);
  input('tx-amount',String(t.amount+(t.isCashback?0:t.discountAmount||0)));
  input('tx-discount',t.discountAmount ? `${t.discountAmount}đ`:'');
  input('tx-source',t.source);input('tx-destination',t.destination||'');input('tx-place',t.place||'Test');
  input('tx-date','2026-10-04T12:00');input('tx-tags',t.tags||'');input('tx-brand','');
  w.document.getElementById('tx-is-cashback').checked=Boolean(t.isCashback);
 };
 const saveForm=()=>submit({preventDefault(){}});

 await test('HTML script order initializes rules without a separate rules request; real render and filter work',()=>{
  assert.equal(typeof app.rules.flow,'function');
  w.HTMLCanvasElement.prototype.getContext=()=>({});
  w.Chart=class {destroy(){} update(){}};
  app.data.filter.month='2026-10';app.data.transactions=[tx({type:'Thu nhập',amount:123456})];
  app.ui.renderAll=renderAll;
  try {
   app.ui.renderAll();
   assert.match(w.document.getElementById('tx-table-body').textContent,/Test/);
   app.ui.setFilter('2026-09');app.ui.setFilter('2026-10');
   assert.match(w.document.getElementById('tx-table-body').textContent,/Test/);
  } finally {app.ui.renderAll=()=>{}}
 });

 await test('Income, transfers, cancellations use one balance rule',()=>{
  app.data.transactions=[tx({type:'Thu nhập',amount:1000000}),tx({id:2,amount:100000}),tx({id:3,type:'Chuyển tiền',amount:200000,destination:'Cash'}),tx({id:4,status:'cancelled',amount:900000})];
  assert.equal(app.logic.calculateBankBalance({bankName:'VCB',initialBalance:0}),700000);
  assert.equal(app.ui.modals.cash.calculateBalance({name:'Cash',initialBalance:0}),200000);
  assert.equal(app.rules.direction(app.data.transactions[0],'VCB'),1);
 });
 await test('Opening date and Liobank interest are consistent',()=>{
  app.data.transactions=[tx({date:'2026-09-01',amount:100000}),tx({date:'2026-10-04T12:00:00+07:00',amount:20000})];
  assert.equal(app.logic.calculateBankBalance({bankName:'VCB',initialBalance:1000000,createdAt:'2026-10-01'}),980000);
  app.data.transactions=[tx({source:'Liobank',type:'Thu nhập',isInterest:true,amount:50000})];
  assert.equal(app.logic.calculateBankBalance({bankName:'Liobank',initialBalance:1000000}),1000000);
 });
 await test('Old debt-payment source is money received by creditor',()=>{
  app.data.transactions=[tx({source:'Ví Trả Sau MoMo',tags:'#thanh_toan_no',amount:100000})];
  assert.equal(app.rules.balance({name:'Tiền mặt',initialBalance:200000},'cash'),100000);
  assert.equal(app.rules.balance({walletName:'Ví Trả Sau MoMo',initialBalance:0},'wallet'),100000);
 });
 await test('Planned MoMo purchase creates no fee; pending creates exactly one',()=>{
  app.data.filter.month='2026-10';app.data.installmentPlans={};
  app.data.transactions=[tx({source:'Ví Trả Sau MoMo',status:'planned'})];
  app.logic.updateFees();assert.equal(app.data.transactions.length,1);
  app.data.transactions[0].status='pending';app.logic.updateFees();app.logic.updateFees();
  assert.equal(app.data.transactions.filter(t=>t.tags==='#phi_dich_vu').length,1);
 });
 await test('Lock age follows creation, not backdated transaction date',()=>{
  const now=Date.now();const t=tx({id:now, date:'2020-01-01'});
  assert.equal(app.rules.isLocked(t,now+1000),false);
  assert.equal(app.rules.isLocked(t,now+3*86400000),true);
  assert.equal(app.rules.isLocked({...t,tags:'#hoan_tien'},now+86400000),true);
  assert.equal(app.rules.isLocked({...t,status:'planned'},now+9*86400000),false);
 });
 await test('Editing actual form preserves exclusion and matching metadata',async()=>{
  const t=tx({type:'Thu nhập',excludeFromBudget:true,excludeFromDashboard:true,assignedToMonthlyLimit:88,note:'Keep this'});
  app.data.transactions=[t];app.data.accounts=[];app.data.configs.monthlyLimitIncomeLinks={};
  fill(t);input('tx-place','Updated');await saveForm();
  const saved=app.data.transactions.find(x=>x.id===t.id);
  assert.equal(saved.place,'Updated');assert.equal(saved.excludeFromBudget,true);
  assert.equal(saved.excludeFromDashboard,true);assert.equal(saved.assignedToMonthlyLimit,88);assert.equal(saved.note,'Keep this');
 });
 await test('Cashback form creates once, updates amount, cancels and removes together',async()=>{
  app.data.transactions=[];fill(tx({id:'',isCashback:true,discountAmount:20000}));await saveForm();
  let original=app.data.transactions.find(t=>t.isCashback);
  assert.ok(original);const originalId=original.id;
  assert.equal(app.data.transactions.length,2);
  fill(original);input('tx-place','Renamed');await saveForm();
  assert.equal(app.data.transactions.length,2);
  original=app.data.transactions.find(t=>t.id===originalId);fill(original);input('tx-discount','10000đ');await saveForm();
  let refund=app.data.transactions.find(t=>t.cashbackForId===originalId);
  assert.equal(refund.amount,10000);assert.equal(refund.destination,'VCB');
  app.ui.toggleCancel(originalId);assert.equal(app.data.transactions.find(t=>t.cashbackForId===originalId).status,'cancelled');
  app.rules.removeTransaction(originalId);assert.equal(app.data.transactions.length,0);
 });
 await test('Disabling cashback removes linked refund; ambiguous legacy refunds are not deleted',()=>{
  const original=tx({isCashback:true,discountAmount:10000});app.data.transactions=[original];
  app.rules.syncCashback(original);original.isCashback=false;app.rules.syncCashback(original);
  assert.equal(app.data.transactions.length,1);
  const old=tx({id:1,isCashback:true,discountAmount:10000});
  const refund=tx({type:'Thu nhập',source:'Ngân hàng VCB',amount:10000,tags:'#hoan_tien',place:'Tiền hoàn giao dịch abc'});
  app.data.transactions=[old,{...refund,id:2},{...refund,id:3}];
  assert.throws(()=>app.rules.checkCashbackEdit(old));assert.equal(app.data.transactions.length,3);
 });
 await test('Invalid discount and date do not mutate transactions',async()=>{
  app.data.transactions=[];fill(tx({id:''}));input('tx-discount','200000đ');await saveForm();assert.equal(app.data.transactions.length,0);
  input('tx-discount','');input('tx-date','');await saveForm();assert.equal(app.data.transactions.length,0);
 });
 await test('Loan form edit retains original repayment dates',async()=>{
  const start='2026-10-04T12:00:00+07:00';
  app.data.loans=[{id:999,lender:'Test',originalAmount:100000,status:'active',date:start,schedule:[{period:1,dueDate:app.rules.loanDueDate(start,1)}]}];
  const t=tx({loanId:999,type:'Thu nhập',source:'Tiền mặt',place:'Vay tiền từ Test',tags:'#di_vay',date:start});
  app.data.transactions=[t];fill(t);await saveForm();
  assert.equal(app.data.loans[0].schedule[0].dueDate,'7/12/2026');
 });
 await test('Double submit creates one transaction',async()=>{
  app.data.transactions=[];fill(tx({id:''}));
  await Promise.all([saveForm(),saveForm()]);assert.equal(app.data.transactions.length,1);
 });
 await test('Retry after failed form save updates same transaction',async()=>{
  app.data.transactions=[];fill(tx({id:''}));
  const write=ctx.testWrite;ctx.testWrite=async()=>{throw Error('Form quota test')};
  await saveForm();assert.equal(app.data.transactions.length,1);
  const id=app.data.transactions[0].id;assert.equal(w.document.getElementById('tx-id').value,String(id));
  ctx.testWrite=write;await saveForm();assert.equal(app.data.transactions.length,1);assert.equal(app.data.transactions[0].id,id);
 });
 await test('Wallet stores current credit, resets form and survives storage round trip',async()=>{
  app.data.transactions=[];app.data.wallets=[];
  input('wallet-name','Test wallet');input('wallet-owner','');input('wallet-init-balance','100000');
  input('wallet-credit-limit','10000000');input('wallet-limit-current','8500000');
  await app.ui.modals.wallets.saveNew();
  assert.equal(app.logic.calculateWalletBalance(app.data.wallets[0]),8600000);
  assert.equal(stored.fm_wallets[0].initialCreditAvailable,8500000);
  app.data.wallets=[];await app.storage.load();assert.equal(app.data.wallets.length,1);
  app.ui.modals.wallets.openAdd();assert.equal(w.document.getElementById('wallet-credit-limit').value,'');
  assert.equal(w.document.getElementById('wallet-limit-current').value,'');
 });
 await test('Migration preserves configuration, strips only API keys, retains existing IDB',async()=>{
  stored={fm_transactions:[]};w.localStorage.clear();
  w.localStorage.setItem('fm_configs',JSON.stringify({budgetLimit:5000000,apiKeys:{old:'secret'}}));
  await app.storage.load();assert.equal(stored.fm_configs.budgetLimit,5000000);assert.equal(stored.fm_configs.apiKeys,undefined);
  assert.equal(w.localStorage.getItem('fm_configs'),null);
 });
 await test('Queued saves capture snapshots in order and write every collection together',async()=>{
  const seen=[];ctx.testWrite=async values=>{seen.push(JSON.parse(JSON.stringify(values)));await new Promise(r=>setTimeout(r,5));stored={...stored,...values}};
  app.data.transactions=[tx({amount:1})];const a=app.storage.save();app.data.transactions[0].amount=2;const b=app.storage.save();
  assert.equal(await a,true);assert.equal(await b,true);
  assert.equal(seen[0].fm_transactions[0].amount,1);assert.equal(seen[1].fm_transactions[0].amount,2);
  assert.equal(Object.keys(seen[0]).length,9);
 });
 await test('Failed save reports failure and queue recovers without losing old stored snapshot',async()=>{
  const before=JSON.stringify(stored);ctx.testWrite=async()=>{throw Error('Quota test')};
  assert.equal(await app.storage.save(),false);assert.equal(JSON.stringify(stored),before);
  assert.match(w.document.getElementById('storage-error').textContent,/Quota test/);
  ctx.testWrite=async values=>{stored={...stored,...values}};
  assert.equal(await app.storage.save(),true);assert.equal(w.document.getElementById('storage-error'),null);
 });

 // Use in-memory workbook objects but execute the actual export/import handlers.
 let workbook;
 w.XLSX={ utils:{
  book_new:()=>({SheetNames:[],Sheets:{}}), json_to_sheet:rows=>({rows}),
  book_append_sheet:(book,sheet,name)=>{book.SheetNames.push(name);book.Sheets[name]=sheet},
  sheet_to_json:sheet=>sheet.rows
 },writeFile:book=>{workbook=book},read:()=>workbook};
 ctx.XLSX=w.XLSX;
 let fileReader;
 w.FileReader=class {constructor(){fileReader=this} readAsArrayBuffer(){}};
 const importBook=async book=>{workbook=book;const input={files:[{}],value:'fake.xlsx'};app.dataTools.importExcel(input);await fileReader.onload({target:{result:new ArrayBuffer(0)}})};
 await test('Excel backup includes electronic wallets in sheet and backup JSON',()=>{
  app.data.wallets=[{id:7,walletName:'Backup wallet',creditLimit:1000,initialCreditAvailable:700}];
  app.dataTools.exportExcel();assert.ok(workbook.SheetNames.includes('Vi_dien_tu'));
  assert.equal(workbook.Sheets.Vi_dien_tu.rows[0].initialCreditAvailable,700);
 });
 await test('Excel export-import round trip restores wallet and transaction amounts',async()=>{
  app.data.transactions=[tx({id:707,type:'Thu nhập',amount:777777,excludeFromBudget:true})];
  app.data.loans=[];app.data.installmentPlans={};app.data.createdStatements={};
  app.dataTools.exportExcel();const backup=workbook;
  app.data.wallets=[];app.data.transactions=[];
  await importBook(backup);
  assert.equal(app.data.wallets[0].initialCreditAvailable,700);
  assert.equal(app.data.transactions.find(t=>t.id===707).amount,777777);
  assert.equal(app.data.transactions.find(t=>t.id===707).excludeFromBudget,true);
 });
 await test('Partial Excel update preserves amount, date, status and flags',async()=>{
  const t=tx({id:101,status:'pending',amount:123456,excludeFromBudget:true});app.data.transactions=[t];
  await importBook({SheetNames:['Transactions'],Sheets:{Transactions:{rows:[{id:101,place:'Excel update',amount:'',date:'',status:''}]}}});
  const actual=app.data.transactions.find(t=>t.id===101);
  assert.equal(actual.place,'Excel update');assert.equal(actual.amount,123456);assert.equal(actual.date,t.date);assert.equal(actual.status,'pending');assert.equal(actual.excludeFromBudget,true);
 });
 await test('Invalid Excel row rolls back all changes',async()=>{
  const before=JSON.stringify(app.data.transactions);
  await importBook({SheetNames:['Transactions'],Sheets:{Transactions:{rows:[{id:101,place:'Should not persist'},{id:202,amount:-1,date:'bad-date'}]}}});
  assert.equal(JSON.stringify(app.data.transactions),before);assert.equal(app.storage.ready,true);
 });
 await test('Cloud payload includes wallets and excludes API keys',async()=>{
  let payload;w.firebaseCloud={save:async data=>{payload=data;return{email:'test'}}};
  app.data.configs.apiKeys={gemini:'secret'};await app.storage.saveToCloud();
  assert.equal(payload.wallets[0].walletName,'Backup wallet');assert.equal(payload.configs.apiKeys,undefined);
 });
 await test('Old cloud backup preserves wallets that were not part of old schema',async()=>{
  w.firebaseCloud={load:async()=>({transactions:[],configs:{},updatedAt:'2026-10-04T00:00:00Z'})};
  await app.storage.loadFromCloud();
  assert.equal(app.data.wallets[0].walletName,'Backup wallet');
  assert.equal(stored.fm_before_cloud_restore.fm_wallets[0].walletName,'Backup wallet');
 });
 await test('New empty cloud snapshot restores empty arrays omitted by Firebase',async()=>{
  w.firebaseCloud={load:async()=>({schemaVersion:3,configs:{guestMode:false},updatedAt:'2026-10-04T00:00:00Z'})};
  await app.storage.loadFromCloud();assert.equal(app.data.wallets.length,0);assert.equal(app.data.transactions.length,0);
 });
 await test('Failed cloud restore keeps in-memory data and persisted snapshot',async()=>{
  const beforeData=JSON.stringify(app.data),beforeStore=JSON.stringify(stored);
  ctx.testWrite=async()=>{throw Error('Restore abort test')};
  w.firebaseCloud={load:async()=>({transactions:[tx({amount:999})],configs:{},updatedAt:'2026-10-04T00:00:00Z'})};
  await app.storage.loadFromCloud();
  assert.equal(JSON.stringify(app.data),beforeData);assert.equal(JSON.stringify(stored),beforeStore);assert.equal(app.storage.ready,true);
 });
 dom.window.close();
 fs.writeFileSync(path.join(__dirname,'regression-results.json'),JSON.stringify({tests:results.length,passed:results},null,2));
 console.log(`\n${results.length} tests passed. No external services called.`);
})().catch(error=>{console.error(error);process.exit(1)});
