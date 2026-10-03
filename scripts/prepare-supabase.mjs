import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const directory = 'supabase/functions/_shared';
mkdirSync(directory, { recursive: true });
for (const [source, target] of [['src/types/hotel.ts', 'hotel.ts'], ['src/types/access.ts', 'access.ts'], ['src/utils/permissions.ts', 'permissions.ts'], ['src/utils/authorizeHotelMutation.ts', 'authorizeHotelMutation.ts'], ['src/utils/hotelLogic.ts', 'hotelLogic.ts'], ['src/utils/hotelStorage.ts', 'hotelStorage.ts']]) {
  const content = readFileSync(source, 'utf8').replaceAll("'../types/hotel'", "'./hotel.ts'").replaceAll("'../types/access'", "'./access.ts'").replaceAll("'./hotelLogic'", "'./hotelLogic.ts'").replaceAll("'./hotelStorage'", "'./hotelStorage.ts'").replaceAll("'./permissions'", "'./permissions.ts'");
  writeFileSync(`${directory}/${target}`, content);
}
console.log('Supabase shared validation files prepared from application source.');
