import assert from 'node:assert/strict';
import {laboratoryHistorySourcesAgree} from './real-auth-lab-original-checks.mjs';
const one='https://chatgpt.com/library?file_id=libfile_'+'0'.repeat(32)+'&account_id=personal';
const two='https://chatgpt.com/library?file_id=libfile_'+'1'.repeat(32)+'&account_id=personal';
const link=href=>({href,target:'_blank',rel:'noopener noreferrer',referrerPolicy:'no-referrer'});
const expected=[{date:'02/01/2020',laboratory:'Laboratório inventado A',url:one},{date:'03/01/2021',laboratory:'Laboratório inventado B',url:two},{date:'04/01/2022',laboratory:'Laboratório inventado A',url:null}];
const rows=expected.map(r=>({date:r.date,metadata:r.laboratory+' · contexto inventado',links:r.url?[link(r.url)]:[]}));
assert.equal(laboratoryHistorySourcesAgree(rows,expected),true,'one marker may legitimately have distinct original documents');
for(const mutate of [r=>r[0].links[0].href=two,r=>r[0].date=rows[1].date,r=>r[0].metadata=rows[1].metadata,r=>r[0].links=[],r=>r[0].links.push(link(one)),r=>r[2].links=[link(one)],r=>r[0].links[0].target='_self',r=>r[0].links[0].rel='opener',r=>r[0].links[0].referrerPolicy='unsafe-url']){
 const changed=structuredClone(rows);mutate(changed);assert.equal(laboratoryHistorySourcesAgree(changed,expected),false);
}
assert.equal(laboratoryHistorySourcesAgree(rows,[...expected,expected[0]]),false,'ambiguous source/date identity is held');
assert.equal(laboratoryHistorySourcesAgree([],expected),false);
assert.equal(laboratoryHistorySourcesAgree(rows,[]),false);
assert.equal(laboratoryHistorySourcesAgree([rows[1]],expected),true,'later history pages retain their own source identity');
console.log('Protected laboratory history: distinct originals, exact dates/provider binding, unlinked rows, source swaps, ambiguity and isolated access passed.');
