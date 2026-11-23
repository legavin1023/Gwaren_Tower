export const affiliationOptions=[{value:'mage',label:'마법사'},{value:'templar',label:'성기사'},{value:'chantry',label:'성가회'},{value:'tranquil',label:'안식자'}];
export function affiliationType(character){if(!character)return '';const value=character?.extra?.affiliation_type;return affiliationOptions.some(option=>option.value===value)?value:character?.faction||'mage';}
export function affiliationLabel(character){return affiliationOptions.find(option=>option.value===affiliationType(character))?.label||'마법사';}
