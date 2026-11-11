// Interpretación conservadora del contrato de respuestas de ProjectMind.
// Nunca se muestran objetos ni estados de configuración como si fueran respuestas de la IA.
export function extractAssistantAnswer(response) {
  if (typeof response === 'string') return response.trim()
  if (!response || typeof response !== 'object') return ''
  for (const candidate of [response.answer, response.reply, response.response, response.message, response.content]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  const choice = response.choices?.[0]?.message?.content
  if (typeof choice === 'string' && choice.trim()) return choice.trim()
  return ''
}
