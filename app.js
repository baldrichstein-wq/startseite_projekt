document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const projectsGrid = document.getElementById('projects-grid');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const totalCountEl = document.getElementById('total-count');
    const onlineCountEl = document.getElementById('online-count');
    
    // Modals
    const addProjectBtn = document.getElementById('btn-add-project');
    const addProjectModal = document.getElementById('add-project-modal');
    const closeModalBtn = document.getElementById('btn-close-modal');
    const addProjectForm = document.getElementById('add-project-form');

    const loginTriggerBtn = document.getElementById('btn-login-trigger');
    const loginModal = document.getElementById('login-modal');
    const closeLoginBtn = document.getElementById('btn-close-login');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // User Panel Header Elements
    const usernameBadge = document.getElementById('username-badge');
    const userDisplayName = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('btn-logout');

    let projects = [];
    let activeCategory = 'all';
    let searchQuery = '';
    let isLoggedIn = false;

    // Static Fallback Data
    const fallbackProjects = [
        {
            "id": "portal",
            "name": "Projekt-Portal (Lokaler Modus)",
            "description": "Übersichtsseite zur schnellen Navigation. Sie läuft ohne Backend-Verbindung.",
            "url": "#",
            "category": "Infrastruktur",
            "icon": "bi-grid-1x2-fill",
            "status": "online"
        }
    ];

    // Initialize Web App
    init();

    async function init() {
        await checkAuthStatus();
        await loadProjects();
        setupEventListeners();
    }

    // Check login status on load
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            
            isLoggedIn = data.loggedIn;
            if (isLoggedIn) {
                userDisplayName.textContent = data.username;
                usernameBadge.style.display = 'inline-flex';
                logoutBtn.style.display = 'inline-block';
                loginTriggerBtn.style.display = 'none';
                addProjectBtn.style.display = 'flex'; // Show add button
            } else {
                usernameBadge.style.display = 'none';
                logoutBtn.style.display = 'none';
                loginTriggerBtn.style.display = 'inline-block';
                addProjectBtn.style.display = 'none'; // Hide add button if not logged in
            }
        } catch (error) {
            console.warn('Authentifizierungs-Check fehlgeschlagen (evtl. statischer Betrieb):', error.message);
            // In static fallback mode, we hide add button to prevent confusing the user
            addProjectBtn.style.display = 'none';
        }
    }

    // Load projects from DB API or Fallback
    async function loadProjects() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) throw new Error('Konnte Datenbank-Projekte nicht laden');
            projects = await response.json();
        } catch (error) {
            console.warn('Verwende Fallback-Projektdaten:', error.message);
            projects = [...fallbackProjects];
        }

        renderProjects();
        checkProjectsStatus();
    }

    // Render projects grid
    function renderProjects() {
        const filtered = projects.filter(project => {
            const matchesCategory = activeCategory === 'all' || project.category === activeCategory;
            const matchesSearch = project.name.toLowerCase().includes(searchQuery) ||
                                  (project.description && project.description.toLowerCase().includes(searchQuery)) ||
                                  project.category.toLowerCase().includes(searchQuery);
            return matchesCategory && matchesSearch;
        });

        // Update stats
        totalCountEl.textContent = projects.length;
        const onlineCount = projects.filter(p => p.status === 'online').length;
        onlineCountEl.textContent = onlineCount;

        if (filtered.length === 0) {
            projectsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-search"></i>
                    <p>Keine Projekte gefunden, die deiner Suche entsprechen.</p>
                </div>
            `;
            return;
        }

        projectsGrid.innerHTML = filtered.map(project => {
            const isExternal = project.url && project.url.startsWith('http');
            const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
            
            // Render delete button only if logged in, and project is not the main portal
            const deleteBtnHtml = (isLoggedIn && project.id !== 'portal') 
                ? `<button class="delete-project-btn" data-id="${project.id}" title="Projekt löschen" aria-label="Projekt löschen">
                     <i class="bi bi-trash-fill"></i>
                   </button>` 
                : '';

            return `
                <div class="project-card-wrapper" style="position: relative;">
                    ${deleteBtnHtml}
                    <a href="${project.url}" ${targetAttr} class="project-card" data-id="${project.id}">
                        <div class="card-header">
                            <div class="project-icon-wrapper">
                                <i class="bi ${project.icon || 'bi-link-45deg'}"></i>
                            </div>
                            <div class="status-indicator ${project.status || 'checking'}" id="status-${project.id}">
                                <span class="status-dot"></span>
                                <span class="status-text">${getStatusLabel(project.status)}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <h2 class="project-title">${escapeHtml(project.name)}</h2>
                            <p class="project-desc">${escapeHtml(project.description || '')}</p>
                        </div>
                        <div class="card-footer">
                            <span class="project-category">${escapeHtml(project.category)}</span>
                            <span class="launch-btn">Öffnen <i class="bi bi-arrow-right"></i></span>
                        </div>
                    </a>
                </div>
            `;
        }).join('');

        // Attach Delete Listeners
        if (isLoggedIn) {
            document.querySelectorAll('.delete-project-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const projectId = btn.getAttribute('data-id');
                    if (confirm('Möchtest du dieses Projekt wirklich löschen?')) {
                        await deleteProject(projectId);
                    }
                });
            });
        }
    }

    function getStatusLabel(status) {
        switch (status) {
            case 'online': return 'Online';
            case 'offline': return 'Offline';
            case 'checking': return 'Prüfe...';
            default: return 'Unbekannt';
        }
    }

    // Ping check for projects
    async function checkProjectsStatus() {
        projects.forEach(async (project) => {
            if (project.url === '#' || !project.url.startsWith('http')) {
                updateProjectStatus(project.id, 'online');
                return;
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                await fetch(project.url, {
                    method: 'GET',
                    mode: 'no-cors',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                updateProjectStatus(project.id, 'online');
            } catch (error) {
                updateProjectStatus(project.id, 'offline');
            }
        });
    }

    function updateProjectStatus(projectId, status) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.status = status;
            
            const indicatorEl = document.getElementById(`status-${projectId}`);
            if (indicatorEl) {
                indicatorEl.className = `status-indicator ${status}`;
                indicatorEl.querySelector('.status-text').textContent = getStatusLabel(status);
            }
            
            const onlineCount = projects.filter(p => p.status === 'online').length;
            onlineCountEl.textContent = onlineCount;
        }
    }

    // Delete project API request
    async function deleteProject(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (response.ok) {
                projects = projects.filter(p => p.id !== projectId);
                renderProjects();
            } else {
                alert('Fehler beim Löschen: ' + data.error);
            }
        } catch (error) {
            alert('Netzwerkfehler beim Löschen des Projekts.');
        }
    }

    // Event Listeners Setup
    function setupEventListeners() {
        // Search Input
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
            renderProjects();
        });

        // Clear Search
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearSearchBtn.style.display = 'none';
            searchInput.focus();
            renderProjects();
        });

        // Categories Filter
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                activeCategory = button.getAttribute('data-category');
                renderProjects();
            });
        });

        // Modal triggers
        addProjectBtn.addEventListener('click', () => {
            addProjectModal.classList.add('active');
            addProjectModal.setAttribute('aria-hidden', 'false');
        });

        const closeAddModal = () => {
            addProjectModal.classList.remove('active');
            addProjectModal.setAttribute('aria-hidden', 'true');
            addProjectForm.reset();
        };

        closeModalBtn.addEventListener('click', closeAddModal);
        addProjectModal.addEventListener('click', (e) => {
            if (e.target === addProjectModal) closeAddModal();
        });

        // Login Modal triggers
        loginTriggerBtn.addEventListener('click', () => {
            loginModal.classList.add('active');
            loginModal.setAttribute('aria-hidden', 'false');
            loginError.style.display = 'none';
        });

        const closeLoginModal = () => {
            loginModal.classList.remove('active');
            loginModal.setAttribute('aria-hidden', 'true');
            loginForm.reset();
            loginError.style.display = 'none';
        };

        closeLoginBtn.addEventListener('click', closeLoginModal);
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) closeLoginModal();
        });

        // Add Project Form Submit
        addProjectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('new-project-name').value;
            const url = document.getElementById('new-project-url').value;
            const description = document.getElementById('new-project-desc').value;
            const category = document.getElementById('new-project-category').value;
            const icon = document.getElementById('new-project-icon').value;

            try {
                const response = await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, url, description, category, icon })
                });

                const data = await response.json();
                if (response.ok) {
                    projects.push(data);
                    renderProjects();
                    closeAddModal();
                    // trigger ping checking for new item
                    checkProjectsStatus();
                } else {
                    alert('Fehler: ' + data.error);
                }
            } catch (error) {
                alert('Projekt konnte nicht im Backend gespeichert werden.');
            }
        });

        // Login Form Submit
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                if (response.ok) {
                    closeLoginModal();
                    await checkAuthStatus();
                    await loadProjects(); // reload to get delete permissions
                } else {
                    loginError.textContent = data.error;
                    loginError.style.display = 'block';
                }
            } catch (error) {
                loginError.textContent = 'Netzwerkfehler beim Anmelden.';
                loginError.style.display = 'block';
            }
        });

        // Logout
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/auth/logout', { method: 'POST' });
                if (response.ok) {
                    await checkAuthStatus();
                    await loadProjects(); // reload to update views/permissions
                }
            } catch (error) {
                console.error('Logout fehlgeschlagen:', error);
            }
        });
    }

    // Helper: Escape HTML strings to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }
});
