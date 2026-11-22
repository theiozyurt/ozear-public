import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const args=process.argv.slice(2);
const id=args[args.indexOf('--database-id')+1];
if(!args.includes('--database-id')||!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
  console.error('Kullanım: npm run cloudflare:configure -- --database-id <Cloudflare D1 Database ID>');process.exit(1);
}
const config={name:'ozear-d1-gateway',main:'./gateway.ts',compatibility_date:'2026-05-15',vars:{OZEAR_OWNER_ID:'ozear-owner'},d1_databases:[{binding:'DB',database_name:'ozear-prod',database_id:id,migrations_dir:'../drizzle'}]};
const target=fileURLToPath(new URL('../cloudflare/wrangler.json',import.meta.url));
writeFileSync(target,JSON.stringify(config,null,2)+'\n');
console.log('Cloudflare yapılandırması oluşturuldu. Bu işlem veritabanını değiştirmez veya yayın yapmaz.');
