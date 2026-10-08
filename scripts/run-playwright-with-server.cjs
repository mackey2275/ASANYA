const {spawn}=require('child_process');
const path=require('path');
const http=require('http');

const root=path.resolve(__dirname,'..');
const runtime=process.env.CODEX_TEST_RUNTIME||'C:\\Users\\macke\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies';
const node=path.join(runtime,'node','bin','node.exe');
const localCli=path.join(root,'node_modules','playwright','cli.js');
const cli=require('fs').existsSync(localCli)?localCli:path.join(runtime,'node','node_modules','playwright','cli.js');
const server=spawn(node,[path.join(root,'scripts','static-server.cjs')],{cwd:root,stdio:'ignore'});
const waitReady=()=>new Promise((resolve,reject)=>{let tries=0;const check=()=>http.get('http://127.0.0.1:4173/asana_style_task_manager_v200_dev.html',res=>{res.resume();resolve()}).on('error',()=>{if(++tries>=50)reject(new Error('Local test server did not start'));else setTimeout(check,100)});check()});
(async()=>{try{await waitReady();const child=spawn(node,[cli,'test',...process.argv.slice(2)],{cwd:root,stdio:'inherit',env:process.env});const code=await new Promise(resolve=>child.on('exit',value=>resolve(value??1)));process.exitCode=code}catch(error){console.error(error.message);process.exitCode=1}finally{server.kill()}})();
