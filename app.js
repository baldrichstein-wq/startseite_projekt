document.addEventListener('DOMContentLoaded', () => {
    // =====================================================
    //  DOM Elements
    // =====================================================
    const loginGate       = document.getElementById('login-gate');
    const portalContent   = document.getElementById('portal-content');
    const loginGateForm   = document.getElementById('login-gate-form');
    const gateError       = document.getElementById('gate-error');
    const gateSubmitBtn   = document.getElementById('gate-submit-btn');

    const projectsGrid    = document.getElementById('projects-grid');
    const searchInput     = document.getElementById('search-input');
    const clearSearchBtn  = document.getElementById('clear-search');
    const filterButtons   = document.querySelectorAll('.filter-btn');
    const totalCountEl    = document.getElementById('total-count');
    const onlineCountEl   = document.getElementById('online-count');

    const addProjectBtn   = document.getElementById('btn-add-project');
    const addProjectModal = document.getElementById('add-project-modal');
    const closeModalBtn   = document.getElementById('btn-close-modal');
    const addProjectForm  = document.getElementById('add-project-form');

    const logoutBtn       = document.getElementById('btn-logout');
    const userDisplayName = document.getElementById('user-display-name');
    const roleBadge       = document.getElementById('role-badge');

    // Admin controls
    const userMgmtBtn          = document.getElementById('btn-user-mgmt');
    const userMgmtModal        = document.getElementById('user-mgmt-modal');
    const closeUserMgmtBtn     = document.getElementById('btn-close-user-mgmt');
    const createUserForm       = document.getElementById('create-user-form');
    const createUserError      = document.getElementById('create-user-error');
    const createUserSuccess    = document.getElementById('create-user-success');
    const usersTableBody       = document.getElementById('users-table-body');

    // =====================================================
    //  State
    // =====================================================
    let projects      = [];
    let activeCategory = 'all';
    let searchQuery    = '';
    let currentUser    = null; // { username, role }

    // =====================================================
    //  Boot
    // =====================================================
    init();

    async function init() {
        const user = await checkAuthStatus();
        if (user && user.loggedIn) {
            if (user.role === 'Gast') {
                // Gast gets login gate with error
                showLoginGate();
                showGateError('Kein Zugang. Bitte Administrator um Rechtezuweisung bitten.');
                return;
            }
            currentUser = user;
            showPortal();
            applyRoleUI();
            await loadProjects();
            setupEventListeners();
        } else {
            showLoginGate();
            setupLoginGateListener();
        }
    }

    // =====================================================
    //  Auth check
    // =====================================================
    async function checkAuthStatus() {
        try {
            const res = await fetch('/api/auth/me');
            return await res.json();
        } catch {
            return { loggedIn: false };
        }
    }

    // =====================================================
    //  UI Visibility helpers
    // =====================================================
    function showLoginGate() {
        loginGate.style.display = 'flex';
        portalContent.style.display = 'none';
    }

    function showPortal() {
        loginGate.style.display = 'none';
        portalContent.style.display = 'flex';
    }

    function showGateError(msg) {
        gateError.textContent = msg;
        gateError.style.display = 'block';
    }

    // =====================================================
    //  Role-based UI setup
    // =====================================================
    function applyRoleUI() {
        if (!currentUser) return;

        userDisplayName.textContent = currentUser.username;
        roleBadge.textContent = currentUser.role;
        roleBadge.className = `role-badge ${currentUser.role}`;

        const role = currentUser.role;

        // Admin & Mitarbeiter can add projects
        if (role === 'Admin' || role === 'Mitarbeiter') {
            addProjectBtn.style.display = 'flex';
        } else {
            addProjectBtn.style.display = 'none';
        }

        // Only Admin sees user management
        if (role === 'Admin') {
            userMgmtBtn.style.display = 'flex';
        } else {
            userMgmtBtn.style.display = 'none';
        }
    }

    // =====================================================
    //  Login Gate form submit
    // =====================================================
    function setupLoginGateListener() {
        loginGateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            gateError.style.display = 'none';

            const username = document.getElementById('gate-username').value.trim();
            const password = document.getElementById('gate-password').value;

            gateSubmitBtn.disabled = true;
            gateSubmitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Anmelden...';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (res.ok) {
                    currentUser = { username: data.username, role: data.role };

                    if (data.role === 'Gast') {
                        showGateError('Kein Zugang. Bitte Administrator um Rechtezuweisung bitten.');
                        gateSubmitBtn.disabled = false;
                        gateSubmitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Anmelden';
                        return;
                    }

                    showPortal();
                    applyRoleUI();
                    await loadProjects();
                    setupEventListeners();
                } else {
                    showGateError(data.error || 'Anmeldung fehlgeschlagen.');
                    gateSubmitBtn.disabled = false;
                    gateSubmitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Anmelden';
                }
            } catch {
                showGateError('Netzwerkfehler. Server erreichbar?');
                gateSubmitBtn.disabled = false;
                gateSubmitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Anmelden';
            }
        });
    }

    // =====================================================
    //  Load Projects
    // =====================================================
    async function loadProjects() {
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) throw new Error('Laden fehlgeschlagen');
            projects = await res.json();
        } catch (err) {
            console.warn('Projektefehler:', err.message);
            projects = [];
        }
        renderProjects();
        checkProjectsStatus();
    }

    // =====================================================
    //  Render Projects Grid
    // =====================================================
    function renderProjects() {
        const filtered = projects.filter(p => {
            const matchCat  = activeCategory === 'all' || p.category === activeCategory;
            const matchSrch = p.name.toLowerCase().includes(searchQuery) ||
                              (p.description && p.description.toLowerCase().includes(searchQuery)) ||
                              p.category.toLowerCase().includes(searchQuery);
            return matchCat && matchSrch;
        });

        totalCountEl.textContent  = projects.length;
        onlineCountEl.textContent = projects.filter(p => p.status === 'online').length;

        if (filtered.length === 0) {
            projectsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-search"></i>
                    <p>Keine Projekte gefunden.</p>
                </div>`;
            return;
        }

        const canDelete = currentUser && currentUser.role === 'Admin';

        projectsGrid.innerHTML = filtered.map(p => {
            const isExternal  = p.url && p.url.startsWith('http');
            const targetAttr  = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
            const deleteBtn   = canDelete && p.id !== 'portal'
                ? `<button class="delete-project-btn" data-id="${p.id}" title="Löschen" aria-label="Projekt löschen">
                       <i class="bi bi-trash-fill"></i>
                   </button>` : '';

            return `
                <div class="project-card-wrapper" style="position:relative;">
                    ${deleteBtn}
                    <a href="${p.url}" ${targetAttr} class="project-card" data-id="${p.id}">
                        <div class="card-header">
                            <div class="project-icon-wrapper">
                                <i class="bi ${p.icon || 'bi-link-45deg'}"></i>
                            </div>
                            <div class="status-indicator ${p.status || 'checking'}" id="status-${p.id}">
                                <span class="status-dot"></span>
                                <span class="status-text">${getStatusLabel(p.status)}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <h2 class="project-title">${escapeHtml(p.name)}</h2>
                            <p class="project-desc">${escapeHtml(p.description || '')}</p>
                        </div>
                        <div class="card-footer">
                            <span class="project-category">${escapeHtml(p.category)}</span>
                            <span class="launch-btn">Öffnen <i class="bi bi-arrow-right"></i></span>
                        </div>
                    </a>
                </div>`;
        }).join('');

        // Attach delete listeners (Admin only)
        if (canDelete) {
            document.querySelectorAll('.delete-project-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm('Möchtest du dieses Projekt wirklich löschen?')) {
                        await deleteProject(btn.getAttribute('data-id'));
                    }
                });
            });
        }
    }

    function getStatusLabel(s) {
        return { online: 'Online', offline: 'Offline', checking: 'Prüfe...' }[s] || 'Unbekannt';
    }

    // =====================================================
    //  Status ping
    // =====================================================
    async function checkProjectsStatus() {
        projects.forEach(async (p) => {
            if (!p.url || p.url === '#' || !p.url.startsWith('http')) {
                updateProjectStatus(p.id, 'online');
                return;
            }
            try {
                const ctrl = new AbortController();
                const tid  = setTimeout(() => ctrl.abort(), 4000);
                await fetch(p.url, { method: 'GET', mode: 'no-cors', signal: ctrl.signal });
                clearTimeout(tid);
                updateProjectStatus(p.id, 'online');
            } catch {
                updateProjectStatus(p.id, 'offline');
            }
        });
    }

    function updateProjectStatus(id, status) {
        const p = projects.find(x => x.id === id);
        if (p) {
            p.status = status;
            const el = document.getElementById(`status-${id}`);
            if (el) {
                el.className = `status-indicator ${status}`;
                el.querySelector('.status-text').textContent = getStatusLabel(status);
            }
            onlineCountEl.textContent = projects.filter(x => x.status === 'online').length;
        }
    }

    // =====================================================
    //  Delete project
    // =====================================================
    async function deleteProject(id) {
        try {
            const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                projects = projects.filter(p => p.id !== id);
                renderProjects();
            } else {
                alert('Fehler: ' + data.error);
            }
        } catch {
            alert('Netzwerkfehler beim Löschen.');
        }
    }

    // =====================================================
    //  Event Listeners
    // =====================================================
    function setupEventListeners() {
        // Search
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
            renderProjects();
        });
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearSearchBtn.style.display = 'none';
            searchInput.focus();
            renderProjects();
        });

        // Category filter
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeCategory = btn.getAttribute('data-category');
                renderProjects();
            });
        });

        // Add project modal
        addProjectBtn.addEventListener('click', () => openModal(addProjectModal));
        closeModalBtn.addEventListener('click',  () => closeModal(addProjectModal, addProjectForm));
        addProjectModal.addEventListener('click', (e) => { if (e.target === addProjectModal) closeModal(addProjectModal, addProjectForm); });

        // Add project form
        addProjectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                name:        document.getElementById('new-project-name').value,
                url:         document.getElementById('new-project-url').value,
                description: document.getElementById('new-project-desc').value,
                category:    document.getElementById('new-project-category').value,
                icon:        document.getElementById('new-project-icon').value
            };
            try {
                const res  = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const data = await res.json();
                if (res.ok) {
                    projects.push(data);
                    renderProjects();
                    closeModal(addProjectModal, addProjectForm);
                    checkProjectsStatus();
                } else {
                    alert('Fehler: ' + data.error);
                }
            } catch {
                alert('Netzwerkfehler beim Hinzufügen.');
            }
        });

        // Logout
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch {}
            currentUser = null;
            showLoginGate();
            setupLoginGateListener();
        });

        // User management modal (Admin only)
        if (userMgmtBtn) {
            userMgmtBtn.addEventListener('click', async () => {
                openModal(userMgmtModal);
                await loadUsers();
            });
        }
        if (closeUserMgmtBtn) {
            closeUserMgmtBtn.addEventListener('click', () => closeModal(userMgmtModal, createUserForm));
        }
        if (userMgmtModal) {
            userMgmtModal.addEventListener('click', (e) => {
                if (e.target === userMgmtModal) closeModal(userMgmtModal, createUserForm);
            });
        }

        // Create user form
        if (createUserForm) {
            createUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                createUserError.style.display   = 'none';
                createUserSuccess.style.display = 'none';

                const body = {
                    username: document.getElementById('new-username').value.trim(),
                    password: document.getElementById('new-user-password').value,
                    role:     document.getElementById('new-user-role').value
                };

                try {
                    const res  = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                    const data = await res.json();
                    if (res.ok) {
                        createUserSuccess.textContent  = `Benutzer "${body.username}" erfolgreich angelegt.`;
                        createUserSuccess.style.display = 'block';
                        createUserForm.reset();
                        await loadUsers();
                    } else {
                        createUserError.textContent  = data.error;
                        createUserError.style.display = 'block';
                    }
                } catch {
                    createUserError.textContent  = 'Netzwerkfehler.';
                    createUserError.style.display = 'block';
                }
            });
        }
    }

    // =====================================================
    //  User Management: Load & Render
    // =====================================================
    async function loadUsers() {
        usersTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Lade...</td></tr>';
        try {
            const res   = await fetch('/api/admin/users');
            const users = await res.json();
            if (!res.ok) throw new Error(users.error);

            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Keine Benutzer gefunden.</td></tr>';
                return;
            }

            usersTableBody.innerHTML = users.map(u => `
                <tr data-uid="${u.id}">
                    <td>#${u.id}</td>
                    <td><strong>${escapeHtml(u.username)}</strong></td>
                    <td>
                        <select class="role-select-inline" data-uid="${u.id}">
                            ${['Admin','Mitarbeiter','Benutzer','Gast'].map(r =>
                                `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`
                            ).join('')}
                        </select>
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-save-role" data-uid="${u.id}"><i class="bi bi-check-lg"></i> Speichern</button>
                            <button class="btn-delete-user" data-uid="${u.id}" data-username="${escapeHtml(u.username)}"><i class="bi bi-trash"></i> Löschen</button>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Save role buttons
            document.querySelectorAll('.btn-save-role').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const uid  = btn.getAttribute('data-uid');
                    const role = document.querySelector(`.role-select-inline[data-uid="${uid}"]`).value;
                    try {
                        const res  = await fetch(`/api/admin/users/${uid}/role`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ role })
                        });
                        const data = await res.json();
                        if (res.ok) {
                            createUserSuccess.textContent  = `Rolle erfolgreich geändert.`;
                            createUserSuccess.style.display = 'block';
                            setTimeout(() => createUserSuccess.style.display = 'none', 3000);
                        } else {
                            alert('Fehler: ' + data.error);
                        }
                    } catch {
                        alert('Netzwerkfehler.');
                    }
                });
            });

            // Delete user buttons
            document.querySelectorAll('.btn-delete-user').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const uid      = btn.getAttribute('data-uid');
                    const username = btn.getAttribute('data-username');
                    if (!confirm(`Benutzer "${username}" wirklich löschen?`)) return;
                    try {
                        const res  = await fetch(`/api/admin/users/${uid}`, { method: 'DELETE' });
                        const data = await res.json();
                        if (res.ok) {
                            await loadUsers();
                        } else {
                            alert('Fehler: ' + data.error);
                        }
                    } catch {
                        alert('Netzwerkfehler.');
                    }
                });
            });

        } catch (err) {
            usersTableBody.innerHTML = `<tr><td colspan="4" style="color: var(--danger);">${err.message}</td></tr>`;
        }
    }

    // =====================================================
    //  Modal helpers
    // =====================================================
    function openModal(modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal(modal, form) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        if (form) form.reset();
        if (createUserError)  { createUserError.style.display = 'none'; }
        if (createUserSuccess) { createUserSuccess.style.display = 'none'; }
    }

    // =====================================================
    //  Utility: HTML escape
    // =====================================================
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }
});
