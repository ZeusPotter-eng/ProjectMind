import test from 'node:test'
import assert from 'node:assert/strict'
import {taskBlockReasons,preventsTaskUpdate} from '../src/utils/blockers.js'
import {dependencySatisfied} from '../src/utils/dependencies.js'
const a={id:'A',title:'A',status:'todo',progress:0},b={id:'B',title:'B',status:'todo',progress:0}
const edge={id:'edge',task_id:'B',depends_on_task_id:'A',dependency_type:'finish_to_start',enforcement:'strict',gate_on:'start'}
test('dependencia informativa solo avisa',()=>{
 const x=taskBlockReasons(b,[a,b],[{...edge,enforcement:'informational'}],[])
 assert.equal(x.blocked,false);assert.equal(x.warnings.length,1)
})
test('restricción de fin solo bloquea finalizar',()=>{
 const dep={...edge,gate_on:'finish'}
 assert.equal(taskBlockReasons(b,[a,b],[dep],[],{nextStatus:'in_progress'}).blocked,false)
 assert.equal(taskBlockReasons(b,[a,b],[dep],[],{nextStatus:'done',nextProgress:100}).blocked,true)
})
test('inicio a inicio se libera al arrancar predecesora',()=>{
 assert.equal(dependencySatisfied({...edge,dependency_type:'start_to_start'},a),false)
 assert.equal(dependencySatisfied({...edge,dependency_type:'start_to_start'},{...a,status:'in_progress'}),true)
})
test('impedimento informativo no frena progreso',()=>{
 const g=taskBlockReasons(b,[a,b],[],[{task_id:'B',status:'open',is_blocking:false}],{nextStatus:'in_progress'})
 assert.equal(g.blocked,false);assert.equal(g.advisory.length,1)
 assert.equal(preventsTaskUpdate(b,'in_progress',25,g),false)
})
