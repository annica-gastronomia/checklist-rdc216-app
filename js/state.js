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
function normalize(data){const copy=clone(data||{});const savedItems=copy.items||[];copy.moduleNames=moduleNames;copy.observations=copy.observations||{};copy.module12=copy.module12||{status:null,responsibleName:''};copy.establishment=Object.assign({restaurantName:'',legalName:'',cnpj:'',phone1:'',phone2:'',whatsapp1:'',whatsapp2:'',responsibleName:'',email:'',address:'',notes:''},copy.establishment||{});copy.items=initialData.items.map(base=>{const item=savedItems.find(row=>row.id===base.id)||{};const status=item.status||null;const clearAux=status==='sim'||status==='nao-aplica';return {id:base.id,question:base.question,status:status,moduleName:moduleNames[String(base.id).split('-')[0]]||base.moduleName||'',observation:clearAux?'':(item.observation||copy.observations[base.id]||''),photos:clearAux?[]:(Array.isArray(item.photos)?item.photos:(item.photo?[item.photo]:[])),legalBase:base.legalBase||'',priority:base.priority||'',actionPlan:Object.assign({acaoCorretiva:'',prazo:'',responsavel:''},item.actionPlan||{}),actionHistory:Array.isArray(item.actionHistory)?item.actionHistory:[]};});copy.mbp=normalizeMbp(copy.mbp);copy.medicoes=normalizeMedicoes(copy.medicoes);return copy;}
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
function normalizeMbp(saved){saved=saved||{};const sections={};MBP_SECTIONS.forEach(s=>{const ss=(saved.sections&&saved.sections[s.id])||{};sections[s.id]={text:ss.text||'',auto:ss.auto===false?false:true};});const pops={};MBP_POPS.forEach(p=>{const sp=(saved.pops&&saved.pops[p.id])||{};pops[p.id]={procedimento:sp.procedimento||'',procedimentoAuto:sp.procedimentoAuto===false?false:true,frequencia:sp.frequencia||'',responsavel:sp.responsavel||'',registros:sp.registros||'',cartaz:sp.cartaz||''};});return {approvedBy:saved.approvedBy||'',approvedDate:saved.approvedDate||'',sections,pops};}
function storageKey(){return STORAGE_KEY_BASE+'-'+activeProfileId;}
function cloudUpdatedKey(){return CLOUD_UPDATED_KEY_BASE+'-'+activeProfileId;}
function blankState(name){const fresh=normalize(initialData);fresh.items.forEach(item=>{item.status=null;item.observation='';item.photos=[];});fresh.module12={status:null,responsibleName:''};fresh.establishment={restaurantName:name,legalName:'',cnpj:'',buffet:'',manipulaCarne:'',preparaSushi:'',servePratoCru:'',fazDelivery:'',phone1:'',phone2:'',whatsapp1:'',whatsapp2:'',responsibleName:'',email:'',address:'',notes:''};fresh.profileName=name;fresh.timestamp=new Date().toISOString();return fresh;}
function loadState(){try{const saved=localStorage.getItem(storageKey());if(saved)return normalize(JSON.parse(saved));}catch(err){console.warn('Falha ao carregar dados salvos',err);}return normalize(initialData);}
