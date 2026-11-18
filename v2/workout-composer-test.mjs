import assert from 'node:assert/strict';
import {parseWorkoutText,workoutCatalog,searchWorkoutCatalog} from './src/workout-composer.js';
const today='2024-03-14';
const parse=text=>parseWorkoutText(text,today);
let p=parse('Local: Academia de teste\nData: 12/03\nInício: 09h35\nDuração: 44 min\nSupino: 60 kg x 10, 70 kg x 8 até a falha\nRemada: 3 séries de 10 com 30 kg');
assert.deepEqual(p.metadata,{location:'Academia de teste',workout_date:'2024-03-12',start_clock:'09:35',duration_minutes:44});
assert.deepEqual(p.exercises.map(e=>[e.name,e.sets.length]),[['Supino',2],['Remada',3]]);
assert.equal(p.exercises[0].sets[1].failure,true);assert.equal(p.exercises[1].sets[2].weight,30);
p=parse('Hoje fiz 3 séries de 8 no supino reto com 25 kg');assert.equal(p.exercises[0].name,'supino reto');assert.equal(p.exercises[0].sets.length,3);assert.equal(p.exercises[0].sets[0].weight,25);
p=parse('Puxada 3x10 45kg');assert.equal(p.exercises[0].sets.length,3);assert.equal(p.exercises[0].sets[0].weight,45);
p=parse('Hoje fiz supino com 20 kg x 10 e remada 15 kg x 8');assert.deepEqual(p.exercises.map(e=>e.name),['supino','remada']);
p=parse('Puxada\n22,5 kg 8 reps\n25 lb x 6,5 reps sem falha');assert.equal(p.exercises[0].sets[0].weight,22.5);assert.equal(p.exercises[0].sets[1].weight_unit,'lb');assert.equal(p.exercises[0].sets[1].reps,6.5);assert.equal(p.exercises[0].sets[1].failure,null);
p=parse('Remada: 3x8');assert.equal(p.exercises[0].sets.length,3);assert.equal(p.exercises[0].sets[0].weight,'');
p=parse('Remada 42x8 / 44x6');assert.deepEqual(p.exercises[0].sets.map(s=>s.weight),[42,44]);
p=parse('Rosca: 40 kg x 4, pausa 15s + 1,5 rep até a falha');assert.deepEqual(p.exercises[0].sets.map(s=>s.phase),['working','rest_pause']);assert.equal(p.exercises[0].sets[1].reps,1.5);
p=parse('Remada: 20 kg x 8-12');assert.equal(p.exercises.length,0);assert.equal(p.unresolved.length,1);
p=parse('Remada na máquina\nNível 4 x 9 reps\nplaca 7 × 6\n3 séries de 8 no nível 5');
assert.equal(p.exercises[0].name,'Remada na máquina');
assert.deepEqual(p.exercises[0].sets.map(s=>[s.weight,s.weight_unit,s.reps]),[
  [4,'plate_index',9],[7,'plate_index',6],...[1,2,3].map(()=>[5,'plate_index',8])
]);
assert.deepEqual(p.unresolved,[]);
p=parse('Remada: 9 reps na placa 3');
assert.deepEqual([p.exercises[0].sets[0].weight,p.exercises[0].sets[0].weight_unit],[3,'plate_index']);
for(const expression of ['18 kg x 8–10 reps','18 kg 8 a 10 repetições','6 até 9 reps com 12 kg','3 séries de 6 a 9 com 12 kg','18–22 kg x 9 reps','nível 4–6 x 9 reps']){
  const original='Puxada: '+expression;
  p=parse(original);
  assert.deepEqual(p.exercises,[],original);
  assert.deepEqual(p.unresolved,[original]);
  assert.equal(p.raw,original);
}
p=parse('Remada: 18 kg x 8–10 reps, 25 kg x 6\n30 kg x 5 - 35 kg x 4');
assert.deepEqual(p.exercises.map(e=>e.name),['Remada']);
assert.deepEqual(p.exercises[0].sets.map(s=>[s.weight,s.reps]),[[25,6],[30,5],[35,4]]);
p=parse('Remada: 18 kg x 8–10 reps\n25 kg x 6 reps');
assert.deepEqual(p.exercises.map(e=>[e.name,e.sets.length]),[['Remada',1]]);
for(const note of ['sem chegar à falha','não fui até a falha','perto da falha','próxima da falha','falha não atingida']){
  const set=parse('Remada: 24 kg × 7 reps '+note).exercises[0].sets[0];
  assert.equal(set.failure,null,note);
  assert.equal(set.notes,note);
}
for(const note of ['até a falha','sem pausa até a falha','quase falha, mas depois cheguei à falha']){
  assert.equal(parse('Remada: 24 kg × 7 reps '+note).exercises[0].sets[0].failure,true,note);
}
p=parse('Treino leve sem detalhes');assert.equal(p.exercises.length,0);assert.equal(p.raw,'Treino leve sem detalhes');assert.deepEqual(p.unresolved,[p.raw]);
p=parse('18 kg x 8');assert.equal(p.exercises.length,0);assert.equal(p.unresolved[0],p.raw);
p=parse('Data: 31/02/2024\nDuração: indefinida');assert.equal(Object.keys(p.metadata).length,0);assert.equal(p.unresolved.length,2);
const catalog=workoutCatalog([{source_record_id:'A',workout_date:today,is_canonical:true},{source_record_id:'B',workout_date:today,is_canonical:false}],[{workout_source_record_id:'A',exercise:'Puxada neutra',machine:'Polia',muscle_group:'Costas'},{workout_source_record_id:'B',exercise:'Não pertinente'}]);
assert.equal(searchWorkoutCatalog(catalog,'puxada polia')[0].group,'Costas');assert.equal(searchWorkoutCatalog(catalog,'pertinente').length,0);
console.log('Workout entry: Portuguese sets, units, decimals, failure, rest-pause, multiple exercises, literal fallback and searchable owned catalog passed.');
