'use strict';
// Estado central do app: dados brutos (initialData), normalização, storage keys e a variável `state` (extraído do index.html)
const STORAGE_KEY_BASE='checklist-rdc216-app-v2';
const PROFILE_KEY='checklist-rdc216-active-profile';
const CLOUD_UPDATED_KEY_BASE='checklist-rdc216-cloud-updated-at';
const DEFAULT_PROFILE_ID='checklist-rdc216-principal';
let activeProfileId=localStorage.getItem(PROFILE_KEY)||DEFAULT_PROFILE_ID;
const initialData=JSON.parse(document.getElementById('initial-data').textContent);
const statusLabels={sim:'Sim',nao:'Não',andamento:'Em andamento','nao-aplica':'Não se aplica'};
const moduleNames=initialData.moduleNames;
let state=loadState();
function normalize(data){const copy=clone(data||{});const savedItems=copy.items||[];copy.moduleNames=moduleNames;copy.observations=copy.observations||{};copy.module12=copy.module12||{status:null,responsibleName:''};copy.establishment=Object.assign({restaurantName:'',legalName:'',cnpj:'',phone1:'',phone2:'',whatsapp1:'',whatsapp2:'',responsibleName:'',email:'',address:'',notes:''},copy.establishment||{});copy.items=initialData.items.map(base=>{const item=savedItems.find(row=>row.id===base.id)||{};const status=item.status||null;const clearAux=status==='sim'||status==='nao-aplica';return {id:base.id,question:base.question,status:status,moduleName:moduleNames[String(base.id).split('-')[0]]||base.moduleName||'',observation:clearAux?'':(item.observation||copy.observations[base.id]||''),photos:clearAux?[]:(Array.isArray(item.photos)?item.photos:(item.photo?[item.photo]:[])),legalBase:base.legalBase||'',priority:base.priority||'',actionPlan:Object.assign({acaoCorretiva:'',prazo:'',responsavel:''},item.actionPlan||{}),actionHistory:Array.isArray(item.actionHistory)?item.actionHistory:[]};});copy.mbp=normalizeMbp(copy.mbp);copy.medicoes=normalizeMedicoes(copy.medicoes);copy.appcc=normalizeAppcc(copy.appcc);return copy;}
function normalizeAnulado(r){return {anulado:!!r.anulado,anuladoPor:r.anuladoPor||'',anuladoEm:r.anuladoEm||''};}
function normalizeMedicoes(saved){saved=saved||{};const eq=saved.equipamentos||{};const term=saved.termometros||{};const alim=saved.alimentos||{};const amostras=saved.amostras||{};return {
equipamentos:{
items:Array.isArray(eq.items)?eq.items.map(it=>({id:it.id||genId('equip'),nome:it.nome||'',categoria:it.categoria||'outro',min:(it.min===''||it.min==null)?null:Number(it.min),max:(it.max===''||it.max==null)?null:Number(it.max)})):[],
readings:Array.isArray(eq.readings)?eq.readings.map(r=>Object.assign({id:r.id||genId('leitura-equip'),itemId:r.itemId||'',valor:Number(r.valor),data:r.data||'',hora:r.hora||'',responsavel:r.responsavel||'',observacao:r.observacao||''},normalizeAnulado(r))):[]
},
termometros:{
items:Array.isArray(term.items)?term.items.map(it=>({id:it.id||genId('term'),nome:it.nome||'',tipo:it.tipo||'digital',finalidade:it.finalidade||''})):[],
readings:Array.isArray(term.readings)?term.readings.map(r=>Object.assign({id:r.id||genId('afericao'),itemId:r.itemId||'',metodo:r.metodo||'gelo',valorReferencia:r.valorReferencia==null?0:Number(r.valorReferencia),valorLido:Number(r.valorLido),tolerancia:r.tolerancia==null?1:Number(r.tolerancia),data:r.data||'',hora:r.hora||'',responsavel:r.responsavel||'',empresa:r.empresa||'',empresaCnpj:r.empresaCnpj||''},normalizeAnulado(r))):[]
},
alimentos:{
readings:Array.isArray(alim.readings)?alim.readings.map(r=>Object.assign({id:r.id||genId('alimento'),ponto:r.ponto||'recebimento',subtipo:r.subtipo||'',produto:r.produto||'',valor:r.valor==null?null:Number(r.valor),horaInicio:r.horaInicio||'',data:r.data||'',hora:r.hora||'',responsavel:r.responsavel||''},normalizeAnulado(r))):[]
},
amostras:{
readings:Array.isArray(amostras.readings)?amostras.readings.map(r=>Object.assign({id:r.id||genId('amostra'),preparacao:r.preparacao||'',data:r.data||'',hora:r.hora||'',responsavel:r.responsavel||''},normalizeAnulado(r))):[]
}
};}
const APPCC_FLOW_SHAPES=['start','process','decision','pcc','document','rawmaterial','end'];
const APPCC_SHAPE_LABELS={start:'Início',process:'Processo',decision:'Decisão',pcc:'PCC',document:'Documento',rawmaterial:'Matéria-prima',end:'Fim'};
const APPCC_HAZARD_TYPES=['Biológico','Químico','Físico','Alergênico'];
const APPCC_HAZARD_SUGGESTIONS={
'Biológico':{perigo:'Multiplicação ou sobrevivência de microrganismos patogênicos (bactérias, vírus, parasitas) por tempo/temperatura inadequados, contaminação cruzada ou manipulação incorreta. Ex.: em pescado cru ou mal cozido (sushi, sashimi, ceviche), risco de parasitas como Anisakis — controlado por congelamento conforme RIISPOA (Decreto 9.013/2017), art. 216 (-20°C por 7 dias ou -35°C por 15 horas).',controle:'Controle de tempo e temperatura (cocção, resfriamento, armazenamento), higienização de mãos/superfícies/utensílios, segregação entre crus e prontos, fornecedor aprovado com comprovação do tratamento exigido (ex.: certificado de congelamento antiparasitário do pescado).'},
'Químico':{perigo:'Contaminação por resíduos de produtos de limpeza/sanitizantes, agrotóxicos, aditivos não permitidos ou migração de materiais em contato com o alimento (embalagens, utensílios).',controle:'Armazenamento separado de produtos químicos, uso conforme rótulo/ficha técnica, enxágue adequado após higienização, matéria-prima com procedência controlada, embalagens próprias para uso alimentício.'},
'Físico':{perigo:'Presença de corpos estranhos no alimento (fragmentos de vidro, metal, plástico, madeira, ossos, cabelo, restos de embalagem).',controle:'Inspeção visual da matéria-prima e do produto final, manutenção preventiva de equipamentos e utensílios, uso de toucas e proteção adequada, triagem cuidadosa no recebimento.'},
'Alergênico':{perigo:'Contaminação cruzada com ingrediente alergênico não declarado (ex.: glúten, lactose, ovo, amendoim/castanhas, frutos do mar) ou informação incorreta/incompleta passada ao cliente.',controle:'Segregação de utensílios e área de preparo para pratos com alergênicos, rotulagem clara no cardápio, treinamento da equipe sobre os alergênicos usados na cozinha, confirmação direta com o cliente antes de servir quando houver dúvida.'}
};
const APPCC_ETAPA_HAZARD_OVERRIDES=[
{keywords:['recebiment'],tipoPerigo:'Biológico',perigo:'Recebimento de matéria-prima fora da temperatura, do prazo de validade ou das condições higiênico-sanitárias exigidas, permitindo a entrada de microrganismos patogênicos no estabelecimento.',controle:'Conferir temperatura, validade, integridade da embalagem e procedência do fornecedor no ato do recebimento, conforme a Portaria CVS 3/2026; recusar o lote se algum critério não for atendido.'},
{keywords:['armazen','estoc'],tipoPerigo:'Biológico',perigo:'Multiplicação de microrganismos por armazenamento fora da temperatura adequada, tempo de guarda excessivo ou contaminação cruzada com outros alimentos.',controle:'Controle de temperatura do equipamento de refrigeração/congelamento, identificação com data de validade, separação entre crus e prontos, organização por ordem de validade (PVPS).'},
{keywords:['cocção','cozin','assar','fritar','grelh','forno'],tipoPerigo:'Biológico',perigo:'Sobrevivência de microrganismos patogênicos por tempo/temperatura de cocção insuficientes.',controle:'Cocção até atingir a temperatura mínima exigida no centro geométrico do alimento (conforme Portaria CVS 3/2026), verificada com termômetro calibrado a cada lote.'},
{keywords:['resfri'],tipoPerigo:'Biológico',perigo:'Multiplicação de microrganismos durante o resfriamento lento do alimento após a cocção, na faixa de temperatura de risco.',controle:'Resfriar de 60°C a 10°C em no máximo 2 horas, depois manter sob refrigeração (menos de 5°C) ou congelamento (-18°C ou menos), conforme Portaria CVS 3/2026, art. 67.'},
{keywords:['prepar','tempero','manipul','montag'],tipoPerigo:'Biológico',perigo:'Contaminação cruzada durante o preparo por manipulação inadequada, utensílios não higienizados ou contato entre alimentos crus e prontos.',controle:'Higienização de mãos e utensílios entre etapas, segregação de utensílios/áreas para crus e prontos, boas práticas de manipulação.'},
{keywords:['transport','entrega','deliver','distribu'],tipoPerigo:'Biológico',perigo:'Multiplicação de microrganismos por tempo/temperatura inadequados durante o transporte ou a espera para entrega.',controle:'Uso de embalagem térmica adequada, controle do tempo de transporte, verificação de temperatura na chegada quando aplicável.'},
{keywords:['higien','lavagem','sanitiz'],tipoPerigo:'Biológico',perigo:'Contaminação biológica remanescente por higienização insuficiente de matérias-primas consumidas cruas.',controle:'Seleção, lavagem e desinfecção com produto regularizado, em concentração e tempo de contato adequados.'}
];
function appccNormalizeText(txt){return String(txt||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}
function appccResolveHazardSuggestion(tipoPerigo,etapaTexto){const norm=appccNormalizeText(etapaTexto);const override=APPCC_ETAPA_HAZARD_OVERRIDES.find(row=>row.tipoPerigo===tipoPerigo&&row.keywords.some(k=>norm.includes(k)));if(override)return {perigo:override.perigo,controle:override.controle};return APPCC_HAZARD_SUGGESTIONS[tipoPerigo]||null;}
const APPCC_PCC_HINT_KEYWORDS=['temperatura','°c','graus','cocção','coccao','congelamento','resfriamento','tempo mínimo','tempo minimo','tempo máximo','tempo maximo','ph','concentração','concentracao','cloro','validade'];
function appccSuggestPccHint(etapaTexto,perigo,limite){const norm=appccNormalizeText((etapaTexto||'')+' '+(perigo||'')+' '+(limite||''));const isPcc=APPCC_PCC_HINT_KEYWORDS.some(k=>norm.includes(k));return isPcc?'PCC':'PC';}
const APPCC_PCC_OPTIONS=['PC','PCC','Não se aplica'];
const APPCC_STATUS_OPTIONS=['Em análise','Controlado','Requer ação'];
// Modelos de etapas sugeridas por perfil do estabelecimento. Começa vazio de propósito —
// o conteúdo (quais etapas fazem sentido pra cada cenário) é escrito pelo usuário quando
// tiver tempo, não inventado aqui. Pra adicionar um modelo, inclua um objeto assim:
// {id:'sushi-basico', label:'Sushi/peixe cru', matches:est=>est.preparaSushi==='sim'||est.servePratoCru==='sim', etapas:['Recebimento do pescado','Congelamento antiparasitário','Preparo','Montagem','Exposição']}
const APPCC_FLOW_TEMPLATES=[];
function normalizeAppccFluxoItem(it){return {id:it.id||genId('etapa'),texto:it.texto||'',forma:APPCC_FLOW_SHAPES.includes(it.forma)?it.forma:'process'};}
function normalizeAppccAnalise(a){return {id:a.id||genId('analise'),etapaId:a.etapaId||'',tipoPerigo:APPCC_HAZARD_TYPES.includes(a.tipoPerigo)?a.tipoPerigo:'Biológico',perigo:a.perigo||'',controle:a.controle||'',pcc:APPCC_PCC_OPTIONS.includes(a.pcc)?a.pcc:'PC',limite:a.limite||'',monitoramento:a.monitoramento||'',frequencia:a.frequencia||'',responsavel:a.responsavel||'',status:APPCC_STATUS_OPTIONS.includes(a.status)?a.status:'Em análise',acaoCorretiva:a.acaoCorretiva||'',registro:a.registro||''};}
function normalizeAppccRamo(r){return {id:r.id||genId('ramo'),nome:r.nome||'',fluxo:Array.isArray(r.fluxo)?r.fluxo.map(normalizeAppccFluxoItem):[]};}
function normalizeAppccProcesso(p){let ramos;if(Array.isArray(p.ramos)){ramos=p.ramos.map(normalizeAppccRamo);if(!ramos.length)ramos=[{id:genId('ramo'),nome:'Principal',fluxo:[]}];}else if(Array.isArray(p.fluxo)){ramos=[{id:genId('ramo'),nome:'Principal',fluxo:p.fluxo.map(normalizeAppccFluxoItem)}];}else{ramos=[{id:genId('ramo'),nome:'Principal',fluxo:[]}];}return {id:p.id||genId('processo'),nome:p.nome||'',tipo:p.tipo||'restaurante',ramos:ramos,analises:Array.isArray(p.analises)?p.analises.map(normalizeAppccAnalise):[]};}
function normalizeAppcc(saved){saved=saved||{};return {processos:Array.isArray(saved.processos)?saved.processos.map(normalizeAppccProcesso):[]};}
function normalizeMbp(saved){saved=saved||{};const sections={};MBP_SECTIONS.forEach(s=>{const ss=(saved.sections&&saved.sections[s.id])||{};sections[s.id]={text:ss.text||'',auto:ss.auto===false?false:true};});const pops={};MBP_POPS.forEach(p=>{const sp=(saved.pops&&saved.pops[p.id])||{};pops[p.id]={procedimento:sp.procedimento||'',procedimentoAuto:sp.procedimentoAuto===false?false:true,frequencia:sp.frequencia||'',responsavel:sp.responsavel||'',registros:sp.registros||'',cartaz:sp.cartaz||''};});return {approvedBy:saved.approvedBy||'',approvedDate:saved.approvedDate||'',sections,pops};}
function storageKey(){return STORAGE_KEY_BASE+'-'+activeProfileId;}
function cloudUpdatedKey(){return CLOUD_UPDATED_KEY_BASE+'-'+activeProfileId;}
function blankState(name){const fresh=normalize(initialData);fresh.items.forEach(item=>{item.status=null;item.observation='';item.photos=[];});fresh.module12={status:null,responsibleName:''};fresh.establishment={restaurantName:name,legalName:'',cnpj:'',buffet:'',manipulaCarne:'',preparaSushi:'',servePratoCru:'',fazDelivery:'',phone1:'',phone2:'',whatsapp1:'',whatsapp2:'',responsibleName:'',email:'',address:'',notes:''};fresh.profileName=name;fresh.timestamp=new Date().toISOString();return fresh;}
function loadState(){try{const saved=localStorage.getItem(storageKey());if(saved)return normalize(JSON.parse(saved));}catch(err){console.warn('Falha ao carregar dados salvos',err);}return normalize(initialData);}
