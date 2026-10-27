import test from 'node:test';import assert from 'node:assert';import * as U from '../js/util.js';
test('csv escaping + BOM',()=>{assert.equal(U.csvCell('a,"b"\nc'),'"a,""b""\nc"');assert.ok(U.toCsv([['س']]).startsWith('\uFEFF'))});
test('subtree counts each node once',()=>{const a=[{id:'1'},{id:'2',parentId:'1'},{id:'3',parentId:'2'}];assert.deepEqual([...U.subtree(a,'1')].sort(),['1','2','3'])});
test('overlap',()=>{const es=[{id:'a',start:10,end:20}];assert.ok(U.overlaps(es,15,25));assert.ok(!U.overlaps(es,20,30));assert.ok(!U.overlaps(es,15,25,'a'))});
test('untracked uses union',()=>{assert.equal(U.untracked([{start:0,end:50},{start:25,end:75}],0,100,1e9),25)});
test('week range (Sat start)',()=>{const[a,b]=U.range('week',0,6,new Date(2026,9,27));assert.equal(new Date(a).getDay(),6);assert.equal(b-a,7*864e5)});
