/**
 * 3D AR CONDICIONADO - SISTEMA DE CHECKLIST DE QUADROS ELÉTRICOS
 * Aplicação inspirada no design Asana com suporte a Firebase Firestore,
 * histórico sequencial, menu lateral direito, exportação PDF e Excel,
 * assinatura digital, lista de obras salvas com autocomplete e lógica
 * invertida inteligente para itens de componentes danificados.
 */

// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyA_XT5HC8hOHfKYaLsV9KWgF3yOrE-g-0Q",
  authDomain: "checklist-9f191.firebaseapp.com",
  projectId: "checklist-9f191",
  storageBucket: "checklist-9f191.firebasestorage.app",
  messagingSenderId: "380213664355",
  appId: "1:380213664355:web:0499f97afb32524970b656",
  measurementId: "G-5C7PCH70MK"
};

let db = null;
let isFirebaseOnline = false;

try {
  if (typeof firebase !== 'undefined') {
    const app = firebase.initializeApp(firebaseConfig);
    if (firebase.analytics) {
      try { firebase.analytics(); } catch (e) { }
    }
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      console.warn("Firestore offline persistence fallback:", err.code);
    });
    isFirebaseOnline = true;
  }
} catch (error) {
  console.warn("Aviso Firebase:", error);
  isFirebaseOnline = false;
}

// ==========================================
// 2. DEFINIÇÃO DAS SESSÕES E ITENS DO CHECKLIST
// ==========================================
const CHECKLIST_SECTIONS = [
  {
    id: "tampa",
    title: "Tampa",
    icon: "fa-door-closed",
    description: "Verificação da estrutura externa, fixação, identificação e integridade da tampa do painel.",
    items: [
      "Identificação do Quadro Elétrico?",
      "Identificação das Lampadas?",
      "Identificação das Seccionadoras?",
      "Componentes Presos Corretamente?",
      "Danificação na Tampa?",
      "Fechaduras Em Bom Estado?",
      "IHM Danificada?",
      "Tampa Aterrada?",
      "Venezianas Instaladas Corretamente?",
      "Ventilador e Exaustor Instaladas Corretamente?",
      "Venezianas Danificadas?",
      "Ventilador e Exaustor Danificados?"
    ]
  },
  {
    id: "interna",
    title: "Conferência Interna",
    icon: "fa-microchip",
    description: "Inspeção dos componentes elétricos, disjuntores, bornes, relés e barramentos.",
    items: [
      "Miolo Interno Danificado?",
      "Canaletas Danificadas?",
      "Tampas de Canaletas Danificadas?",
      "Tampas de Canaletas Completas?",
      "Projeto Elétrico Presente no Quadro?",
      "Disjuntores Danificados?",
      "Contatoras Danificadas?",
      "Inversores Danificados?",
      "Conversores de Potência Danificados?",
      "Relés Danificados?",
      "Bornes Danificados?",
      "Fontes Danificadas?",
      "Componentes Identificados?",
      "Identificador de Borne Faltando?",
      "Painél Esta Aterrado?",
      "Reaperto e Fixação Conferidos?",
      "Iluminação Interna Danificada?"
    ]
  },
  {
    id: "cabeamento",
    title: "Cabeamento",
    icon: "fa-network-wired",
    description: "Avaliação do roteamento dos condutores, isolamento, identificação e aperto dos terminais.",
    items: [
      "Reaperto dos Cabos Conferidos?",
      "Cabo de Potêcia Identificados?",
      "Cabo de Comando Identificados?",
      "Cabo de Rede Identificado?",
      "Cabos Danificados?",
      "Cabo Sem Isolamento?",
      "Cabo Com Cores Fora do Padrão?",
      "Terminais Faltando?"
    ]
  }
];

const EQUIPE_RESPONSAVEIS = [
  "Gustavo Henrique",
  "Luis Henrique",
  "Pedro Miguel",
  "Henri Rodrigues",
  "Reinaldo Ferreira",
  "Victor Hugo"
];

// ==========================================
// 3. ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
const AppState = {
  reports: [],
  obras: [],
  currentReport: null,
  isEditing: false,
  signaturePad: null,
  currentView: 'dashboard',
  searchQuery: '',
  sidebarOpen: true
};

// ==========================================
// 4. STORAGE & SINCRONIZAÇÃO
// ==========================================
const LOCAL_STORAGE_REPORTS_KEY = '3dar_quadros_checklist_relatorios';
const LOCAL_STORAGE_OBRAS_KEY = '3dar_quadros_obras_salvas';

function loadLocalReports() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao carregar dados locais:", e);
    return [];
  }
}

function saveLocalReports(reports) {
  try {
    localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error("Erro ao salvar relatórios localmente:", e);
  }
}

function loadLocalObras() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OBRAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalObras(obras) {
  try {
    localStorage.setItem(LOCAL_STORAGE_OBRAS_KEY, JSON.stringify(obras));
  } catch (e) {
    console.error("Erro ao salvar obras localmente:", e);
  }
}

async function initDataSync() {
  updateSyncBadge(isFirebaseOnline ? 'connecting' : 'local');
  AppState.reports = loadLocalReports();
  AppState.obras = loadLocalObras();
  refreshObrasList();
  renderAllViews();

  if (db) {
    try {
      // Listener em tempo real para os relatórios
      db.collection("relatorios_quadros")
        .orderBy("numero", "desc")
        .onSnapshot((snapshot) => {
          const cloudReports = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            cloudReports.push({ ...data, id: doc.id });
          });

          if (cloudReports.length > 0) {
            AppState.reports = cloudReports;
            saveLocalReports(cloudReports);
          } else if (AppState.reports.length > 0) {
            AppState.reports.forEach(r => {
              db.collection("relatorios_quadros").doc(r.id).set(r).catch(console.warn);
            });
          }
          refreshObrasList();
          updateSyncBadge('online');
          renderAllViews();
        }, (err) => {
          console.warn("Erro no listener Firestore relatórios:", err);
          updateSyncBadge('local');
        });

      // Listener em tempo real para as obras cadastradas
      db.collection("obras_cadastradas")
        .onSnapshot((snapshot) => {
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.nome && !AppState.obras.includes(data.nome)) {
              AppState.obras.push(data.nome);
            }
          });
          refreshObrasList();
        }, (err) => {
          console.warn("Erro no listener Firestore obras:", err);
        });

    } catch (e) {
      console.warn("Erro ao conectar Firestore:", e);
      updateSyncBadge('local');
    }
  } else {
    updateSyncBadge('local');
  }
}

function updateSyncBadge(status) {
  const badge = document.getElementById('sync-status-badge');
  if (!badge) return;

  if (status === 'online') {
    badge.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200';
    badge.innerHTML = '<span class="w-2 h-2 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Firebase Conectado';
  } else if (status === 'connecting') {
    badge.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200';
    badge.innerHTML = '<span class="w-2 h-2 mr-1.5 rounded-full bg-blue-500 animate-spin"></span> Conectando Nuvem...';
  } else {
    badge.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200';
    badge.innerHTML = '<span class="w-2 h-2 mr-1.5 rounded-full bg-amber-500"></span> Modo Local Ativo';
  }
}

// ==========================================
// 5. GESTÃO DE OBRAS SALVAS (AUTOCOMPLETE & TAGS)
// ==========================================
function refreshObrasList() {
  const set = new Set(AppState.obras);
  // Coletar obras de todos os relatórios
  AppState.reports.forEach(r => {
    if (r.obra && r.obra.trim()) {
      set.add(r.obra.trim());
    }
  });

  AppState.obras = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  saveLocalObras(AppState.obras);
  renderObrasDatalist();
}

function renderObrasDatalist() {
  const datalist = document.getElementById('lista-obras');
  const container = document.getElementById('obras-sugestoes-container');

  if (datalist) {
    datalist.innerHTML = AppState.obras.map(o => `<option value="${escapeHtml(o)}">`).join('');
  }

  if (container) {
    if (AppState.obras.length === 0) {
      container.innerHTML = '<span class="text-[11px] text-slate-400 italic">Nenhuma obra salva ainda. Digite o nome acima para cadastrar.</span>';
    } else {
      container.innerHTML = `
        <span class="text-[10px] text-slate-400 font-semibold uppercase mr-1">Obras Salvas:</span>
        ${AppState.obras.slice(0, 10).map(o => `
          <button type="button" onclick="selecionarObra('${escapeHtml(o)}')" 
            class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-[#007dc5] border border-slate-200 hover:border-sky-300 transition-colors shadow-2xs">
            <i class="fas fa-building text-[9px] mr-1 text-slate-400"></i> ${escapeHtml(o)}
          </button>
        `).join('')}
      `;
    }
  }
}

window.selecionarObra = function(nome) {
  const input = document.getElementById('form-report-obra');
  if (input) {
    input.value = nome;
    input.focus();
  }
};

async function registrarNovaObra(nomeObra) {
  if (!nomeObra || !nomeObra.trim()) return;
  const limpo = nomeObra.trim();
  if (!AppState.obras.includes(limpo)) {
    AppState.obras.push(limpo);
    saveLocalObras(AppState.obras);
    refreshObrasList();

    if (db) {
      try {
        const docId = limpo.toLowerCase().replace(/[^a-z0-9]/g, '_');
        await db.collection("obras_cadastradas").doc(docId).set({
          nome: limpo,
          criadoEm: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Erro ao salvar obra no Firestore:", e);
      }
    }
  }
}

// ==========================================
// 6. LÓGICA DE ITENS "DANIFICADOS" (INVERTIDA)
// ==========================================
/**
 * Detecta se a pergunta é sobre componente danificado ou defeito.
 * Para estes itens:
 *   - SIM = "Sim, está danificado" -> NÃO CONFORME (abre campo para detalhar o dano)
 *   - NÃO = "Não está danificado" -> CONFORME (sem apontamentos / OK)
 */
function isItemDanificado(itemText) {
  return /danific/i.test(itemText);
}

/**
 * Retorna se o item está em conformidade com base no texto e na resposta.
 * Retorna true (conforme), false (não conforme) ou null (não preenchido).
 */
function isItemConforme(itemText, status) {
  if (!status) return null;
  const ehDanificado = isItemDanificado(itemText);
  if (ehDanificado) {
    return status === 'nao'; // NÃO está danificado => CONFORME!
  } else {
    return status === 'sim'; // SIM está identificado/correto => CONFORME!
  }
}

// ==========================================
// 7. CÁLCULO DE NÚMERO SEQUENCIAL PROGRESSIVO
// ==========================================
function getNextReportNumber() {
  if (!AppState.reports || AppState.reports.length === 0) return 1;
  const numbers = AppState.reports.map(r => Number(r.numero) || 0);
  const max = Math.max(...numbers, 0);
  return max + 1;
}

// ==========================================
// 8. RENDERIZAÇÃO DO FORMULÁRIO DE CHECKLIST
// ==========================================
function renderChecklistForm(existingData = null) {
  const container = document.getElementById('checklist-sections-container');
  if (!container) return;

  container.innerHTML = '';

  CHECKLIST_SECTIONS.forEach((section, sIdx) => {
    const sectionCard = document.createElement('div');
    sectionCard.className = 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6';
    
    // Header da sessão com botão inteligente "Marcar Conforme"
    sectionCard.innerHTML = `
      <div class="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-lg bg-sky-100 text-[#007dc5] flex items-center justify-center font-bold">
            <i class="fas ${section.icon}"></i>
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-800">${section.title}</h3>
            <p class="text-xs text-slate-500">${section.description}</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button type="button" onclick="marcarTudoConforme('${section.id}')" 
            class="text-xs text-slate-700 hover:text-emerald-700 font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all flex items-center shadow-xs" 
            title="Marca automaticamente todos os itens desta seção em conformidade">
            <i class="fas fa-check-double text-emerald-600 mr-1.5"></i> Marcar Seção Conforme
          </button>
        </div>
      </div>
      <div class="p-6 divide-y divide-slate-100" id="section-items-${section.id}">
      </div>
    `;

    container.appendChild(sectionCard);

    const itemsContainer = sectionCard.querySelector(`#section-items-${section.id}`);

    section.items.forEach((itemText, iIdx) => {
      const fieldKey = `${section.id}_item_${iIdx}`;
      const savedItem = existingData && existingData.items ? existingData.items[fieldKey] : null;
      const statusValue = savedItem ? savedItem.status : null; // 'sim', 'nao', ou null
      const motivoValue = savedItem ? savedItem.motivo || '' : '';
      
      const ehDanificado = isItemDanificado(itemText);
      const conforme = isItemConforme(itemText, statusValue);

      // Determinar classes visuais com base na conformidade
      let rowClass = 'hover:bg-slate-50/70';
      let motivoVisivel = false;

      if (conforme === true) {
        rowClass = 'item-sim-ativo';
      } else if (conforme === false) {
        rowClass = 'item-nao-ativo';
        motivoVisivel = true;
      }

      // Configuração dos botões baseada na lógica invertida ou padrão
      let simCheckedClass = 'peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600';
      let simLabel = '<i class="fas fa-check text-[10px] mr-1"></i> SIM';
      
      let naoCheckedClass = 'peer-checked:bg-rose-600 peer-checked:text-white peer-checked:border-rose-600';
      let naoLabel = '<i class="fas fa-times text-[10px] mr-1"></i> NÃO';

      let labelMotivo = 'Descreva o não cumprimento / motivo da não conformidade:';
      let placeholderMotivo = 'Especifique detalhadamente a divergência ou ação necessária...';

      if (ehDanificado) {
        // Lógica invertida: SIM significa danificado (defeito) e NÃO significa sem danos (conforme)
        simCheckedClass = 'peer-checked:bg-rose-600 peer-checked:text-white peer-checked:border-rose-600';
        simLabel = '<i class="fas fa-exclamation-triangle text-[10px] mr-1"></i> SIM (Danificado)';
        
        naoCheckedClass = 'peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600';
        naoLabel = '<i class="fas fa-check text-[10px] mr-1"></i> NÃO (Sem Danos)';

        labelMotivo = 'Descreva o que foi danificado / especifique a avaria:';
        placeholderMotivo = 'Descreva o que foi danificado e o estado do componente...';
      }

      const itemRow = document.createElement('div');
      itemRow.className = `py-3.5 px-3 rounded-lg transition-all duration-150 mb-1 border border-transparent ${rowClass}`;
      itemRow.id = `row-${fieldKey}`;

      itemRow.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-start space-x-2.5">
            <span class="text-xs font-semibold text-slate-400 mt-0.5">${iIdx + 1}.</span>
            <div>
              <label class="text-sm font-medium text-slate-800 cursor-pointer select-none leading-relaxed" for="${fieldKey}-sim">
                ${itemText}
              </label>
              ${ehDanificado ? 
                '<span class="inline-block ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">Verificação de Avaria</span>' : ''}
            </div>
          </div>
          <div class="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            <!-- Opção SIM -->
            <label class="inline-flex items-center cursor-pointer select-none">
              <input type="radio" name="${fieldKey}" id="${fieldKey}-sim" value="sim" ${statusValue === 'sim' ? 'checked' : ''} 
                onchange="handleStatusChange('${fieldKey}', 'sim', ${ehDanificado})" class="sr-only peer">
              <span class="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 text-slate-600 bg-white 
                ${simCheckedClass} hover:border-slate-300 transition-all flex items-center space-x-1 shadow-sm">
                ${simLabel}
              </span>
            </label>

            <!-- Opção NÃO -->
            <label class="inline-flex items-center cursor-pointer select-none">
              <input type="radio" name="${fieldKey}" id="${fieldKey}-nao" value="nao" ${statusValue === 'nao' ? 'checked' : ''} 
                onchange="handleStatusChange('${fieldKey}', 'nao', ${ehDanificado})" class="sr-only peer">
              <span class="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 text-slate-600 bg-white 
                ${naoCheckedClass} hover:border-slate-300 transition-all flex items-center space-x-1 shadow-sm">
                ${naoLabel}
              </span>
            </label>
          </div>
        </div>

        <!-- Campo expandido para descrição de Não Cumprimento ou O que foi danificado -->
        <div id="motivo-container-${fieldKey}" class="mt-3 ${motivoVisivel ? 'block' : 'hidden'} expand-nao-field pl-5 sm:pl-7">
          <div class="p-3 bg-white/95 border border-rose-300 rounded-lg shadow-xs">
            <label class="block text-xs font-bold text-rose-800 mb-1.5 flex items-center">
              <i class="fas fa-exclamation-triangle mr-1.5 text-rose-600"></i>
              ${labelMotivo}
            </label>
            <textarea id="motivo-${fieldKey}" rows="2" 
              placeholder="${placeholderMotivo}" 
              class="w-full text-xs text-slate-800 bg-slate-50/50 border border-slate-200 rounded-md p-2 focus:ring-2 focus:ring-rose-400 focus:border-rose-400 outline-none transition-all">${escapeHtml(motivoValue)}</textarea>
          </div>
        </div>
      `;

      itemsContainer.appendChild(itemRow);
    });
  });
}

// Manipulação da mudança de status (Sim / Não) considerando a lógica invertida de itens danificados
window.handleStatusChange = function(fieldKey, value, ehDanificado) {
  const row = document.getElementById(`row-${fieldKey}`);
  const motivoContainer = document.getElementById(`motivo-container-${fieldKey}`);
  const motivoInput = document.getElementById(`motivo-${fieldKey}`);

  // Se for item Danificado:
  // - value === 'sim' -> ESTÁ DANIFICADO (NÃO CONFORME) -> abrir campo
  // - value === 'nao' -> NÃO ESTÁ DANIFICADO (CONFORME) -> ocultar campo
  // Se for item normal:
  // - value === 'nao' -> NÃO CONFORME -> abrir campo
  // - value === 'sim' -> CONFORME -> ocultar campo
  const ehNaoConforme = ehDanificado ? (value === 'sim') : (value === 'nao');

  if (ehNaoConforme) {
    if (row) {
      row.classList.remove('item-sim-ativo', 'hover:bg-slate-50/70');
      row.classList.add('item-nao-ativo');
    }
    if (motivoContainer) {
      motivoContainer.classList.remove('hidden');
      if (motivoInput) {
        setTimeout(() => motivoInput.focus(), 60);
      }
    }
  } else {
    if (row) {
      row.classList.remove('item-nao-ativo', 'hover:bg-slate-50/70');
      row.classList.add('item-sim-ativo');
    }
    if (motivoContainer) {
      motivoContainer.classList.add('hidden');
    }
  }

  updateFormProgressCounters();
};

// Marcar todos os itens da seção em conformidade de forma inteligente
window.marcarTudoConforme = function(sectionId) {
  const section = CHECKLIST_SECTIONS.find(s => s.id === sectionId);
  if (!section) return;

  section.items.forEach((itemText, idx) => {
    const key = `${sectionId}_item_${idx}`;
    const ehDanificado = isItemDanificado(itemText);
    // Para danificado: Conforme é NÃO. Para normal: Conforme é SIM.
    const conformeValue = ehDanificado ? 'nao' : 'sim';
    const radio = document.getElementById(`${key}-${conformeValue}`);
    if (radio) {
      radio.checked = true;
      handleStatusChange(key, conformeValue, ehDanificado);
    }
  });
};

function updateFormProgressCounters() {
  let totalItems = 0;
  let preenchidos = 0;
  let totalNaoConformes = 0;

  CHECKLIST_SECTIONS.forEach(sec => {
    sec.items.forEach((itemText, idx) => {
      totalItems++;
      const key = `${sec.id}_item_${idx}`;
      const sim = document.getElementById(`${key}-sim`);
      const nao = document.getElementById(`${key}-nao`);
      
      let status = null;
      if (sim && sim.checked) status = 'sim';
      if (nao && nao.checked) status = 'nao';

      if (status !== null) {
        preenchidos++;
        const conforme = isItemConforme(itemText, status);
        if (conforme === false) {
          totalNaoConformes++;
        }
      }
    });
  });

  const percent = totalItems > 0 ? Math.round((preenchidos / totalItems) * 100) : 0;
  const progressBar = document.getElementById('form-progress-bar');
  const progressText = document.getElementById('form-progress-text');
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (progressText) {
    progressText.textContent = `${preenchidos} de ${totalItems} itens verificados (${percent}%) - ${totalNaoConformes} não conformidade(s)`;
  }
}

// ==========================================
// 9. ASSINATURA DIGITAL
// ==========================================
function initSignaturePad() {
  const canvas = document.getElementById('signature-pad');
  if (!canvas) return;

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    if (AppState.signaturePad) {
      AppState.signaturePad.clear();
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  if (typeof SignaturePad !== 'undefined') {
    AppState.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: '#002b49',
      minWidth: 1.5,
      maxWidth: 3
    });
  }

  const clearBtn = document.getElementById('btn-clear-signature');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (AppState.signaturePad) AppState.signaturePad.clear();
    };
  }
}

// ==========================================
// 10. CRIAÇÃO, EDIÇÃO E SALVAMENTO DE RELATÓRIO
// ==========================================
window.novoRelatorio = function() {
  AppState.isEditing = false;
  AppState.currentReport = null;

  const nextNum = getNextReportNumber();
  document.getElementById('report-title-display').textContent = `Novo Relatório Nº ${nextNum}`;
  document.getElementById('form-report-number').value = nextNum;
  document.getElementById('form-report-id').value = 'rep_' + Date.now();
  
  // Data e hora padrão atual no formato local
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 16);
  document.getElementById('form-report-date').value = localISOTime;

  document.getElementById('form-report-obra').value = '';
  document.getElementById('form-report-quadro').value = '';
  document.getElementById('form-report-inspector').value = '';
  document.getElementById('form-report-observacoes').value = '';

  renderObrasDatalist();
  renderChecklistForm(null);
  switchView('form');

  setTimeout(() => {
    initSignaturePad();
    updateFormProgressCounters();
  }, 100);
};

window.editarRelatorio = function(id) {
  const report = AppState.reports.find(r => r.id === id);
  if (!report) return;

  AppState.isEditing = true;
  AppState.currentReport = report;

  document.getElementById('report-title-display').textContent = `Editando Relatório Nº ${report.numero}`;
  document.getElementById('form-report-number').value = report.numero;
  document.getElementById('form-report-id').value = report.id;
  document.getElementById('form-report-date').value = report.dataHoraIso || report.dataHora;
  document.getElementById('form-report-obra').value = report.obra || '';
  document.getElementById('form-report-quadro').value = report.quadro || '';
  document.getElementById('form-report-inspector').value = report.inspetor || '';
  document.getElementById('form-report-observacoes').value = report.observacoes || '';

  renderObrasDatalist();
  renderChecklistForm(report);
  switchView('form');

  setTimeout(() => {
    initSignaturePad();
    if (report.assinatura && AppState.signaturePad) {
      AppState.signaturePad.fromDataURL(report.assinatura);
    }
    updateFormProgressCounters();
  }, 100);
};

window.salvarRelatorio = async function(andExportPdf = false) {
  const id = document.getElementById('form-report-id').value || ('rep_' + Date.now());
  const numero = parseInt(document.getElementById('form-report-number').value) || getNextReportNumber();
  const obra = document.getElementById('form-report-obra').value.trim();
  const quadro = document.getElementById('form-report-quadro').value.trim();
  const inspetor = document.getElementById('form-report-inspector').value.trim();
  const dataHoraIso = document.getElementById('form-report-date').value;
  const observacoes = document.getElementById('form-report-observacoes').value.trim();

  // Validações essenciais
  if (!obra) {
    alert("Por favor, preencha ou selecione a Obra.");
    document.getElementById('form-report-obra').focus();
    return;
  }

  if (!inspetor) {
    alert("Por favor, selecione ou informe o Responsável Técnico / Inspetor.");
    document.getElementById('form-report-inspector').focus();
    return;
  }

  // Registrar a obra salva para futuras escolhas
  await registrarNovaObra(obra);

  // Coleta dos itens do checklist com avaliação precisa de conformidade
  const items = {};
  let totalConformes = 0;
  let totalNaoConformes = 0;
  let naoPreenchidos = 0;
  const pendencias = [];

  CHECKLIST_SECTIONS.forEach(sec => {
    sec.items.forEach((itemText, idx) => {
      const key = `${sec.id}_item_${idx}`;
      const simRadio = document.getElementById(`${key}-sim`);
      const naoRadio = document.getElementById(`${key}-nao`);
      const motivoInput = document.getElementById(`motivo-${key}`);

      const ehDanificado = isItemDanificado(itemText);
      let status = null;
      let motivo = '';

      if (simRadio && simRadio.checked) status = 'sim';
      if (naoRadio && naoRadio.checked) status = 'nao';

      if (status !== null) {
        const conforme = isItemConforme(itemText, status);
        motivo = motivoInput ? motivoInput.value.trim() : '';

        if (conforme === true) {
          totalConformes++;
        } else {
          totalNaoConformes++;
          pendencias.push({
            secao: sec.title,
            item: itemText,
            motivo: motivo || (ehDanificado ? 'Componente apontado como danificado' : 'Não conformidade registrada')
          });
        }
      } else {
        naoPreenchidos++;
      }

      items[key] = {
        secao: sec.title,
        item: itemText,
        status: status,
        ehDanificado: ehDanificado,
        conforme: isItemConforme(itemText, status),
        motivo: motivo
      };
    });
  });

  // Assinatura digital
  let assinaturaDataUrl = '';
  if (AppState.signaturePad && !AppState.signaturePad.isEmpty()) {
    assinaturaDataUrl = AppState.signaturePad.toDataURL();
  } else if (AppState.currentReport && AppState.currentReport.assinatura) {
    assinaturaDataUrl = AppState.currentReport.assinatura;
  }

  const totalRespondidos = totalConformes + totalNaoConformes;

  // Objeto estruturado do Relatório
  const reportData = {
    id: id,
    numero: numero,
    codigoRelatorio: `Relatório Nº ${numero}`,
    obra: obra,
    quadro: quadro || 'Quadro Geral',
    inspetor: inspetor,
    dataHoraIso: dataHoraIso,
    dataHoraFormatada: formatarData(dataHoraIso),
    observacoes: observacoes,
    items: items,
    estatisticas: {
      totalItens: totalRespondidos + naoPreenchidos,
      totalConformes: totalConformes,
      totalNaoConformes: totalNaoConformes,
      totalSim: totalConformes, // retrocompatibilidade
      totalNao: totalNaoConformes, // retrocompatibilidade
      naoPreenchidos: naoPreenchidos,
      percentualConformidade: totalRespondidos > 0 ? Math.round((totalConformes / totalRespondidos) * 100) : 0
    },
    pendencias: pendencias,
    assinatura: assinaturaDataUrl,
    atualizadoEm: new Date().toISOString()
  };

  // Salvar no Firebase Firestore e LocalStorage
  try {
    if (db) {
      await db.collection("relatorios_quadros").doc(id).set(reportData);
    }
  } catch (err) {
    console.warn("Aviso ao salvar no Firestore (mantendo local):", err);
  }

  // Atualiza lista local
  const index = AppState.reports.findIndex(r => r.id === id);
  if (index >= 0) {
    AppState.reports[index] = reportData;
  } else {
    AppState.reports.unshift(reportData);
  }
  saveLocalReports(AppState.reports);
  refreshObrasList();

  showToast(`Relatório Nº ${numero} salvo com sucesso!`, 'success');

  if (andExportPdf) {
    visualizarRelatorio(id);
    setTimeout(() => exportarPDF(), 350);
  } else {
    visualizarRelatorio(id);
  }
};

window.excluirRelatorio = async function(id) {
  const report = AppState.reports.find(r => r.id === id);
  const num = report ? report.numero : '';
  if (!confirm(`Tem certeza que deseja excluir o Relatório Nº ${num}? Esta ação não pode ser desfeita.`)) {
    return;
  }

  try {
    if (db) {
      await db.collection("relatorios_quadros").doc(id).delete();
    }
  } catch (e) {
    console.warn("Erro ao deletar Firestore:", e);
  }

  AppState.reports = AppState.reports.filter(r => r.id !== id);
  saveLocalReports(AppState.reports);
  showToast(`Relatório excluído com sucesso.`, 'info');
  switchView('dashboard');
  renderAllViews();
};

// ==========================================
// 11. VISUALIZAÇÃO DETALHADA DO RELATÓRIO
// ==========================================
window.visualizarRelatorio = function(id) {
  const report = AppState.reports.find(r => r.id === id);
  if (!report) return;

  AppState.currentReport = report;
  renderReportDetail(report);
  switchView('detail');
};

function renderReportDetail(report) {
  const detailContainer = document.getElementById('report-detail-content');
  if (!detailContainer) return;

  const totalNaoConformes = report.estatisticas.totalNaoConformes !== undefined ? 
    report.estatisticas.totalNaoConformes : report.estatisticas.totalNao;
  const is100Conforme = totalNaoConformes === 0;

  let sectionsHtml = '';
  CHECKLIST_SECTIONS.forEach(sec => {
    let itemsRows = '';
    sec.items.forEach((itemText, idx) => {
      const key = `${sec.id}_item_${idx}`;
      const itemData = report.items ? report.items[key] : null;
      const status = itemData ? itemData.status : null;
      const motivo = itemData ? itemData.motivo : '';
      const ehDanificado = isItemDanificado(itemText);
      const conforme = isItemConforme(itemText, status);

      let badgeStatus = '<span class="text-xs text-slate-400">N/A</span>';
      if (status !== null) {
        if (ehDanificado) {
          badgeStatus = status === 'nao' ? 
            '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800"><i class="fas fa-check mr-1"></i> NÃO (Sem Danos)</span>' :
            '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800"><i class="fas fa-exclamation-triangle mr-1"></i> SIM (Danificado)</span>';
        } else {
          badgeStatus = status === 'sim' ? 
            '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800"><i class="fas fa-check mr-1"></i> SIM</span>' : 
            '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800"><i class="fas fa-times mr-1"></i> NÃO</span>';
        }
      }

      itemsRows += `
        <tr class="border-b border-slate-100 hover:bg-slate-50/50 ${conforme === false ? 'bg-rose-50/40' : ''}">
          <td class="py-2.5 px-4 text-xs font-medium text-slate-800">
            ${itemText}
            ${ehDanificado ? '<span class="text-[10px] text-slate-400 ml-1.5">(Item de Dano)</span>' : ''}
          </td>
          <td class="py-2.5 px-4 text-center shrink-0">
            ${badgeStatus}
          </td>
          <td class="py-2.5 px-4 text-xs">
            ${motivo ? 
              `<span class="text-rose-800 font-semibold bg-rose-100/80 px-2 py-1 rounded border border-rose-200 inline-block">${escapeHtml(motivo)}</span>` : 
              (conforme === true ? '<span class="text-emerald-700 italic font-medium">Conforme / Sem apontamento</span>' : '<span class="text-slate-400 italic">-</span>')}
          </td>
        </tr>
      `;
    });

    sectionsHtml += `
      <div class="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <i class="fas ${sec.icon} text-[#007dc5]"></i>
            <h4 class="font-semibold text-sm text-slate-800">${sec.title}</h4>
          </div>
          <span class="text-xs text-slate-500 font-medium">${sec.items.length} verificações</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-slate-100/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th class="py-2 px-4">Item de Verificação</th>
                <th class="py-2 px-4 text-center w-36">Status</th>
                <th class="py-2 px-4">Apontamento / Detalhe do Dano</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  detailContainer.innerHTML = `
    <!-- Topo do Documento -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-6">
        <div class="flex items-center space-x-4">
          <img src="logo 3d.svg" alt="3D Ar Condicionado" class="h-12 w-auto object-contain">
          <div>
            <div class="flex items-center space-x-2">
              <h2 class="text-2xl font-bold text-slate-900">${report.codigoRelatorio}</h2>
              ${is100Conforme ? 
                '<span class="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300">Conforme (100%)</span>' : 
                `<span class="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-rose-300">${totalNaoConformes} Não Conformidade(s)</span>`}
            </div>
            <p class="text-xs text-slate-500 mt-1">Checklist de Liberação e Conferência de Painel Elétrico</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
          <button onclick="editarRelatorio('${report.id}')" class="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm flex items-center">
            <i class="fas fa-edit mr-1.5 text-blue-600"></i> Editar
          </button>
          <button onclick="exportarExcel()" class="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm flex items-center">
            <i class="fas fa-file-excel mr-1.5 text-emerald-600"></i> Exportar Excel
          </button>
          <button onclick="exportarPDF()" class="px-4 py-2 text-xs font-semibold text-white bg-[#007dc5] hover:bg-[#005a8e] rounded-lg transition-colors shadow-sm flex items-center">
            <i class="fas fa-file-pdf mr-1.5"></i> Exportar PDF
          </button>
          <button onclick="excluirRelatorio('${report.id}')" class="px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-sm flex items-center" title="Excluir Relatório">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>

      <!-- Grid de Metadados -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div>
          <span class="block text-[11px] font-semibold text-slate-400 uppercase">Obra</span>
          <span class="text-sm font-bold text-slate-800">${escapeHtml(report.obra)}</span>
        </div>
        <div>
          <span class="block text-[11px] font-semibold text-slate-400 uppercase">Quadro Elétrico</span>
          <span class="text-sm font-bold text-slate-800">${escapeHtml(report.quadro || 'Geral')}</span>
        </div>
        <div>
          <span class="block text-[11px] font-semibold text-slate-400 uppercase">Data e Hora</span>
          <span class="text-sm font-medium text-slate-800">${report.dataHoraFormatada}</span>
        </div>
        <div>
          <span class="block text-[11px] font-semibold text-slate-400 uppercase">Inspetor Responsável</span>
          <span class="text-sm font-bold text-[#007dc5]">${escapeHtml(report.inspetor)}</span>
        </div>
      </div>

      <!-- Resumo Estatístico -->
      <div class="grid grid-cols-3 gap-3 mt-4">
        <div class="p-3 bg-white rounded-lg border border-slate-200 text-center">
          <span class="text-xs text-slate-500 font-medium">Itens Totais</span>
          <p class="text-xl font-bold text-slate-800">${report.estatisticas.totalItens}</p>
        </div>
        <div class="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
          <span class="text-xs text-emerald-700 font-medium">Itens Conformes</span>
          <p class="text-xl font-bold text-emerald-800">${report.estatisticas.totalConformes !== undefined ? report.estatisticas.totalConformes : report.estatisticas.totalSim}</p>
        </div>
        <div class="p-3 bg-rose-50 rounded-lg border border-rose-200 text-center">
          <span class="text-xs text-rose-700 font-medium">Não Conformidades</span>
          <p class="text-xl font-bold text-rose-800">${totalNaoConformes}</p>
        </div>
      </div>
    </div>

    <!-- Seções de Itens -->
    ${sectionsHtml}

    <!-- Observações Gerais -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <h4 class="font-semibold text-sm text-slate-800 mb-2 flex items-center">
        <i class="fas fa-comment-alt text-[#007dc5] mr-2"></i> Observações Gerais
      </h4>
      <p class="text-xs text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-line">
        ${escapeHtml(report.observacoes || 'Nenhuma observação complementar informada.')}
      </p>
    </div>

    <!-- Assinatura do Inspetor -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <h4 class="font-semibold text-sm text-slate-800 mb-3 flex items-center">
        <i class="fas fa-signature text-[#007dc5] mr-2"></i> Assinatura do Responsável Técnico
      </h4>
      <div class="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div class="w-64 h-24 bg-white border border-slate-300 rounded flex items-center justify-center overflow-hidden">
          ${report.assinatura ? 
            `<img src="${report.assinatura}" alt="Assinatura" class="max-h-full max-w-full object-contain">` : 
            `<span class="text-xs text-slate-400 italic">Assinatura digital não capturada</span>`}
        </div>
        <div>
          <p class="text-sm font-bold text-slate-800">${escapeHtml(report.inspetor)}</p>
          <p class="text-xs text-slate-500">Conferente / Responsável pelo Checklist</p>
          <p class="text-[11px] text-slate-400 mt-1">3D Ar Condicionado • Conclusão em ${report.dataHoraFormatada}</p>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 12. EXPORTAÇÃO PDF E EXCEL
// ==========================================
window.exportarPDF = function() {
  const report = AppState.currentReport;
  if (!report) return;

  const pdfContainer = document.getElementById('pdf-template-wrapper');
  if (!pdfContainer) return;

  const totalNaoConformes = report.estatisticas.totalNaoConformes !== undefined ? 
    report.estatisticas.totalNaoConformes : report.estatisticas.totalNao;

  pdfContainer.innerHTML = `
    <div style="font-family: 'Inter', sans-serif; color: #1e293b; padding: 24px; background: #ffffff;">
      <!-- Header do Relatório -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #007dc5; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="logo 3d.svg" style="height: 48px; width: auto;" alt="3D Ar">
          <div>
            <h1 style="font-size: 16px; font-weight: 800; color: #007dc5; margin: 0; text-transform: uppercase;">3D Ar Condicionado</h1>
            <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Checklist de Conferência de Quadros Elétricos</p>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${report.codigoRelatorio}</div>
          <div style="font-size: 11px; color: #64748b;">${report.dataHoraFormatada}</div>
        </div>
      </div>

      <!-- Metadados -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 16px; font-size: 11px;">
        <div><strong>Obra:</strong> ${escapeHtml(report.obra)}</div>
        <div><strong>Identificação / Tag:</strong> ${escapeHtml(report.quadro || 'Geral')}</div>
        <div><strong>Inspetor Responsável:</strong> ${escapeHtml(report.inspetor)}</div>
        <div><strong>Conformidade:</strong> ${report.estatisticas.percentualConformidade}% (${totalNaoConformes} Não Conformidade(s))</div>
      </div>

      <!-- Tabelas do Checklist -->
      ${CHECKLIST_SECTIONS.map(sec => `
        <div style="margin-bottom: 14px;">
          <div style="background: #f1f5f9; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #0f172a; border-left: 4px solid #007dc5;">
            ${sec.title}
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; text-align: left;">
                <th style="padding: 5px; width: 45%;">Item de Conferência</th>
                <th style="padding: 5px; width: 15%; text-align: center;">Status</th>
                <th style="padding: 5px; width: 40%;">Apontamento / O que foi danificado</th>
              </tr>
            </thead>
            <tbody>
              ${sec.items.map((itemText, idx) => {
                const key = `${sec.id}_item_${idx}`;
                const item = report.items ? report.items[key] : null;
                const status = item ? item.status : null;
                const motivo = item ? item.motivo : '';
                const ehDanificado = isItemDanificado(itemText);
                const conforme = isItemConforme(itemText, status);

                let statusLabel = '-';
                let statusColor = '#64748b';

                if (status !== null) {
                  if (ehDanificado) {
                    statusLabel = status === 'nao' ? 'NÃO (Sem Danos)' : 'SIM (Danificado)';
                    statusColor = status === 'nao' ? '#166534' : '#991b1b';
                  } else {
                    statusLabel = status === 'sim' ? 'SIM' : 'NÃO';
                    statusColor = status === 'sim' ? '#166534' : '#991b1b';
                  }
                }

                return `
                  <tr style="border-bottom: 1px solid #e2e8f0; background: ${conforme === false ? '#fef2f2' : 'transparent'};">
                    <td style="padding: 4px 5px; font-weight: ${conforme === false ? '600' : 'normal'}; color: ${conforme === false ? '#991b1b' : '#334155'};">
                      ${itemText}
                    </td>
                    <td style="padding: 4px 5px; text-align: center; font-weight: bold; color: ${statusColor};">
                      ${statusLabel}
                    </td>
                    <td style="padding: 4px 5px; color: ${conforme === false ? '#991b1b' : '#64748b'};">
                      ${motivo ? escapeHtml(motivo) : (conforme === true ? 'Conforme' : '-')}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}

      <!-- Observações Gerais -->
      <div style="margin-top: 12px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px;">
        <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Observações Complementares:</strong>
        <p style="margin: 0; color: #475569; white-space: pre-line;">${escapeHtml(report.observacoes || 'Sem observações adicionais.')}</p>
      </div>

      <!-- Bloco de Assinatura -->
      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 10px; border-top: 1px solid #cbd5e1;">
        <div>
          <p style="font-size: 9px; color: #94a3b8; margin: 0;">Relatório gerado via Sistema Checklist 3D Ar Condicionado</p>
          <p style="font-size: 9px; color: #94a3b8; margin: 0;">ID Autenticação: ${report.id}</p>
        </div>
        <div style="text-align: center;">
          ${report.assinatura ? `<img src="${report.assinatura}" style="height: 44px; max-width: 180px; object-contain: contain; margin-bottom: 2px;">` : `<div style="height: 44px;"></div>`}
          <div style="border-top: 1px solid #000; width: 200px; margin: 0 auto; padding-top: 2px; font-size: 10px; font-weight: bold;">
            ${escapeHtml(report.inspetor)}
          </div>
          <span style="font-size: 9px; color: #64748b;">Responsável pela Conferência</span>
        </div>
      </div>
    </div>
  `;

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Relatorio_N_${report.numero}_${report.obra.replace(/[^a-zA-Z0-9]/g, '_')}_3DAr.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(pdfContainer).save().then(() => {
    showToast("PDF gerado e baixado com sucesso!", "success");
  });
};

window.exportarExcel = function() {
  const report = AppState.currentReport;
  if (!report) return;

  if (typeof XLSX === 'undefined') {
    alert("Biblioteca Excel não carregada.");
    return;
  }

  const totalNaoConformes = report.estatisticas.totalNaoConformes !== undefined ? 
    report.estatisticas.totalNaoConformes : report.estatisticas.totalNao;
  const totalConformes = report.estatisticas.totalConformes !== undefined ? 
    report.estatisticas.totalConformes : report.estatisticas.totalSim;

  const rows = [];
  rows.push(["3D AR CONDICIONADO - CHECKLIST DE QUADROS ELÉTRICOS"]);
  rows.push(["Código do Relatório:", report.codigoRelatorio]);
  rows.push(["Data e Hora:", report.dataHoraFormatada]);
  rows.push(["Obra:", report.obra]);
  rows.push(["Identificação / Tag do Quadro:", report.quadro || "Geral"]);
  rows.push(["Inspetor Responsável:", report.inspetor]);
  rows.push(["Itens Conformes:", totalConformes]);
  rows.push(["Não Conformidades:", totalNaoConformes]);
  rows.push([]);

  // Cabeçalho da tabela de itens
  rows.push(["Sessão", "Item de Conferência", "Status", "Conformidade", "O que foi danificado / Não Cumprimento"]);

  CHECKLIST_SECTIONS.forEach(sec => {
    sec.items.forEach((itemText, idx) => {
      const key = `${sec.id}_item_${idx}`;
      const item = report.items ? report.items[key] : null;
      const status = item ? item.status : null;
      const ehDanificado = isItemDanificado(itemText);
      const conforme = isItemConforme(itemText, status);

      let statusDisplay = '-';
      if (status !== null) {
        if (ehDanificado) {
          statusDisplay = status === 'nao' ? 'NÃO (Sem Danos)' : 'SIM (Danificado)';
        } else {
          statusDisplay = status === 'sim' ? 'SIM' : 'NÃO';
        }
      }

      const conformidadeDisplay = conforme === true ? 'CONFORME' : (conforme === false ? 'NÃO CONFORME' : '-');
      const motivo = item ? item.motivo || '' : '';

      rows.push([sec.title, itemText, statusDisplay, conformidadeDisplay, motivo]);
    });
  });

  rows.push([]);
  rows.push(["Observações Complementares:", report.observacoes || "Nenhuma"]);
  rows.push(["Assinatura do Inspetor:", report.inspetor]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Checklist");

  ws['!cols'] = [
    { wch: 22 },
    { wch: 45 },
    { wch: 18 },
    { wch: 16 },
    { wch: 50 }
  ];

  XLSX.writeFile(wb, `Relatorio_N_${report.numero}_${report.obra.replace(/[^a-zA-Z0-9]/g, '_')}_3DAr.xlsx`);
  showToast("Planilha Excel exportada com sucesso!", "success");
};

// ==========================================
// 13. DASHBOARD E MENU LATERAL DIREITO (ASANA STYLE)
// ==========================================
function renderDashboard() {
  const container = document.getElementById('dashboard-reports-grid');
  const countBadge = document.getElementById('dashboard-total-count');
  const emptyState = document.getElementById('dashboard-empty-state');
  
  if (!container) return;

  const filteredReports = getFilteredReports();

  if (countBadge) countBadge.textContent = `${AppState.reports.length} relatórios gerados`;

  // Atualizar métricas do dashboard
  const metricTotal = document.getElementById('metric-total-relatorios');
  const metricNaoConformidades = document.getElementById('metric-total-nao');
  const metricUltima = document.getElementById('metric-ultima-data');

  if (metricTotal) metricTotal.textContent = AppState.reports.length;
  if (metricNaoConformidades) {
    const totalNao = AppState.reports.reduce((acc, r) => {
      const nao = r.estatisticas ? (r.estatisticas.totalNaoConformes !== undefined ? r.estatisticas.totalNaoConformes : r.estatisticas.totalNao) : 0;
      return acc + (Number(nao) || 0);
    }, 0);
    metricNaoConformidades.textContent = totalNao;
  }
  if (metricUltima) {
    metricUltima.textContent = AppState.reports.length > 0 ? AppState.reports[0].dataHoraFormatada : '-';
  }

  if (filteredReports.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = filteredReports.map(report => {
    const totalNao = report.estatisticas ? (report.estatisticas.totalNaoConformes !== undefined ? report.estatisticas.totalNaoConformes : report.estatisticas.totalNao) : 0;
    const isConforme = totalNao === 0;

    return `
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-[#007dc5]/50 transition-card p-5 flex flex-col justify-between cursor-pointer" onclick="visualizarRelatorio('${report.id}')">
        <div>
          <div class="flex items-start justify-between mb-3">
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-sky-50 text-[#007dc5] border border-sky-200">
              ${report.codigoRelatorio}
            </span>
            ${isConforme ? 
              '<span class="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><i class="fas fa-check-circle mr-1"></i> Conforme</span>' : 
              `<span class="inline-flex items-center text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200"><i class="fas fa-exclamation-triangle mr-1"></i> ${totalNao} Não Conformidade(s)</span>`}
          </div>

          <h3 class="text-base font-bold text-slate-800 line-clamp-1 mb-1" title="${escapeHtml(report.obra)}">${escapeHtml(report.obra)}</h3>
          <p class="text-xs text-slate-500 mb-4 flex items-center">
            <i class="fas fa-cubes text-slate-400 mr-1.5"></i> ${escapeHtml(report.quadro || 'Painel Elétrico')}
          </p>

          <div class="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <div class="flex items-center justify-between">
              <span class="text-slate-400"><i class="fas fa-user mr-1.5 text-slate-400"></i> Inspetor:</span>
              <span class="font-medium text-slate-700">${escapeHtml(report.inspetor)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400"><i class="fas fa-calendar mr-1.5 text-slate-400"></i> Data:</span>
              <span class="text-slate-600">${report.dataHoraFormatada}</span>
            </div>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-slate-500 font-medium">Ver detalhes <i class="fas fa-arrow-right text-[10px] ml-1"></i></span>
          <div class="flex items-center space-x-1" onclick="event.stopPropagation();">
            <button onclick="editarRelatorio('${report.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="excluirRelatorio('${report.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar o Menu Lateral Direito (Sidebar no padrão Asana)
function renderRightSidebar() {
  const sidebarList = document.getElementById('sidebar-reports-list');
  const countElement = document.getElementById('sidebar-count-badge');
  if (!sidebarList) return;

  const filtered = getFilteredReports();
  if (countElement) countElement.textContent = AppState.reports.length;

  if (filtered.length === 0) {
    sidebarList.innerHTML = `
      <div class="p-4 text-center text-xs text-slate-400">
        Nenhum relatório encontrado.
      </div>
    `;
    return;
  }

  sidebarList.innerHTML = filtered.map(report => {
    const isSelected = AppState.currentReport && AppState.currentReport.id === report.id;
    const totalNao = report.estatisticas ? (report.estatisticas.totalNaoConformes !== undefined ? report.estatisticas.totalNaoConformes : report.estatisticas.totalNao) : 0;
    const isConforme = totalNao === 0;

    return `
      <div onclick="visualizarRelatorio('${report.id}')" 
        class="p-3 rounded-lg cursor-pointer transition-all duration-150 mb-1 border ${isSelected ? 'bg-sky-50 border-[#007dc5]/40 text-[#007dc5]' : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'}">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold ${isSelected ? 'text-[#007dc5]' : 'text-slate-800'}">${report.codigoRelatorio}</span>
          <span class="text-[10px] ${isConforme ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-1.5 py-0.5 rounded font-medium">
            ${isConforme ? '100% OK' : `${totalNao} pendência(s)`}
          </span>
        </div>
        <div class="text-xs font-medium text-slate-700 truncate" title="${escapeHtml(report.obra)}">${escapeHtml(report.obra)}</div>
        <div class="flex items-center justify-between text-[11px] text-slate-400 mt-1">
          <span>${escapeHtml(report.inspetor)}</span>
          <span>${report.dataHoraFormatada ? report.dataHoraFormatada.split(' ')[0] : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

function getFilteredReports() {
  if (!AppState.searchQuery) return AppState.reports;
  const q = AppState.searchQuery.toLowerCase();
  return AppState.reports.filter(r => 
    (r.obra && r.obra.toLowerCase().includes(q)) ||
    (r.codigoRelatorio && r.codigoRelatorio.toLowerCase().includes(q)) ||
    (r.inspetor && r.inspetor.toLowerCase().includes(q)) ||
    (r.quadro && r.quadro.toLowerCase().includes(q))
  );
}

function renderAllViews() {
  renderDashboard();
  renderRightSidebar();
  renderObrasDatalist();
}

// ==========================================
// 14. NAVEGAÇÃO DE TELAS (VIEW SWITCHER)
// ==========================================
window.switchView = function(viewName) {
  AppState.currentView = viewName;

  const viewDashboard = document.getElementById('view-dashboard');
  const viewForm = document.getElementById('view-form');
  const viewDetail = document.getElementById('view-detail');

  if (viewDashboard) viewDashboard.classList.add('hidden');
  if (viewForm) viewForm.classList.add('hidden');
  if (viewDetail) viewDetail.classList.add('hidden');

  if (viewName === 'dashboard') {
    if (viewDashboard) viewDashboard.classList.remove('hidden');
    renderDashboard();
  } else if (viewName === 'form') {
    if (viewForm) viewForm.classList.remove('hidden');
  } else if (viewName === 'detail') {
    if (viewDetail) viewDetail.classList.remove('hidden');
  }

  renderRightSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ==========================================
// 15. UTILITÁRIOS
// ==========================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarData(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (e) {
    return isoString;
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const colorClass = type === 'success' ? 'bg-emerald-600 text-white' : (type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white');
  const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');

  toast.className = `flex items-center px-4 py-3 rounded-lg shadow-lg text-xs font-semibold ${colorClass} transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `<i class="fas ${icon} mr-2 text-sm"></i> ${message}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Alternar menu lateral em telas menores (drawer)
window.toggleSidebar = function() {
  const sidebar = document.getElementById('right-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
  if (backdrop) {
    backdrop.classList.toggle('mobile-open');
  }
};

// Busca global
window.handleSearch = function(query) {
  AppState.searchQuery = query;
  renderAllViews();
};

// ==========================================
// 16. INICIALIZAÇÃO NO DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Preencher Select de Inspetores
  const inspectorSelect = document.getElementById('form-report-inspector');
  if (inspectorSelect) {
    EQUIPE_RESPONSAVEIS.forEach(nome => {
      const opt = document.createElement('option');
      opt.value = nome;
      opt.textContent = nome;
      inspectorSelect.appendChild(opt);
    });
  }

  // Listener da busca global
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  }

  // Listener da busca na sidebar
  const sidebarSearchInput = document.getElementById('sidebar-search-input');
  if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  }

  // Iniciar sincronização e interface
  initDataSync();
});
