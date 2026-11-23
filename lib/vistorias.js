// Lista de trabalho da equipe. Cada local recebe um id estável mesmo se o endereço mudar.
export const previstos = [
  {id:'super-atacado-machado-supercenter', nome:'Super Atacado Machado Supercenter', cidade:'Sinop', rua:'R. Alberto Baranjak', numero:'505', bairro:'São Cristóvão', geo:{lat:-11.8930053, lon:-55.5048484}},
  {id:'ctr-clinica-tratamento-renal', nome:'CTR - Clínica de Tratamento Renal', cidade:'Sinop', rua:'Av. dos Flamboyants', numero:'2128', bairro:'', geo:{lat:-11.8705, lon:-55.50851}},
  {id:'hospital-santo-antonio', nome:'Hospital Santo Antônio', cidade:'Sinop', rua:'Av. dos Flamboyants', numero:'2145', bairro:'Jardim Paraíso', geo:{lat:-11.86859, lon:-55.51805}},
  {id:'clinica-tarumas', nome:'Clínica Tarumãs centro de especialistas', cidade:'Sinop', rua:'Av. dos Tarumãs', numero:'1040', bairro:'St. Res. Sul', geo:{lat:-11.8637, lon:-55.50619}},
  {id:'hospital-maternidade-jacarandas', nome:'Hospital e Maternidade Jacarandás', cidade:'Sinop', rua:'Av. dos Jacarandás', numero:'2900', bairro:'St. Industrial Sul', geo:{lat:-11.862879, lon:-55.499226}},
  {id:'vie-hotel', nome:'VIE Hotel', cidade:'Sinop', rua:'Av. Bruno Martini', numero:'2249', bairro:'Recanto Suíço', geo:{lat:-11.854966, lon:-55.540893}},
  {id:'assai-atacadista', nome:'Assaí Atacadista', cidade:'Sinop', rua:'Av. dos Jacarandás', numero:'4030', bairro:'Setor Industrial Norte', geo:{lat:-11.8527755, lon:-55.4963509}},
  {id:'ibis-sinop', nome:'ibis Sinop', cidade:'Sinop', rua:'Av. dos Jacarandás', numero:'4120', bairro:'St. Industrial Norte', geo:{lat:-11.8520199, lon:-55.4962195}},
  {id:'colegio-alef', nome:'Colégio Alef', cidade:'Sinop', rua:'R. dos Cajueiros', numero:'1855', bairro:'St. Comercial', geo:{lat:-11.84896, lon:-55.51039}},
];

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
