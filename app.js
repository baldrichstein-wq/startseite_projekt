document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const projectsGrid   = document.getElementById('projects-grid');
    const searchInput    = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterButtons  = document.querySelectorAll('.filter-btn');
    const totalCountEl   = document.getElementById('total-count');
    const onlineCountEl  = document.getElementById('online-count');

    let projects      = [];
    let activeCategory = 'all';
    let searchQuery    = '';

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

    // Boot
    init();

    async function init() {
        await loadProjects();
        setupEventListeners();
    }

    // Load projects from API or fallback
    async function loadProjects() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) throw new Error('Laden fehlgeschlagen');
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
            const matchesSearch   = project.name.toLowerCase().includes(searchQuery) ||
                                    (project.description && project.description.toLowerCase().includes(searchQuery)) ||
                                    project.category.toLowerCase().includes(searchQuery);
            return matchesCategory && matchesSearch;
        });

        // Update stats
        totalCountEl.textContent  = projects.length;
        onlineCountEl.textContent = projects.filter(p => p.status === 'online').length;

        if (filtered.length === 0) {
            projectsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-search"></i>
                    <p>Keine Projekte gefunden, die deiner Suche entsprechen.</p>
                </div>`;
            return;
        }

        projectsGrid.innerHTML = filtered.map(project => {
            const isExternal = project.url && project.url.startsWith('http');
            const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';

            return `
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
                </a>`;
        }).join('');
    }

    function getStatusLabel(status) {
        return { online: 'Online', offline: 'Offline', checking: 'Prüfe...' }[status] || 'Unbekannt';
    }

    // Ping check for project status
    async function checkProjectsStatus() {
        projects.forEach(async (project) => {
            if (!project.url || project.url === '#' || !project.url.startsWith('http')) {
                updateProjectStatus(project.id, 'online');
                return;
            }
            try {
                const controller = new AbortController();
                const timeoutId  = setTimeout(() => controller.abort(), 4000);
                await fetch(project.url, { method: 'GET', mode: 'no-cors', signal: controller.signal });
                clearTimeout(timeoutId);
                updateProjectStatus(project.id, 'online');
            } catch {
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
            onlineCountEl.textContent = projects.filter(p => p.status === 'online').length;
        }
    }

    // Event Listeners
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
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                activeCategory = button.getAttribute('data-category');
                renderProjects();
            });
        });
    }

    // Helper: escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }
});
