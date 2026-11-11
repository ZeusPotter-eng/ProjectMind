import test from 'node:test'
import assert from 'node:assert/strict'
import { extractAssistantAnswer } from '../src/utils/assistantResponses.js'

test('extrae respuesta del contrato ProjectMind', () => {
  assert.equal(extractAssistantAnswer({answer:' Hola '}),'Hola')
  assert.equal(extractAssistantAnswer({response:'Respuesta'}),'Respuesta')
  assert.equal(extractAssistantAnswer({reply:'OK'}),'OK')
})
test('admite respuesta estilo OpenAI sin mostrar objetos', () => {
  assert.equal(extractAssistantAnswer({choices:[{message:{content:'respuesta'}}]}),'respuesta')
  assert.equal(extractAssistantAnswer({configured:true, provider:'lmstudio'}),'')
  assert.equal(extractAssistantAnswer(null),'')
})
