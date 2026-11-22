import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const source=readFileSync(new URL('../skills/ozear-code-literacy/SKILL.md',import.meta.url),'utf8');
const destination=new URL('../lib/generated/literacy-guide.ts',import.meta.url);
mkdirSync(new URL('../lib/generated/',import.meta.url),{recursive:true});
writeFileSync(destination,'// Generated from skills/ozear-code-literacy/SKILL.md. Run npm run generate:guide after editing.\nconst literacyGuide = '+JSON.stringify(source)+';\nexport default literacyGuide;\n');
