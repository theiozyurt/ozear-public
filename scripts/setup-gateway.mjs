import { checkGateway } from "./check-gateway.mjs";
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
if(!existsSync('cloudflare/wrangler.json'))throw new Error('Önce Database ID ile npm run cloudflare:configure çalıştır.');
if(!existsSync('node_modules/wrangler/bin/wrangler.js'))throw new Error('Önce npm run install:ci çalıştır.');
function run(args,{input,capture=false,ci=false}={}){
  const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js',...args],{
    cwd:root,input,encoding:'utf8',stdio:[input===undefined?'inherit':'pipe',capture?'pipe':'inherit','inherit'],
    env:{...process.env,WRANGLER_SEND_METRICS:'false',...(ci?{CI:'true'}:{})},
  });
  if(capture&&result.stdout)process.stdout.write(result.stdout);
  if(result.error)throw new Error('Wrangler başlatılamadı.');
  if(result.status!==0)throw new Error('Cloudflare adımı tamamlanamadı. Yukarıdaki hatayı düzeltip aynı komutu tekrar çalıştır. Yerel anahtar korunur.');
  return result.stdout??'';
}
function setLocalEnv(key,value){
  const file='.env.local';
  const previous=existsSync(file)?readFileSync(file,'utf8'):'';
  const line=`${key}=${value}`;
  const pattern=new RegExp(`^${key}=.*$`,'m');
  const next=pattern.test(previous)?previous.replace(pattern,line):previous+(previous.endsWith('\n')||!previous?'':'\n')+line+'\n';
  writeFileSync('.env.local.tmp',next,{mode:0o600});chmodSync('.env.local.tmp',0o600);renameSync('.env.local.tmp',file);
}
try{
  console.log('1/6 Cloudflare oturumu kontrol ediliyor.');
  const account=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','whoami'],{cwd:root,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  if(account.status!==0||/Not logged in|not authenticated/i.test(account.stdout+account.stderr))run(['login']);
  console.log('2/6 Öğretme rehberi paketleniyor.');
  const generated=spawnSync(process.execPath,['scripts/generate-guide.mjs'],{cwd:root,stdio:'inherit'});
  if(generated.status!==0)throw new Error('Rehber paketlenemedi.');
  const existing=existsSync('.env.local')?readFileSync('.env.local','utf8'):'';
  const match=existing.match(/^D1_GATEWAY_TOKEN=(.*)$/m);
  if(match&&!/^[a-f0-9]{64}$/.test(match[1].trim()))throw new Error('.env.local içindeki mevcut D1_GATEWAY_TOKEN beklenen biçimde değil; üzerine yazılmadı.');
  const token=match?match[1].trim():randomBytes(32).toString('hex');
  setLocalEnv('D1_GATEWAY_TOKEN',token);
  console.log('3/6 Sunucu anahtarı cihazında hazırlandı. Değeri ekrana yazılmayacak.');
  console.log('4/6 Veritabanı şema geçişleri uygulanıyor.');
  run(['d1','migrations','apply','DB','--remote','--config','cloudflare/wrangler.json'],{ci:true});
  console.log('5/6 Korumalı D1 bağlantısı yayımlanıyor. Anahtar kaydedilene kadar erişim kapalıdır.');
  const output=run(['deploy','--config','cloudflare/wrangler.json'],{capture:true,ci:true});
  console.log('6/6 Anahtar Cloudflare sırrı olarak kaydediliyor.');
  run(['secret','put','D1_GATEWAY_TOKEN','--config','cloudflare/wrangler.json'],{input:token+'\n',ci:true});
  const url=output.match(/https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev\b/i)?.[0];
  if(url){
    setLocalEnv('D1_GATEWAY_URL',url);
    await checkGateway(url,token);
    console.log('\nD1 bağlantısı doğrulandı. Paylaşabileceğin Worker adresi: '+url);
    console.log('Gizli anahtar .env.local dosyasında. Sohbete veya Git deposuna gönderme.');
  }else{
    console.log('Worker ve sır kaydedildi ancak workers.dev adresi otomatik alınamadı. Panelden adresini bul; gerekirse workers.dev erişimini etkinleştir.');
  }
  console.log('Web/Vercel yayını ve bağımsız giriş sistemi sonraki aşamadır.');
}catch(error){console.error('\n'+(error instanceof Error?error.message:'Kurulum tamamlanamadı.'));process.exitCode=1;}
