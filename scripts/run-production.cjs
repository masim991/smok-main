const { spawn } = require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const platform=process.argv[2] === 'web' ? 'web' : 'all';
const output=platform==='web'?'dist':'dist-verify';
const args=['export','--clear','--platform',platform,'--output-dir',output,'--max-workers','2'];
const child=spawn(process.execPath,[require.resolve('expo/bin/cli'),...args],{env:{...process.env,EXPO_PUBLIC_LOCAL_TEST_MODE:'false',EXPO_NO_TELEMETRY:'1'},stdio:'inherit'});
child.on('exit',code=>{
  if(code!==0){process.exitCode=code??1;return;}
  for (const target of platform === 'all' ? ['web','android','ios'] : ['web']) {
    const directory=path.join(output,'_expo/static/js',target);
    const bundles=fs.readdirSync(directory).filter(f=>/\.(js|hbc)$/.test(f));
    if(!bundles.length) throw new Error(`Production ${target} bundle missing.`);
    for(const file of bundles){const content=fs.readFileSync(path.join(directory,file));if(content.includes(Buffer.from('SMOK_LOCAL_TEST_ONLY')) || !content.includes(Buffer.from('SMOK_SERVER_BUILD'))) throw new Error(`Local test code was enabled in the ${target} production bundle.`);}
  }
  console.log('Production bundle verification: local test mode is disabled.');
});
