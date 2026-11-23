// Lista de trabalho da equipe. Cada local recebe um id estável mesmo se o endereço mudar.
export const previstos = [];

export function pontosDeVistoria(registros, lista = previstos) {
  const concluidos = new Set(registros.map(r => r.local_id).filter(Boolean));
  const porId = new Map(lista.map(local => [local.id, local]));
  const pontos = lista.filter(local => !concluidos.has(local.id))
    .map(local => ({...local, estado:'pendente'}));
  for (const registro of registros) {
    const local = porId.get(registro.local_id);
    pontos.push({...registro, geo:registro.geo || local?.geo || null, estado:'concluido'});
  }
  return pontos;
}
