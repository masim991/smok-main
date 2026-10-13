const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function handler({ user = { id: 'verified-user' }, authError = null, deleteError = null, configured = true } = {}) {
  let serve; const deleted = []; const checked = [];
  const mock = { createClient: () => ({ auth: { getUser: async token => { checked.push(token); return { data: { user }, error: authError }; }, admin: { deleteUser: async id => { deleted.push(id); return { error: deleteError }; } } } }) };
  const source = fs.readFileSync('supabase/functions/delete-user/index.ts','utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports: {}, require: () => mock, Request, Response, Deno: { serve: fn => { serve=fn; }, env: { get: () => configured ? 'configured' : undefined } } });
  return { serve, deleted, checked };
}
const request = (body = {}) => new Request('https://local.invalid/delete-user', { method:'POST',headers:{ Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify(body) });
test('rejects unauthenticated account deletion without touching admin API', async()=>{const h=handler();const r=await h.serve(new Request('https://local.invalid',{method:'POST'}));assert.equal(r.status,401);assert.deepEqual(h.deleted,[]);});
test('invalid JWT cannot choose a target user',async()=>{const h=handler({user:null,authError:{message:'invalid'}});const r=await h.serve(request({userId:'victim'}));assert.equal(r.status,401);assert.deepEqual(h.deleted,[]);});
test('deletes only the verified JWT owner and acknowledges success',async()=>{const h=handler();const r=await h.serve(request({userId:'victim'}));assert.equal(r.status,200);assert.deepEqual(h.deleted,['verified-user']);assert.deepEqual(h.checked,['test-token']);assert.deepEqual(await r.json(),{deleted:true});});
test('admin deletion error never reports deleted:true',async()=>{const h=handler({deleteError:{message:'DB failure'}});const r=await h.serve(request());assert.equal(r.status,500);assert.equal((await r.json()).deleted,undefined);});
test('missing server credentials fails closed',async()=>{const h=handler({configured:false});const r=await h.serve(request());assert.equal(r.status,503);assert.deepEqual(h.deleted,[]);});
test('read-only requests cannot delete accounts and CORS preflight is safe',async()=>{const h=handler();assert.equal((await h.serve(new Request('https://local.invalid'))).status,405);assert.equal((await h.serve(new Request('https://local.invalid',{method:'OPTIONS'}))).status,204);assert.deepEqual(h.deleted,[]);});
