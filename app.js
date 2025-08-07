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
            // Redireciona para login apenas se não estiver na página de callback
            if (!window.location.href.includes('__/auth/handler')) {
                auth.signInWithEmailAndPassword('atendente@sejafibra.net', 'senha')
                    .catch(error => {
                        console.error("Erro de autenticação:", error);
                        // Mostra tela de login personalizada se falhar
                        showLoginScreen();
                    });
            }
        }
    });
}

function showLoginScreen() {
    document.body.innerHTML = `
        <div class="container mt-5">
            <div class="row justify-content-center">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h5 class="card-title mb-0">Login - Seja Fibra</h5>
                        </div>
                        <div class="card-body">
                            <form id="login-form">
                                <div class="mb-3">
                                    <label for="login-email" class="form-label">E-mail</label>
                                    <input type="email" class="form-control" id="login-email" required>
                                </div>
                                <div class="mb-3">
                                    <label for="login-password" class="form-label">Senha</label>
                                    <input type="password" class="form-control" id="login-password" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Entrar</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                alert('Erro ao fazer login: ' + error.message);
            });
    });
}

// Atualiza a UI baseado no usuário logado
function updateUIForUser(user) {
    const userInfo = document.getElementById('user-info');
    userInfo.innerHTML = `Logado como: ${user.email}`;
    setupLogout(); // Adiciona o botão de logout
    
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
    
    // Mostra/oculta campo responsável
    document.getElementById('reserva').addEventListener('change', function() {
        document.getElementById('responsavel-container').style.display = 
            this.checked ? 'block' : 'none';
    });
}

// Manipula o envio do formulário
function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showAlert("Sessão expirada. Faça login novamente.", "danger");
        return;
    }
    
    const data = document.getElementById('data').value;
    const cliente = document.getElementById('cliente').value;
    const endereco = document.getElementById('endereco').value;
    const numero = document.getElementById('numero').value;
    const complemento = document.getElementById('complemento').value;
    const bairro = document.getElementById('bairro').value;
    const periodo = document.getElementById('periodo').value;
    const observacoes = document.getElementById('observacoes').value;
    const loginPPPoE = document.getElementById('login-pppoe').value;
    const senhaPPPoE = document.getElementById('senha-pppoe').value;
    const nomeWifi = document.getElementById('nome-wifi').value;
    const senhaWifi = document.getElementById('senha-wifi').value;
    const roteador = document.getElementById('roteador').checked;
    const reserva = document.getElementById('reserva').checked;
    const responsavel = document.getElementById('responsavel').value;
    
    const agendamento = {
        data,
        cliente: reserva ? "RESERVADO" : cliente,
        endereco,
        numero,
        complemento: complemento || '',
        bairro,
        periodo,
        observacoes: observacoes || '',
        loginPPPoE,
        senhaPPPoE,
        nomeWifi,
        senhaWifi,
        roteador,
        reserva,
        responsavel: reserva ? responsavel : '',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        createdBy: currentUser.email,
        status: 'pending'
    };
    
    if (editingAgendamentoId) {
        updateAgendamento(editingAgendamentoId, agendamento);
    } else {
        createAgendamento(agendamento);
    }
}

// Cria um novo agendamento no Firebase
function createAgendamento(agendamento) {
    if (currentExtraAgendamento) {
        agendamento.status = 'pending';
        database.ref('extraRequests').push(agendamento);
        showAlert('Solicitação de agendamento extra enviada para o supervisor.', 'success');
        currentExtraAgendamento = null;
        resetForm();
        return;
    }
    
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
    if (!currentUser) {
        showAlert("Faça login para editar agendamentos", "danger");
        return;
    }

    database.ref('agendamentos/' + id).update(agendamento)
        .then(() => {
            showAlert('Agendamento atualizado com sucesso!', 'success');
            cancelEdit();
        })
        .catch(error => {
            console.error("Erro detalhado:", error);
            showAlert('Erro ao atualizar: ' + (error.message || "Sem permissão"), 'danger');
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
    
    // Corrigido: Usar once('value') em vez de on('value') para filtro
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
        })
        .catch(error => {
            console.error("Erro ao filtrar agendamentos:", error);
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
    
    const agendamentosPorData = agendamentos.reduce((acc, agendamento) => {
        if (!acc[agendamento.data]) {
            acc[agendamento.data] = [];
        }
        acc[agendamento.data].push(agendamento);
        return acc;
    }, {});
    
    const sortedDates = Object.keys(agendamentosPorData).sort();
    
    sortedDates.forEach(date => {
        const dateAgendamentos = agendamentosPorData[date];
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'd-flex justify-content-between align-items-center mb-3';
        
        const dateObj = new Date(date);
        const isSaturday = dateObj.getDay() === 6; // 6 = Sábado
        
        dateHeader.innerHTML = `
            <h5>${formatDate(date)}</h5>
            <span class="agendamento-count ${isSaturday && dateAgendamentos.length >= 1 ? 'warning-count' : 
                                           !isSaturday && dateAgendamentos.length >= 3 ? 'warning-count' : ''}">
                ${dateAgendamentos.length} agendamento(s)
                ${isSaturday ? '(Sábado)' : ''}
            </span>
        `;
        container.appendChild(dateHeader);
        
        dateAgendamentos.sort((a, b) => {
            const order = { 
                '1ª do dia': 1, 
                'Manhã': 2, 
                'Tarde': 3, 
                'Horário Comercial': 4,
                'Encaixe': 5 
            };
            return order[a.periodo] - order[b.periodo];
        });
        
        dateAgendamentos.forEach(agendamento => {
            const card = document.createElement('div');
            card.className = `card agendamento-card mb-2 ${agendamento.periodo.toLowerCase().replace(' ', '-')} 
                            ${agendamento.reserva ? 'reservado' : ''}`;
            
            card.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="card-title">${agendamento.cliente}</h6>
                            ${agendamento.reserva ? 
                              `<p class="card-text mb-1"><small><strong>Reservado por:</strong> ${agendamento.responsavel}</small></p>` : ''}
                            <p class="card-text mb-1">
                                <small>${agendamento.endereco}, ${agendamento.numero} ${agendamento.complemento ? ' - ' + agendamento.complemento : ''}</small>
                            </p>
                            <p class="card-text mb-1"><small>${agendamento.bairro}</small></p>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-primary">${agendamento.periodo}</span>
                            ${agendamento.roteador ? 
                              '<span class="badge badge-roteador ms-1"><i class="bi bi-router"></i> Roteador OK</span>' : ''}
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
                agendamento.loginPPPoE || '',
                agendamento.senhaPPPoE || '',
                agendamento.nomeWifi || '',
                agendamento.senhaWifi || '',
                agendamento.roteador ? 'Sim' : 'Não',
                agendamento.reserva ? 'Sim' : 'Não',
                agendamento.responsavel || ''
            ].join('\t');
            
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
            document.getElementById('cliente').value = agendamento.cliente === "RESERVADO" ? "" : agendamento.cliente;
            document.getElementById('endereco').value = agendamento.endereco;
            document.getElementById('numero').value = agendamento.numero;
            document.getElementById('complemento').value = agendamento.complemento;
            document.getElementById('bairro').value = agendamento.bairro;
            document.getElementById('periodo').value = agendamento.periodo;
            document.getElementById('observacoes').value = agendamento.observacoes;
            document.getElementById('login-pppoe').value = agendamento.loginPPPoE || '';
            document.getElementById('senha-pppoe').value = agendamento.senhaPPPoE || '';
            document.getElementById('nome-wifi').value = agendamento.nomeWifi || '';
            document.getElementById('senha-wifi').value = agendamento.senhaWifi || '';
            document.getElementById('roteador').checked = agendamento.roteador;
            document.getElementById('reserva').checked = agendamento.reserva;
            document.getElementById('responsavel').value = agendamento.responsavel || '';
            document.getElementById('responsavel-container').style.display = 
                agendamento.reserva ? 'block' : 'none';
            
            editingAgendamentoId = agendamentoId;
            document.getElementById('submit-btn').textContent = 'Atualizar Agendamento';
            document.getElementById('cancel-edit-btn').classList.remove('d-none');
            
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
    
    const dateObj = new Date(date);
    const isSaturday = dateObj.getDay() === 6; // 6 = Sábado
    
    database.ref('agendamentos').orderByChild('data').equalTo(date).once('value')
        .then(snapshot => {
            const count = snapshot.numChildren();
            const infoElement = document.getElementById('data-info');
            
            if (isSaturday) {
                if (count >= 3) {
                    infoElement.textContent = 'Sábado já atingiu o limite máximo de 3 agendamentos.';
                    infoElement.className = 'form-text text-danger';
                    document.getElementById('submit-btn').disabled = true;
                } else if (count >= 1) {
                    infoElement.textContent = 'Sábado já possui 1 agendamento. Agendamentos extras requerem autorização.';
                    infoElement.className = 'form-text text-warning';
                    document.getElementById('submit-btn').disabled = false;
                    
                    if (!isSupervisorOrAdmin(currentUser)) {
                        currentExtraAgendamento = {
                            data: date,
                            currentCount: count,
                            isSaturday: true
                        };
                        
                        const modal = new bootstrap.Modal(document.getElementById('extraModal'));
                        document.getElementById('modal-extra-message').textContent = 
                            'Este sábado já possui 1 agendamento. Deseja solicitar autorização para um agendamento extra?';
                        document.getElementById('modal-extra-info').textContent = 
                            'Máximo de 2 agendamentos extras aos sábados (total de 3).';
                        modal.show();
                    }
                } else {
                    infoElement.textContent = 'Este sábado está disponível para agendamento.';
                    infoElement.className = 'form-text text-success';
                    document.getElementById('submit-btn').disabled = false;
                    currentExtraAgendamento = null;
                }
            } else {
                if (count >= 5) {
                    infoElement.textContent = 'Este dia já atingiu o limite máximo de 5 agendamentos.';
                    infoElement.className = 'form-text text-danger';
                    document.getElementById('submit-btn').disabled = true;
                } else if (count >= 3) {
                    infoElement.textContent = 'Este dia já possui 3 agendamentos. Agendamentos extras requerem autorização.';
                    infoElement.className = 'form-text text-warning';
                    document.getElementById('submit-btn').disabled = false;
                    
                    if (!isSupervisorOrAdmin(currentUser)) {
                        currentExtraAgendamento = {
                            data: date,
                            currentCount: count,
                            isSaturday: false
                        };
                        
                        const modal = new bootstrap.Modal(document.getElementById('extraModal'));
                        document.getElementById('modal-extra-message').textContent = 
                            'Este dia já possui 3 agendamentos. Deseja solicitar autorização para um agendamento extra?';
                        document.getElementById('modal-extra-info').textContent = 
                            'Máximo de 2 agendamentos extras por dia (total de 5).';
                        modal.show();
                    }
                } else {
                    infoElement.textContent = `Este dia possui ${count} agendamento(s).`;
                    infoElement.className = 'form-text text-muted';
                    document.getElementById('submit-btn').disabled = false;
                    currentExtraAgendamento = null;
                }
            }
        });
}

// Solicita autorização para agendamento extra
function requestExtraAuthorization() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('extraModal'));
    modal.hide();
    
    document.getElementById('modal-data').textContent = formatDate(currentExtraAgendamento.data);
    document.getElementById('modal-cliente').textContent = document.getElementById('cliente').value || "Reserva";
    
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
        
        document.querySelectorAll('.delete-blocked-day').forEach(btn => {
            btn.addEventListener('click', deleteBlockedDay);
        });
    });
}

// Adiciona um dia bloqueado
function addBlockedDay() {
    const date = prompt('Digite a data a ser bloqueada (YYYY-MM-DD):');
    if (!date) return;
    
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
    document.getElementById('responsavel-container').style.display = 'none';
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
    
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
}

// Adicione esta função para logout
function setupLogout() {
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-sm btn-outline-danger ms-2';
    logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right"></i> Sair';
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.reload();
        });
    });
    
    document.getElementById('user-info').appendChild(logoutBtn);
}
