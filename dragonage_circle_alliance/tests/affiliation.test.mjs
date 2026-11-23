import test from 'node:test';import assert from 'node:assert/strict';
import {affiliationType,affiliationLabel,affiliationOptions} from '../src/affiliation.mjs';import {graphElements} from '../src/domain.mjs';
test('four affiliations preserve legacy character labels and filter independently of the compatibility faction',()=>{
 assert.deepEqual(affiliationOptions.map(option=>option.label),['마법사','성기사','성가회','안식자']);
 assert.equal(affiliationLabel({faction:'templar'}),'성기사');assert.equal(affiliationLabel({faction:'mage',extra:{affiliation:'기존 소속 메모'}}),'마법사');assert.equal(affiliationType(undefined),'');
 const characters=affiliationOptions.map(option=>({id:option.value,name:option.label,faction:option.value==='templar'?'templar':'mage',extra:{affiliation_type:option.value}}));
 for(const option of affiliationOptions){assert.equal(affiliationLabel(characters.find(character=>character.id===option.value)),option.label);assert.deepEqual(graphElements(characters,[],option.value).map(row=>row.data.id),[option.value]);}
});
