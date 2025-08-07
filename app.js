// Variáveis globais
let currentUser = null;
let editingAgendamentoId = null;
let currentExtraAgendamento = null;

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Inicializa autenticação
    initAuth();
    
    // Configura listeners
    setupEventListeners();
});

// Configura a autenticação
function initAuth() {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            updateUIForUser(user);
            loadAgendamentos();
            loadBlockedDays();
        } else {
            // Redireciona para página de login se não estiver autenticado
            window.location.href = 'https://agendains.firebaseapp.com/__/auth/handler';
        }
    });
}

// Atualiza a UI baseado no usuário logado
function updateUIForUser(user) {
    const userInfo = document.getElementById('user-info');
    userInfo.textContent = `Logado como: ${user.email}`;
    
    // Mostra funcionalidades extras para supervisor/admin
    if (isSupervisorOrAdmin(user)) {
        document.getElementById('add-blocked-day').classList.remove('d-none');
    }
}

// Verifica se o usuário é supervisor ou admin
function isSupervisorOrAdmin(user) {
    return ['supervisor@sejafibra.net', 'bioranss@sejafibra.net'].includes(user.email);
}

// Configura os event listeners
function setupEventListeners() {
    // Formulário de agendamento
    document.getElementById('agendamento-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
    
    // Filtro de data
    document.getElementById('filter-date').addEventListener('change', filterAgendamentosByDate);
    
    // Data do agendamento - verifica limite
    document.getElementById('data').addEventListener('change', checkAgendamentoLimit);
    
    // Botão para adicionar dia bloqueado
    document.getElementById('add-blocked-day').addEventListener('click', addBlockedDay);
    
    // Modais
    document.getElementById('confirm-extra').addEventListener('click', requestExtraAuthorization);
    document.getElementById('authorize-extra').addEventListener('click', authorizeExtraAgendamento);
}

// Manipula o envio do formulário
function handleFormSubmit(e) {
    e.preventDefault();
    
    const data = document.getElementById('data').value;
    const cliente = document.getElementById('cliente').value;
    const endereco = document.getElementById('endereco').value;
    const numero = document.getElementById('numero').value;
    const complemento = document.getElementById('complemento').value;
    const bairro = document.getElementById('bairro').value;
    const periodo = document.getElementById('periodo').value;
    const observacoes = document.getElementById('observacoes').value;
    const roteador = document.getElementById('roteador').checked;
    
    const agendamento = {
        data,
        cliente,
        endereco,
        numero,
        complemento: complemento || '',
        bairro,
        periodo,
        observacoes: observacoes || '',
        roteador,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        createdBy: currentUser.email,
        status: 'pending' // pending, authorized, rejected (para agendamentos extras)
    };
    
    if (editingAgendamentoId) {
        // Atualiza agendamento existente
        updateAgendamento(editingAgendamentoId, agendamento);
    } else {
        // Cria novo agendamento
        createAgendamento(agendamento);
    }
}

// Cria um novo agendamento no Firebase
function createAgendamento(agendamento) {
    // Verifica se é um agendamento extra que precisa de autorização
    if (currentExtraAgendamento) {
        agendamento.status = 'pending';
        database.ref('extraRequests').push(agendamento);
        showAlert('Solicitação de agendamento extra enviada para o supervisor.', 'success');
        currentExtraAgendamento = null;
        resetForm();
        return;
    }
    
    // Adiciona ao banco de dados
    database.ref('agendamentos').push(agendamento)
        .then(() => {
            showAlert('Agendamento criado com sucesso!', 'success');
            resetForm();
        })
        .catch(error => {
            showAlert('Erro ao criar agendamento: ' + error.message, 'danger');
        });
}

// Atualiza um agendamento existente
function updateAgendamento(id, agendamento) {
    database.ref('agendamentos/' + id).update(agendamento)
        .then(() => {
            showAlert('Agendamento atualizado com sucesso!', 'success');
            cancelEdit();
        })
        .catch(error => {
            showAlert('Erro ao atualizar agendamento: ' + error.message, 'danger');
        });
}

// Carrega agendamentos do Firebase
function loadAgendamentos() {
    database.ref('agendamentos').on('value', snapshot => {
        const agendamentos = [];
        snapshot.forEach(childSnapshot => {
            agendamentos.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        renderAgendamentos(agendamentos);
    });
}

// Filtra agendamentos por data
function filterAgendamentosByDate() {
    const date = document.getElementById('filter-date').value;
    if (!date) {
        loadAgendamentos();
        return;
    }
    
    database.ref('agendamentos').orderByChild('data').equalTo(date).once('value')
        .then(snapshot => {
            const filteredAgendamentos = [];
            snapshot.forEach(childSnapshot => {
                filteredAgendamentos.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            renderAgendamentos(filteredAgendamentos);
        });
}

// Renderiza a lista de agendamentos
function renderAgendamentos(agendamentos) {
    const container = document.getElementById('agendamentos-container');
    container.innerHTML = '';
    
    if (agendamentos.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum agendamento encontrado.</p>';
        return;
    }
    
    // Agrupa por data
    const agendamentosPorData = agendamentos.reduce((acc, agendamento) => {
        if (!acc[agendamento.data]) {
            acc[agendamento.data] = [];
        }
        acc[agendamento.data].push(agendamento);
        return acc;
    }, {});
    
    // Ordena datas
    const sortedDates = Object.keys(agendamentosPorData).sort();
    
    // Cria cards para cada data
    sortedDates.forEach(date => {
        const dateAgendamentos = agendamentosPorData[date];
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'd-flex justify-content-between align-items-center mb-3';
        dateHeader.innerHTML = `
            <h5>${formatDate(date)}</h5>
            <span class="agendamento-count ${dateAgendamentos.length > 3 ? 'warning-count' : ''}">
                ${dateAgendamentos.length} agendamento(s)
            </span>
        `;
        container.appendChild(dateHeader);
        
        // Ordena agendamentos por período (manhã > tarde > encaixe)
        dateAgendamentos.sort((a, b) => {
            const order = { 'Manhã': 1, 'Tarde': 2, 'Encaixe': 3 };
            return order[a.periodo] - order[b.periodo];
        });
        
        // Cria cards para cada agendamento
        dateAgendamentos.forEach(agendamento => {
            const card = document.createElement('div');
            card.className = `card agendamento-card mb-2 ${agendamento.periodo.toLowerCase()}`;
            card.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="card-title">${agendamento.cliente}</h6>
                            <p class="card-text mb-1">
                                <small>${agendamento.endereco}, ${agendamento.numero} ${agendamento.complemento ? ' - ' + agendamento.complemento : ''}</small>
                            </p>
                            <p class="card-text mb-1"><small>${agendamento.bairro}</small></p>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-primary">${agendamento.periodo}</span>
                            ${agendamento.roteador ? '<span class="badge badge-roteador ms-1">Roteador OK</span>' : ''}
                        </div>
                    </div>
                    ${agendamento.observacoes ? `<p class="card-text mt-2"><small><strong>Obs:</strong> ${agendamento.observacoes}</small></p>` : ''}
                    <div class="d-flex justify-content-between mt-2">
                        <small class="text-muted">Agendado por: ${agendamento.createdBy}</small>
                        <div>
                            <i class="bi bi-clipboard copy-btn me-2" title="Copiar para Excel" data-id="${agendamento.id}"></i>
                            ${isSupervisorOrAdmin(currentUser) || agendamento.createdBy === currentUser.email ? `
                                <i class="bi bi-pencil edit-btn me-2" title="Editar" data-id="${agendamento.id}"></i>
                                <i class="bi bi-trash delete-btn" title="Excluir" data-id="${agendamento.id}"></i>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    });
    
    // Adiciona listeners para os botões de ação
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', copyAgendamentoToClipboard);
    });
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', editAgendamento);
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', deleteAgendamento);
    });
}

// Copia agendamento para clipboard no formato para Excel
function copyAgendamentoToClipboard(e) {
    const agendamentoId = e.target.getAttribute('data-id');
    database.ref('agendamentos/' + agendamentoId).once('value')
        .then(snapshot => {
            const agendamento = snapshot.val();
            const textToCopy = [
                agendamento.data,
                agendamento.cliente,
                agendamento.endereco,
                agendamento.numero,
                agendamento.complemento,
                agendamento.bairro,
                agendamento.periodo,
                agendamento.observacoes,
                agendamento.roteador ? 'Sim' : 'Não'
            ].join('\t'); // Tab como separador para Excel
            
            navigator.clipboard.writeText(textToCopy)
                .then(() => showAlert('Dados copiados para a área de transferência!', 'success'))
                .catch(() => showAlert('Erro ao copiar dados.', 'danger'));
        });
}

// Preenche formulário para edição
function editAgendamento(e) {
    const agendamentoId = e.target.getAttribute('data-id');
    database.ref('agendamentos/' + agendamentoId).once('value')
        .then(snapshot => {
            const agendamento = snapshot.val();
            
            document.getElementById('data').value = agendamento.data;
            document.getElementById('cliente').value = agendamento.cliente;
            document.getElementById('endereco').value = agendamento.endereco;
            document.getElementById('numero').value = agendamento.numero;
            document.getElementById('complemento').value = agendamento.complemento;
            document.getElementById('bairro').value = agendamento.bairro;
            document.getElementById('periodo').value = agendamento.periodo;
            document.getElementById('observacoes').value = agendamento.observacoes;
            document.getElementById('roteador').checked = agendamento.roteador;
            
            editingAgendamentoId = agendamentoId;
            document.getElementById('submit-btn').textContent = 'Atualizar Agendamento';
            document.getElementById('cancel-edit-btn').classList.remove('d-none');
            
            // Rola para o formulário
            document.getElementById('agendamento-form').scrollIntoView({ behavior: 'smooth' });
        });
}

// Cancela a edição
function cancelEdit() {
    resetForm();
    editingAgendamentoId = null;
    document.getElementById('submit-btn').textContent = 'Agendar';
    document.getElementById('cancel-edit-btn').classList.add('d-none');
}

// Exclui um agendamento
function deleteAgendamento(e) {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;
    
    const agendamentoId = e.target.getAttribute('data-id');
    database.ref('agendamentos/' + agendamentoId).remove()
        .then(() => showAlert('Agendamento excluído com sucesso!', 'success'))
        .catch(error => showAlert('Erro ao excluir agendamento: ' + error.message, 'danger'));
}

// Verifica limite de agendamentos por dia
function checkAgendamentoLimit() {
    const date = document.getElementById('data').value;
    if (!date) return;
    
    database.ref('agendamentos').orderByChild('data').equalTo(date).once('value')
        .then(snapshot => {
            const count = snapshot.numChildren();
            const infoElement = document.getElementById('data-info');
            
            if (count >= 5) {
                infoElement.textContent = 'Este dia já atingiu o limite máximo de 5 agendamentos.';
                infoElement.className = 'form-text text-danger';
                document.getElementById('submit-btn').disabled = true;
            } else if (count >= 3) {
                infoElement.textContent = 'Este dia já possui 3 agendamentos. Agendamentos extras requerem autorização.';
                infoElement.className = 'form-text text-warning';
                document.getElementById('submit-btn').disabled = false;
                
                // Se for atendente, mostra modal para solicitar autorização
                if (!isSupervisorOrAdmin(currentUser)) {
                    currentExtraAgendamento = {
                        data: date,
                        currentCount: count
                    };
                    
                    const modal = new bootstrap.Modal(document.getElementById('extraModal'));
                    modal.show();
                }
            } else {
                infoElement.textContent = `Este dia possui ${count} agendamento(s).`;
                infoElement.className = 'form-text text-muted';
                document.getElementById('submit-btn').disabled = false;
                currentExtraAgendamento = null;
            }
        });
}

// Solicita autorização para agendamento extra
function requestExtraAuthorization() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('extraModal'));
    modal.hide();
    
    // Preenche modal do supervisor
    document.getElementById('modal-data').textContent = formatDate(currentExtraAgendamento.data);
    document.getElementById('modal-cliente').textContent = document.getElementById('cliente').value;
    
    // Mostra modal de confirmação para supervisor
    if (isSupervisorOrAdmin(currentUser)) {
        const supervisorModal = new bootstrap.Modal(document.getElementById('supervisorModal'));
        supervisorModal.show();
    } else {
        showAlert('Solicitação enviada ao supervisor. Aguarde autorização.', 'info');
    }
}

// Autoriza agendamento extra (para supervisor)
function authorizeExtraAgendamento() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('supervisorModal'));
    modal.hide();
    
    // Aqui você pode implementar a lógica para notificar o atendente
    // ou criar diretamente o agendamento como autorizado
    showAlert('Agendamento extra autorizado com sucesso!', 'success');
    currentExtraAgendamento = null;
}

// Carrega dias bloqueados
function loadBlockedDays() {
    if (!isSupervisorOrAdmin(currentUser)) return;
    
    database.ref('blockedDays').on('value', snapshot => {
        const container = document.getElementById('blocked-days-container');
        container.innerHTML = '';
        
        snapshot.forEach(childSnapshot => {
            const date = childSnapshot.key;
            const reason = childSnapshot.val().reason || '';
            
            const dayElement = document.createElement('div');
            dayElement.className = 'blocked-day';
            dayElement.innerHTML = `
                <span>${formatDate(date)} ${reason ? ' - ' + reason : ''}</span>
                <i class="bi bi-x-lg delete-blocked-day" data-date="${date}"></i>
            `;
            container.appendChild(dayElement);
        });
        
        // Adiciona listeners para excluir dias bloqueados
        document.querySelectorAll('.delete-blocked-day').forEach(btn => {
            btn.addEventListener('click', deleteBlockedDay);
        });
    });
}

// Adiciona um dia bloqueado
function addBlockedDay() {
    const date = prompt('Digite a data a ser bloqueada (YYYY-MM-DD):');
    if (!date) return;
    
    // Valida formato da data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        showAlert('Formato de data inválido. Use YYYY-MM-DD.', 'danger');
        return;
    }
    
    const reason = prompt('Motivo do bloqueio (opcional):');
    
    database.ref('blockedDays/' + date).set({
        reason: reason || '',
        blockedBy: currentUser.email,
        blockedAt: firebase.database.ServerValue.TIMESTAMP
    })
    .then(() => showAlert('Dia bloqueado com sucesso!', 'success'))
    .catch(error => showAlert('Erro ao bloquear dia: ' + error.message, 'danger'));
}

// Exclui um dia bloqueado
function deleteBlockedDay(e) {
    const date = e.target.getAttribute('data-date');
    if (!confirm(`Desbloquear o dia ${formatDate(date)}?`)) return;
    
    database.ref('blockedDays/' + date).remove()
        .then(() => showAlert('Dia desbloqueado com sucesso!', 'success'))
        .catch(error => showAlert('Erro ao desbloquear dia: ' + error.message, 'danger'));
}

// Reseta o formulário
function resetForm() {
    document.getElementById('agendamento-form').reset();
    document.getElementById('data-info').textContent = '';
}

// Formata data para exibição
function formatDate(dateString) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', options);
}

// Mostra alerta
function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show fixed-top mx-auto mt-3`;
    alert.style.maxWidth = '500px';
    alert.style.zIndex = '1100';
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Remove após 5 segundos
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
}