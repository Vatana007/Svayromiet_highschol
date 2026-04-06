document.addEventListener('DOMContentLoaded', () => {
    const ADMIN_VERSION = '1.0.0'; // Glassmorphism Version
    const API_URL = "https://script.google.com/macros/s/AKfycbxpeIu-fjcJa2Xy-hMyhSR72ofeR_DWsCp7xJyT1hm-umZWe77UfcdgtNW1lYHqL93v_A/exec";
    let cache = { students: null, schedule: null, exams: null, reqs: null, announcements: null, feedback: null };
    let debounceTimer;

        // --- 1. THEME & EXTRA FEATURES ---
    const themeBtn = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('glass_theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    themeBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('glass_theme', newTheme);
    });

    function updateClock() {
        const now = new Date();
        const hours = now.getHours();
        let greeting = 'Good Evening 🌙';
        if (hours < 12) greeting = 'Good Morning ☀️';
        else if (hours < 18) greeting = 'Good Afternoon 🌤️';

        document.getElementById('greetingText').textContent = greeting;
        document.getElementById('liveClock').innerHTML = `<i class="ri-time-line"></i> ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    setInterval(updateClock, 1000); updateClock();

    window.openCommandPalette = () => { document.getElementById('commandPalette').classList.add('active'); document.getElementById('globalSearchInput').focus(); };
    window.closeCommandPalette = () => { document.getElementById('commandPalette').classList.remove('active'); document.getElementById('globalSearchInput').value = ''; };
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCommandPalette(); } if (e.key === 'Escape') closeCommandPalette(); });
    document.getElementById('commandPalette').addEventListener('click', (e) => { if (e.target.id === 'commandPalette') closeCommandPalette(); });

    window.exportStudentsLocal = () => {
        if (!cache.students || cache.students.length === 0) return showToast("No data to export", "error");
        const headers = ["ID", "Khmer Name", "English Name", "Sex", "DOB", "Phone", "Grade", "Gen", "Section"];
        const csvRows = [headers.join(',')];
        cache.students.forEach(s => {
            const row = [s.studentId, s.khmerName, s.englishName, s.sex, s.dob ? new Date(s.dob).toLocaleDateString() : '', s.phone, s.grade, s.generation, s.section].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`);
            csvRows.push(row.join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.setAttribute('hidden', ''); a.setAttribute('href', url); a.setAttribute('download', `Students_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("CSV Downloaded!", "success");
    };

    // --- 2. AUTHENTICATION ---
    if (localStorage.getItem('primeToken')) initApp();

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('admUser').value.trim();
        const p = document.getElementById('admPass').value.trim();
        const btn = e.target.querySelector('button');
        btn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Loading...`; btn.disabled = true;

        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'adminLogin', payload: { username: u, password: p } }) });
            const json = await res.json();
            if (json.success) {
                localStorage.setItem('primeToken', json.token); localStorage.setItem('primeName', json.name); initApp();
            } else { showToast(json.message, "error"); btn.innerHTML = `Sign In <i class="ri-arrow-right-line"></i>`; btn.disabled = false; }
        } catch (e) { showToast("Connection error", "error"); btn.innerHTML = `Sign In <i class="ri-arrow-right-line"></i>`; btn.disabled = false; }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.removeItem('primeToken'); window.location.reload(); });

    function initApp() {
        document.getElementById('authLayer').classList.add('hidden');
        document.getElementById('appShell').classList.remove('hidden');
        document.getElementById('admName').textContent = localStorage.getItem('primeName') || 'Admin';
        loadStats(); prefetchData();
    }

    function prefetchData() {
        startLoading();
        Promise.all([fetchData('adminGetAllStudents', 'students'), fetchData('adminGetAllPermissionRequests', 'reqs'), fetchData('adminGetAllSchedule', 'schedule'), fetchData('adminGetAllExams', 'exams')]).then(() => {
            endLoading();
            const activeTab = document.querySelector('.nav-item.active').dataset.tab;
            if (activeTab === 'students' && cache.students) renderStudents(cache.students);
            if (activeTab === 'requests' && cache.reqs) filterReq('Pending');
        });
    }

    async function fetchData(action, cacheKey) {
        try { const res = await fetch(`${API_URL}?action=${action}`); const json = await res.json(); if (json.success) { cache[cacheKey] = json.data; return json.data; } } catch (e) { } return null;
    }

    // --- 3. NAVIGATION ---
    window.nav = (tab) => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');

        const tMap = { 'overview': 'Overview', 'students': 'Student Hub', 'scores': 'Scores Dashboard', 'schedule': 'Master Schedule', 'exams': 'Exams', 'requests': 'Permissions', 'announcements': 'News', 'feedback': 'Feedback' };
        document.getElementById('pageHeader').textContent = tMap[tab];
        document.getElementById('sideNav').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('active');

        if (tab === 'students') { if (cache.students) renderStudents(cache.students); else loadStudents(); }
        if (tab === 'schedule') { if (cache.schedule) document.getElementById('btn-list').click(); else loadSchedule(); }
        if (tab === 'exams') { if (cache.exams) renderExams(cache.exams); else loadExams(); }
        if (tab === 'requests') { if (cache.reqs) filterReq('All'); else loadRequests(); }
        if (tab === 'announcements') loadAnnouncements();
        if (tab === 'feedback') loadFeedback();
    };

    document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', e => { e.preventDefault(); nav(n.dataset.tab); }));
    document.getElementById('openMenuBtn').addEventListener('click', () => { document.getElementById('sideNav').classList.add('open'); document.getElementById('mobileOverlay').classList.add('active'); });
    document.getElementById('closeMenuBtn').addEventListener('click', () => { document.getElementById('sideNav').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('active'); });
    document.getElementById('mobileOverlay').addEventListener('click', () => { document.getElementById('sideNav').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('active'); });

    // --- 4. EXAMS ---
    window.openExamModal = (mode = 'add') => { document.getElementById('formExam').reset(); document.getElementById('exManageType').value = mode; document.getElementById('examModalTitle').textContent = mode === 'add' ? 'Create Exam' : 'Edit Exam'; document.getElementById('examModal').classList.add('active'); };
    window.closeExamModal = () => document.getElementById('examModal').classList.remove('active');

    async function loadExams() { const data = await fetchData('adminGetAllExams', 'exams'); if (data) { populateExamFilters(data); applyExamFilters(); } }
    function renderExams(list) {
        const tb = document.getElementById('tblExams');
        if (!list || !list.length) { tb.innerHTML = '<tr><td colspan="7" class="text-center">No exams found.</td></tr>'; return; }
        const getV = (o, keys) => { for (let k of keys) { if (o[k] !== undefined && o[k] !== "") return o[k]; const m = Object.keys(o).find(x => x.toLowerCase() === k.toLowerCase()); if (m) return o[m]; } return ''; };

        tb.innerHTML = list.map((r) => {
            const idx = cache.exams.indexOf(r);
            let d = getV(r, ['Date', 'Day']); try { if (d) d = new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }); } catch (e) { }
            return `<tr>
                <td><strong>${d}</strong></td><td>${getV(r, ['Subject', 'Course']) || 'N/A'}</td>
                <td><span class="status-badge status-Pending">${getV(r, ['Type', 'ExamType']) || 'Midterm'}</span></td>
                <td>${formatTime(getV(r, ['StartTime', 'Start']))} - ${formatTime(getV(r, ['EndTime', 'End']))}</td>
                <td>${getV(r, ['Grade', 'Class'])}</td><td>${getV(r, ['Generation', 'Gen'])}</td>
                <td class="text-right">
                    <button class="icon-btn-ghost" onclick="editExam(${idx})"><i class="ri-edit-2-line"></i></button>
                    <button class="icon-btn-ghost danger" onclick="deleteExam(${idx})"><i class="ri-delete-bin-line"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    function formatTime(val) { if (!val) return ''; if (val.includes('T')) return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return val; }
    window.editExam = function (idx) {
        const r = cache.exams[idx]; if (!r) return;
        const getV = (keys) => { for (let k of keys) { if (r[k] !== undefined) return r[k]; const m = Object.keys(r).find(x => x.toLowerCase() === k.toLowerCase()); if (m) return r[m]; } return ''; };
        document.getElementById('exSubj').value = getV(['Subject', 'Course']);
        document.getElementById('exGrade').value = getV(['Grade', 'Class']);
        document.getElementById('exGen').value = getV(['Generation', 'Gen']);
        document.getElementById('exType').value = getV(['Type', 'ExamType']) || 'Midterm';
        let dVal = getV(['Date', 'Day']); try { if (dVal) dVal = new Date(dVal).toISOString().split('T')[0]; } catch (e) { }
        document.getElementById('exDate').value = dVal;
        const parseT = (v) => { if (!v) return ''; if (v.includes('T')) return new Date(v).toTimeString().slice(0, 5); const m = v.match(/(\d+):(\d+)/); if (m) { let h = parseInt(m[1]); if (v.toLowerCase().includes('pm') && h < 12) h += 12; return `${String(h).padStart(2, '0')}:${m[2]}`; } return ''; };
        document.getElementById('exStart').value = parseT(getV(['StartTime', 'Start']));
        document.getElementById('exEnd').value = parseT(getV(['EndTime', 'End']));
        document.getElementById('origExSubj').value = getV(['Subject', 'Course']);
        document.getElementById('origExDate').value = getV(['Date', 'Day']);
        document.getElementById('origExGrade').value = getV(['Grade', 'Class']);
        document.getElementById('origExGen').value = getV(['Generation', 'Gen']);
        openExamModal('update');
    };

    window.deleteExam = async (idx) => {
        const r = cache.exams[idx]; if (!r) return;
        if (!await showConfirm("Delete Exam", "Are you sure?")) return;
        try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'adminManageExam', payload: { manageType: 'delete', origSubject: r.Subject || r.Course || '', origGrade: r.Grade || r.Class || '', origDate: r.Date || r.Day || '', origGeneration: r.Generation || r.Gen || '' } }) }); showToast("Deleted", "success"); cache.exams = null; nav('exams'); } catch (e) { showToast("Error", "error"); }
    };

    const exForm = document.getElementById('formExam');
    if (exForm) {
        exForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = document.getElementById('btnSaveExam'); btn.disabled = true; btn.textContent = "Saving...";
            const p = { manageType: document.getElementById('exManageType').value, examType: document.getElementById('exType').value, subject: document.getElementById('exSubj').value, date: document.getElementById('exDate').value, grade: document.getElementById('exGrade').value, generation: document.getElementById('exGen').value, startTime: document.getElementById('exStart').value, endTime: document.getElementById('exEnd').value, origSubject: document.getElementById('origExSubj').value, origDate: document.getElementById('origExDate').value, origGrade: document.getElementById('origExGrade').value, origGeneration: document.getElementById('origExGen').value };
            try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'adminManageExam', payload: p }) }); showToast("Saved!", "success"); closeExamModal(); cache.exams = null; nav('exams'); } catch (e) { showToast("Error", "error"); } finally { btn.disabled = false; btn.textContent = "Save Exam"; }
        });
    }

    function populateExamFilters(d) {
        const sSet = new Set(), tSet = new Set(), gSet = new Set(), geSet = new Set();
        const getV = (r, keys) => { for (let k of keys) { if (r[k]) return String(r[k]).trim(); const m = Object.keys(r).find(x => x.toLowerCase() === k.toLowerCase()); if (m) return String(r[m]).trim(); } return ''; };
        d.forEach(r => { sSet.add(getV(r, ['Subject', 'Course'])); tSet.add(getV(r, ['Type', 'ExamType']) || 'Midterm'); gSet.add(getV(r, ['Grade', 'Class'])); geSet.add(getV(r, ['Generation', 'Gen'])); });
        const fill = (id, set, def) => { const el = document.getElementById(id); const cur = el.value; el.innerHTML = `<option value="All">${def}</option>` + Array.from(set).filter(x => x).sort().map(v => `<option value="${v}">${v}</option>`).join(''); if (Array.from(set).includes(cur)) el.value = cur; };
        fill('filterExSubj', sSet, 'Subjects'); fill('filterExType', tSet, 'Types'); fill('filterExGrade', gSet, 'Grades'); fill('filterExGen', geSet, 'Gens');
    }
    window.applyExamFilters = () => {
        if (!cache.exams) return;
        const s = document.getElementById('filterExSubj').value, t = document.getElementById('filterExType').value, g = document.getElementById('filterExGrade').value, ge = document.getElementById('filterExGen').value;
        const getV = (r, keys) => { for (let k of keys) { if (r[k]) return String(r[k]).trim(); const m = Object.keys(r).find(x => x.toLowerCase() === k.toLowerCase()); if (m) return String(r[m]).trim(); } return ''; };
        const f = cache.exams.filter(r => (s === 'All' || getV(r, ['Subject', 'Course']) === s) && (t === 'All' || (getV(r, ['Type', 'ExamType']) || 'Midterm') === t) && (g === 'All' || getV(r, ['Grade', 'Class']) === g) && (ge === 'All' || getV(r, ['Generation', 'Gen']) === ge));
        renderExams(f);
    };
    window.resetExamFilters = () => { ['filterExSubj', 'filterExType', 'filterExGrade', 'filterExGen'].forEach(id => document.getElementById(id).value = 'All'); applyExamFilters(); };

    // --- 5. STATS ---
    async function loadStats() {
        const res = await fetch(`${API_URL}?action=getAdminDashboardStats`); const json = await res.json();
        if (json.success) {
            document.getElementById('statStudents').textContent = json.data.totalStudents; document.getElementById('statPending').textContent = json.data.pendingPermissions; document.getElementById('statActive').textContent = json.data.activeToday;
            const b = document.getElementById('badgeReq'); if (b) { b.textContent = json.data.pendingPermissions; b.classList.toggle('hidden', json.data.pendingPermissions === 0); }
            const tb = document.getElementById('tblRecent'); if (tb) tb.innerHTML = json.data.recentPermissions.slice(0, 5).map(r => `<tr><td><strong>${r.studentId}</strong><br><small style="opacity:0.7">${r.Name || ''}</small></td><td>${r.StatusType}</td><td><span class="status-badge status-${r.Status}">${r.Status}</span></td></tr>`).join('');
        }
    }

    // --- 6. STUDENTS ---
    async function loadStudents() { const d = await fetchData('adminGetAllStudents', 'students'); if (d) renderStudents(d); }
    function renderStudents(list) {
        const tb = document.getElementById('tblStudents'); if (!tb) return;
        tb.innerHTML = list.slice(0, 100).map(s => `<tr><td><strong>${s.studentId || '-'}</strong></td><td>${s.khmerName || '-'}</td><td>${s.englishName || '-'}</td><td>${s.sex || '-'}</td><td>${s.dob ? new Date(s.dob).toLocaleDateString('en-GB') : '-'}</td><td>${s.phone || '-'}</td><td><span class="status-badge status-Pending">${s.grade || '-'}</span></td><td>${s.generation || '-'}</td><td>${s.section || '-'}</td></tr>`).join('');
    }
    document.getElementById('searchStud').addEventListener('input', (e) => {
        clearTimeout(debounceTimer); const v = e.target.value.toLowerCase();
        debounceTimer = setTimeout(() => { if (cache.students) renderStudents(cache.students.filter(s => JSON.stringify(s).toLowerCase().includes(v))); }, 300);
    });
    window.exportStudents = async (type) => { if (type === 'google_sheet') { showToast("Generating Sheet...", "info"); try { const r = await fetch(`${API_URL}?action=adminCreateStudentSheet`); const j = await r.json(); if (j.success) window.open(j.url, '_blank'); } catch (e) { } } };

    // --- 7. REQUESTS ---
    async function loadRequests() { const d = await fetchData('adminGetAllPermissionRequests', 'reqs'); if (d) filterReq('Pending'); }
    window.filterReq = (type) => {
        document.querySelectorAll('.toggle-btn').forEach(b => { b.classList.remove('active'); if (b.textContent.includes(type) || (type === 'All' && b.textContent === 'History')) b.classList.add('active'); });
        if (!cache.reqs) return;
        const tb = document.getElementById('requestListGrid'); const list = cache.reqs.filter(r => type === 'All' ? true : (r.status || r.Status || '').toLowerCase() === type.toLowerCase());
        if (!list.length) { tb.innerHTML = '<p class="text-center p-20">No requests.</p>'; return; }
        tb.innerHTML = list.map(i => {
            const id = i.id || i.transactionId; const st = i.status || i.Status || 'Pending'; const d = i.requestDate ? new Date(i.requestDate).toLocaleDateString('en-GB') : '';
            const acts = st.toLowerCase() === 'pending' ? `<button onclick="actionReq('${id}','Approved')" class="icon-btn-ghost"><i class="ri-check-line" style="color:var(--success)"></i></button><button onclick="actionReq('${id}','Rejected')" class="icon-btn-ghost"><i class="ri-close-line" style="color:var(--danger)"></i></button>` : `<span class="status-badge status-${st}">${st}</span>`;
            return `<div class="req-card" id="req-${id}">
                <div class="req-left">
                    <div class="req-avatar"><i class="ri-user-smile-line"></i></div>
                    <div><h4>${i.name || i.studentId}</h4><div class="req-meta"><i class="ri-calendar-event-line"></i> ${d} &bull; ${i.duration || 'N/A'}</div></div>
                </div>
                <div class="req-actions">${acts}</div>
            </div>`;
        }).join('');
    };
    window.actionReq = async (id, st) => {
        if (!await showConfirm(`Mark as ${st}?`, `Change status to ${st}?`)) return;
        try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'adminHandleRequest', payload: { id: String(id), status: st } }) }); showToast("Updated", "success"); const item = cache.reqs.find(r => String(r.id || r.transactionId) === String(id)); if (item) item.status = st; filterReq(document.querySelector('.toggle-btn.active').textContent); } catch (e) { showToast("Error", "error"); }
    };

    // --- 8. ANNOUNCEMENTS ---
    function renderAnnouncements(list) {
        const tb = document.getElementById('listAnnouncements');
        if (!list || !list.length) {
            tb.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No news available.</p>';
            return;
        }

        tb.innerHTML = list.map(i => {
            const isA = Array.isArray(i);
            const t = isA ? i[0] : i.Title;
            const m = isA ? i[1] : i.Message;
            const d = isA ? i[2] : (i.DatePost || i.Timestamp);
            const a = isA ? i[4] : i.PostedBy;
            const id = isA ? i[3] : i.Timestamp;

            let dateStr = d;
            try { dateStr = new Date(d).toLocaleDateString('en-GB'); } catch (e) { }

            // Updated HTML structure with specific layout classes
            return `
        <div class="modern-feed-card">
            <div class="mf-header">
                <h4 class="mf-title">${t}</h4>
                <span class="mf-date">${dateStr}</span>
            </div>
            <div class="mf-body">${m}</div>
            <div class="mf-footer">
                <div class="mf-author">
                    <i class="ri-user-smile-line"></i>
                    <span>${a}</span>
                </div>
                <button class="icon-btn-ghost danger" onclick="deleteAnnouncement('${id}')" title="Delete Post">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        </div>`;
        }).join('');
    }

    const annForm = document.getElementById('formAnnounce');
    if (annForm) {
        annForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = annForm.querySelector('button'); btn.disabled = true; btn.innerHTML = "Publishing...";
            const t = document.getElementById('annTitle').value, m = document.getElementById('annMsg').value, d = document.getElementById('annDate').value;
            try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'adminPostAnnouncement', payload: { title: t, message: m, date: d } }) }); showToast("Posted!", "success"); annForm.reset(); cache.announcements = null; loadAnnouncements(); } catch (e) { showToast("Error", "error"); } finally { btn.disabled = false; btn.innerHTML = `<i class="ri-send-plane-fill"></i> Publish Post`; }
        });
    }
    window.deleteAnnouncement = async (id) => { if (!await showConfirm("Delete?", "Delete this post?")) return; try { await fetch(`${API_URL}?action=adminDeleteAnnouncement&timestamp=${id}`); cache.announcements = cache.announcements.filter(a => a.Timestamp !== id); renderAnnouncements(cache.announcements); showToast("Deleted", "success"); } catch (e) { } };

    // --- 9. SCHEDULE ---
    document.getElementById('btn-list').addEventListener('click', () => { document.getElementById('btn-list').classList.add('active'); document.getElementById('btn-table').classList.remove('active'); document.getElementById('schedule-list-wrapper').classList.remove('hidden'); document.getElementById('schedule-table-wrapper').classList.add('hidden'); if (cache.schedule) renderListSchedule(cache.schedule); });
    document.getElementById('btn-table').addEventListener('click', () => { document.getElementById('btn-table').classList.add('active'); document.getElementById('btn-list').classList.remove('active'); document.getElementById('schedule-list-wrapper').classList.add('hidden'); document.getElementById('schedule-table-wrapper').classList.remove('hidden'); renderTableSchedule(); });

    async function loadSchedule() { const d = await fetchData('adminGetAllSchedule', 'schedule'); if (d) renderListSchedule(d); }
    function renderListSchedule(list) {
        const tb = document.getElementById('tblSchedule'); if (!tb) return;
        const getV = (item, keys) => { for (let k of keys) { if (item[k]) return item[k]; const f = Object.keys(item).find(key => key.toLowerCase() === k.toLowerCase()); if (f) return item[f]; } return ''; };
        tb.innerHTML = list.map(s => `<tr><td><strong>${getV(s, ['DayOfWeek', 'Day'])}</strong></td><td>${formatTime(getV(s, ['StartTime', 'Start']))} - ${formatTime(getV(s, ['EndTime', 'End']))}</td><td><span class="status-badge status-Approved">${getV(s, ['CourseName', 'Subject', 'Course'])}</span></td><td>${getV(s, ['Teacher'])}</td><td>${getV(s, ['Grade', 'Class'])}</td></tr>`).join('');
    }
    function renderTableSchedule() {
        const tb = document.getElementById('master-schedule-table'); if (!cache.schedule) return;
        const getV = (item, keys) => { for (let k of keys) { if (item[k]) return item[k]; const f = Object.keys(item).find(key => key.toLowerCase() === k.toLowerCase()); if (f) return item[f]; } return ''; };
        const clean = cache.schedule.map(r => ({ Day: getV(r, ['Day', 'DayOfWeek']), Sub: getV(r, ['Subject', 'CourseName']), T: getV(r, ['Teacher']), G: getV(r, ['Grade', 'Class']), R: getV(r, ['Room']), Start: getDecimalHour(getV(r, ['Start', 'StartTime'])), End: getDecimalHour(getV(r, ['End', 'EndTime'])), rS: formatTime(getV(r, ['Start', 'StartTime'])), rE: formatTime(getV(r, ['End', 'EndTime'])) }));

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let h = `<thead><tr><th class="time-cell">Time</th>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>`;
        for (let i = 7; i < 18; i++) {
            h += `<tr><td class="time-cell">${i > 12 ? i - 12 : i}:00 ${i >= 12 ? 'PM' : 'AM'}</td>`;
            days.forEach(d => {
                const evs = clean.filter(e => e.Day === d && e.Start !== -1 && e.Start < (i + 1) && e.End > i);
                h += `<td class="grid-cell">${evs.map(e => `<div class="event-pill" onclick="openScheduleModal('${e.Sub}','${e.T}','${e.G}','${e.R}','${e.rS}-${e.rE}')"><div class="ev-title">${e.Sub}</div></div>`).join('')}</td>`;
            }); h += `</tr>`;
        } tb.innerHTML = h + `</tbody>`;
    }
    function getDecimalHour(v) { if (!v) return -1; if (v.includes('T')) return new Date(v).getHours(); let m = v.match(/(\d+):/); if (m) { let h = parseInt(m[1]); if (v.toLowerCase().includes('pm') && h < 12) h += 12; return h; } return -1; }

    window.openScheduleModal = (s, t, g, r, time) => { document.getElementById('modalSchedTitle').textContent = s; document.getElementById('modalSchedTeacher').textContent = t; document.getElementById('modalSchedGrade').textContent = g; document.getElementById('modalSchedRoom').textContent = r; document.getElementById('modalSchedTime').textContent = time; document.getElementById('scheduleModal').classList.add('active'); };
    window.closeScheduleModal = () => document.getElementById('scheduleModal').classList.remove('active');

    // --- 10. FEEDBACK ---
    async function loadFeedback() { const d = await fetchData('adminGetAllFeedback', 'feedback'); if (d) document.getElementById('tblFeedback').innerHTML = d.map(f => `<tr><td>${new Date(f.Timestamp).toLocaleDateString()}</td><td><strong>${f.StudentID}</strong></td><td><span class="status-badge status-Pending">${f.Category}</span></td><td>${f.Message}</td></tr>`).join(''); }

    // --- UTILS ---
    window.refreshAll = () => { cache = { students: null, schedule: null, exams: null, reqs: null, announcements: null, feedback: null }; prefetchData(); };
    function startLoading() { document.getElementById('globalLoader').classList.add('loading-active'); }
    function endLoading() { document.getElementById('globalLoader').classList.add('loading-complete'); setTimeout(() => document.getElementById('globalLoader').className = 'glass-loader', 300); }
    function showToast(msg, type = 'success') { const c = document.getElementById('toast-container'); const i = type === 'error' ? 'ri-error-warning-fill' : 'ri-check-line'; const t = document.createElement('div'); t.className = `toast-card toast-${type}`; t.innerHTML = `<i class="${i}"></i> ${msg}`; c.appendChild(t); setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, 3000); }
    function showConfirm(title, msg) { return new Promise(r => { const m = document.getElementById('confirmModal'); m.querySelector('h3').textContent = title; m.querySelector('p').textContent = msg; m.classList.add('active'); const y = document.getElementById('btnConfirm'), n = document.getElementById('btnCancel'); const handle = (c) => { m.classList.remove('active'); y.replaceWith(y.cloneNode(true)); n.replaceWith(n.cloneNode(true)); r(c); }; document.getElementById('btnConfirm').addEventListener('click', () => handle(true)); document.getElementById('btnCancel').addEventListener('click', () => handle(false)); }); }
    // --- QUICK FIX: CLICK LOGO TO RELOAD PAGE ---
    const brandLogo = document.querySelector('.brand-info');
    if (brandLogo) {
        brandLogo.addEventListener('click', () => {
            window.location.reload(); // Hard reloads the entire application
        });
    }
});
