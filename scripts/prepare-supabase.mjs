import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const directory = 'supabase/functions/_shared';
mkdirSync(directory, { recursive: true });
for (const [source, target] of [['src/types/hotel.ts', 'hotel.ts'], ['src/utils/hotelLogic.ts', 'hotelLogic.ts'], ['src/utils/hotelStorage.ts', 'hotelStorage.ts']]) {
  const content = readFileSync(source, 'utf8').replaceAll("'../types/hotel'", "'./hotel.ts'").replaceAll("'./hotelLogic'", "'./hotelLogic.ts'");
  writeFileSync(`${directory}/${target}`, content);
}
console.log('Supabase shared validation files prepared from application source.');
