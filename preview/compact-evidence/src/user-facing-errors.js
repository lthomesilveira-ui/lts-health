// Only application-authored validation messages may be shown verbatim. Network,
// database and SDK details remain in diagnostics, never in a toast or form.
const validationMessages=new Set([
  'Informe uma data de início válida, até hoje.',
  'Entre novamente para salvar suas metas.',
  'Metas não são salvas no modo de demonstração.',
  'Aguarde o carregamento das metas ou atualize a página antes de salvar.',
  'Esta data contém uma referência histórica ou documentada que deve ser preservada. Escolha outra data para suas metas; alterar a fonte exige uma revisão específica.',
  'Não foi possível conferir a referência atual desta data. Nenhuma meta foi salva; atualize e tente novamente.',
  'Não foi possível salvar. Suas metas anteriores continuam preservadas.',
  ...['Energia diária','Proteína diária','Carboidratos diários','Gorduras diárias','Fibra diária','Água diária'].map(label=>`${label}: informe um valor positivo válido ou deixe em branco.`)
]);
export function userFacingError(error,fallback='Não foi possível concluir agora. Tente novamente.'){
  const message=String(error?.message||'');
  return validationMessages.has(message)?message:fallback;
}
