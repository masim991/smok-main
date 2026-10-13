const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const mode=process.argv[2];
const cli=require.resolve('expo/bin/cli');
const env={...process.env,EXPO_PUBLIC_LOCAL_TEST_MODE:'true',EXPO_NO_TELEMETRY:'1'};
if(mode==='serve') {
  const http=require('node:http');const root=path.resolve('dist-local');
  if(!fs.existsSync(path.join(root,'index.html'))) throw new Error('먼저 npm run build:local을 실행해주세요.');
  http.createServer((req,res)=>{try{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const file=fs.existsSync(p)&&fs.statSync(p).isFile()?p:path.join(root,'index.html');const types={'.js':'application/javascript','.html':'text/html','.png':'image/png','.css':'text/css','.ico':'image/x-icon'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch{res.writeHead(500);res.end();}}).listen(8082,'127.0.0.1',()=>console.log('SMOK local test: http://127.0.0.1:8082'));
} else {
  const args=mode==='export'?['export','--clear','--platform','web','--output-dir','dist-local','--max-workers','2']:['start','--clear','--localhost'];
  const child=spawn(process.execPath,[cli,...args],{env,stdio:'inherit'});
  child.on('exit',code=>{process.exitCode=code??1;});
}
