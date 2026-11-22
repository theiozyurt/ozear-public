import {randomBytes} from 'node:crypto';import {readFileSync,existsSync,writeFileSync,chmodSync} from 'node:fs';
const filename='.env.production.local';let content=existsSync(filename)?readFileSync(filename,'utf8'):'';
function add(key,value){if(!new RegExp(`^${key}=`, 'm').test(content))content+=`${content&&!content.endsWith('\n')?'\n':''}${key}=${value}\n`;}
add('OZEAR_AUTH_MODE','owner');add('OZEAR_OWNER_ID','ozear-owner');add('OZEAR_OWNER_NAME','"Ozear kullanıcısı"');
for(const key of ['OZEAR_LOGIN_TOKEN','OZEAR_SESSION_SECRET','OZEAR_MCP_CLAUDE_TOKEN','OZEAR_MCP_GEMINI_TOKEN'])add(key,randomBytes(32).toString('hex'));
if(existsSync('.env.local')){const local=readFileSync('.env.local','utf8');for(const key of ['D1_GATEWAY_URL','D1_GATEWAY_TOKEN']){const value=local.match(new RegExp(`^${key}=(.*)$`,'m'))?.[1];if(value)add(key,value);}}
writeFileSync(filename,content,{mode:0o600});chmodSync(filename,0o600);
console.log('Üretim ayarları .env.production.local içinde hazır. Mevcut anahtarlar korundu; değerler ekrana yazılmadı. Bu dosya Git tarafından dışlanır. D1 bağlantısını ve Vercel sunucu değişkenlerini doğrula.');
