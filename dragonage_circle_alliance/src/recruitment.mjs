export const recruitmentOptions=[{value:'open',label:'관계 모집 중'},{value:'specific',label:'특정 관계 모집'},{value:'closed',label:'모집 마감'}];
export function recruitment(character){const status=character?.extra?.recruitment_status;return recruitmentOptions.find(option=>option.value===status)||null;}
