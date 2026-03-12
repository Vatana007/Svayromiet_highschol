document.addEventListener('DOMContentLoaded', function () {
    const APP_VERSION = '1.0.0';

    function checkAppVersion() {
        const storedVersion = localStorage.getItem('app_version');

        // If the version in the browser doesn't match the version in this code
        if (storedVersion !== APP_VERSION) {
            console.log('New version detected. Forcing logout...');

            // 1. Clear Authentication Data
            localStorage.removeItem('token');
            localStorage.removeItem('studentProfile');
            localStorage.removeItem('studentSchedule');

            // 2. Save the new version
            localStorage.setItem('app_version', APP_VERSION);

            // 3. If they were previously using the app (storedVersion exists), reload to login
            if (storedVersion) {
                window.location.reload();
            }
        }
    }
    checkAppVersion();
    // --- CONFIGURATION ---
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxpeIu-fjcJa2Xy-hMyhSR72ofeR_DWsCp7xJyT1hm-umZWe77UfcdgtNW1lYHqL93v_A/exec';
    const ALL_SEMESTERS = ['1', '2'];
    let currentSemester = ALL_SEMESTERS[ALL_SEMESTERS.length - 1];
    let lastFocusedElement = null;
    let resetState = { studentId: null, otp: null };
    let profileNavHistory = [];
    let ptrState = {
        isDragging: false,
        startY: 0,
        pullDistance: 0,
        isRefreshing: false
    };
    let clockInterval = null;
    let deferredInstallPrompt = null;

    // --- TRANSLATION DATA ---
    let translations = {};

    // --- NUMBER TRANSLATION HELPER ---
    function formatNumber(num) {
        if (num === null || num === undefined) return '';
        const str = num.toString();
        const lang = localStorage.getItem('language') || 'km';

        if (lang === 'km') {
            const arabic = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
            const khmer = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
            return str.replace(/[0-9]/g, d => khmer[arabic.indexOf(d)]);
        }
        // If English, return as is (Arabic numerals)
        return str;
    }

    // --- STATUS TRANSLATION HELPER ---
    function getTranslatedStatus(status) {
        if (!status) return '';
        const lowerStatus = status.toLowerCase();
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        if (lowerStatus === 'pending') return t.status_pending || 'Pending';
        if (lowerStatus === 'approved') return t.status_approved || 'Approved';
        if (lowerStatus === 'rejected') return t.status_rejected || 'Rejected';
        if (lowerStatus === 'withdrawn') return t.status_withdrawn || 'Withdrawn';

        return status; // Return original text if no match found
    }

    // --- HELPERS ---
    function parseTime(t) {
        if (!t) return 0;
        if (t instanceof Date) return t.getHours() + t.getMinutes() / 60;
        if (typeof t === 'string') {
            const [h, m] = t.split(':').map(Number);
            return h + (m || 0) / 60;
        }
        return 0;
    }

    function formatTime(t) {
        if (!t) return '--:--';
        let h, m;

        // 1. Handle ISO Date String
        if (typeof t === 'string' && t.includes('T')) {
            const date = new Date(t);
            h = date.getHours();
            m = date.getMinutes();
        }
        // 2. Handle 12-hour format string
        else if (typeof t === 'string' && t.match(/am|pm/i)) {
            const timeParts = t.match(/(\d+):(\d+)\s*(am|pm)/i);
            if (timeParts) {
                h = parseInt(timeParts[1]);
                m = parseInt(timeParts[2]);
                const period = timeParts[3].toUpperCase();
                if (period === 'PM' && h < 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
            } else {
                return t;
            }
        }
        // 3. Handle 24-hour format string
        else if (typeof t === 'string') {
            [h, m] = t.split(':').map(Number);
        }
        // 4. Handle Date Objects
        else if (t instanceof Date) {
            h = t.getHours();
            m = t.getMinutes();
        }
        else {
            return '--:--';
        }

        if (isNaN(h) || isNaN(m)) return t;

        // --- TRANSLATION LOGIC FOR AM/PM ---
        const lang = localStorage.getItem('language') || 'km';
        const tObj = translations[lang] || {};
        const ampm = h >= 12 ? (tObj.time_pm || 'PM') : (tObj.time_am || 'AM');
        // ------------------------------------

        const h12 = h % 12 || 12;
        const mStr = m < 10 ? '0' + m : m;

        // Return number formatted + translated AM/PM
        return `${formatNumber(h12)}:${formatNumber(mStr)} <small>${ampm}</small>`;
    }

    function getSubjectColor(subject) {
        const s = (subject || '').toLowerCase();
        if (s.includes('math')) return '#FF5252';
        if (s.includes('physic')) return '#448AFF';
        if (s.includes('chem')) return '#E040FB';
        if (s.includes('bio')) return '#00E676';
        if (s.includes('history')) return '#FFAB00';
        if (s.includes('english')) return '#00BCD4';
        if (s.includes('khmer')) return '#795548';
        if (s.includes('geo')) return '#FF5722';
        if (s.includes('ict') || s.includes('comp')) return '#607D8B';
        return '#7B61FF';
    }

    function getSubjectIcon(subject) {
        const s = (subject || '').toLowerCase();
        if (s.includes('math')) return 'bx bx-calculator';
        if (s.includes('physic')) return 'bx bx-atom';
        if (s.includes('chem')) return 'bx bx-flask';
        if (s.includes('bio')) return 'bx bx-dna';
        if (s.includes('history')) return 'bx bxs-landmark';
        if (s.includes('english')) return 'bx bx-book-open';
        if (s.includes('khmer')) return 'bx bx-book-alt';
        if (s.includes('geo')) return 'bx bx-globe';
        if (s.includes('ict') || s.includes('comp')) return 'bx bx-laptop';
        return 'bx bx-book';
    }

    // --- LOAD TRANSLATIONS (WITH FALLBACK) ---
    async function loadTranslations() {
        const fallbackTranslations = {
            en: {
                app_title: "Svayromeit High School",
                attendance_present_label: "Present",
                attendance_absent_label: "Absent",
                attendance_permission_label: "Permission",
                attendance_overall_summary_title: "Overall Summary",
                result_total: "Total",
            },
            km: {
                app_title: "វិទ្យាល័យស្វាយរមៀត",
                attendance_present_label: "វត្តមាន",
                attendance_absent_label: "អវត្តមាន",
                attendance_permission_label: "ច្បាប់",
                attendance_overall_summary_title: "សង្ខេបជារួម",
                result_total: "សរុប"
            }
        };

        try {
            const response = await fetch('translations.json');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            translations = await response.json();
        } catch (error) {
            console.warn('Failed to load translations.json, using fallback.', error);
            translations = fallbackTranslations;
        }
    }

    // --- UI ELEMENTS CACHE ---
    const ui = {
        loginPage: document.getElementById('loginPage'),
        resetPage: document.getElementById('resetPage'),
        forgotPasswordLink: document.getElementById('forgotPasswordLink'),
        backToLoginLink: document.getElementById('backToLoginLink'),
        requestResetForm: document.getElementById('requestResetForm'),
        verifyOtpForm: document.getElementById('verifyOtpForm'),
        passwordResetForm: document.getElementById('passwordResetForm'),
        dashboard: document.getElementById('dashboard'),
        loginForm: document.getElementById('loginForm'),
        loginError: document.getElementById('loginError'),
        loginBtn: document.getElementById('loginButton'),
        contentSections: document.querySelectorAll('.content-section'),
        navLinks: document.querySelectorAll('.bottom-nav-link'),
        internalNavLinks: document.querySelectorAll('.nav-link-internal'),
        tabLinks: document.querySelectorAll('.tab-link'),
        mainContent: document.querySelector('.main-content'),
        languageBtn: document.getElementById('languageBtn'),
        languageView: document.getElementById('language-view'),
        languageOptions: document.querySelectorAll('.language-option'),
        currentLanguageDisplay: document.getElementById('current-language-display'),
        profileSection: document.getElementById('profile'),
        profileMainView: document.getElementById('profile-main-view'),
        myProfileView: document.getElementById('my-profile-view'),
        changePasswordView: document.getElementById('change-password-view'),
        myProfileBtn: document.getElementById('myProfileBtn'),
        changePasswordBtn: document.getElementById('changePasswordBtn'),
        passwordChangeForm: document.getElementById('passwordChangeForm'),
        logoutButton: document.getElementById('logoutButton'),
        resultSection: document.getElementById('result'),
        resultMainView: document.getElementById('result-main-view'),
        resultDetailView: document.getElementById('result-detail-view'),
        scoresTableBody: document.getElementById('scoresTableBody'),
        semesterFilterResult: document.getElementById('semesterFilterResult'),
        attendanceSection: document.getElementById('attendance'),
        attendanceMainView: document.getElementById('attendance-main-view'),
        semesterFilterAttendance: document.getElementById('semesterFilterAttendance'),
        gradeFilterAttendance: document.getElementById('gradeFilterAttendance'),
        attendanceListContainer: document.getElementById('attendanceListContainer'),
        requestPermissionBtn: document.getElementById('requestPermissionBtn'),
        permissionRequestView: document.getElementById('permission-request-view'),
        permissionRequestForm: document.getElementById('permissionRequestForm'),
        viewPermissionHistoryBtn: document.getElementById('viewPermissionHistoryBtn'),
        permissionHistoryView: document.getElementById('permission-history-view'),
        scheduleDaySelector: document.getElementById('schedule-day-selector'),
        homeSection: document.getElementById('home'),
        scheduleToggles: document.querySelectorAll('.schedule-toggle'),
        classScheduleView: document.getElementById('class-schedule-view'),
        examScheduleView: document.getElementById('exam-schedule-view'),
        examListContainer: document.getElementById('exam-list-container'),
        homeMainView: document.getElementById('home-main-view'),
        notificationsBtn: document.getElementById('notificationsBtn'),
        notificationBadge: document.getElementById('notification-badge'),
        notificationsView: document.getElementById('notifications-view'),
        editEmailView: document.getElementById('edit-email-view'),
        emailSettingsBtn: document.getElementById('emailSettingsBtn'),
        saveEmailBtn: document.getElementById('saveEmailBtn'),
        emailInput: document.getElementById('emailInput'),
        profileEmail: document.getElementById('profile-email'),
        feedbackView: document.getElementById('feedback-view'),
        feedbackBtn: document.getElementById('feedbackBtn'),
        feedbackForm: document.getElementById('feedbackForm'),
        myFeedbackView: document.getElementById('my-feedback-view'),
        viewMyFeedbackBtn: document.getElementById('viewMyFeedbackBtn'),
        securityBtn: document.getElementById('securityBtn'),
        securityView: document.getElementById('security-view'),
        digitalIdBtn: document.getElementById('digitalIdBtn'),
        digitalIdView: document.getElementById('digital-id-view'),
        appearanceBtn: document.getElementById('appearanceBtn'),
        appearanceView: document.getElementById('appearance-view'),
        colorOptionsContainer: document.getElementById('color-options-container'),
        themeModeSelector: document.getElementById('theme-mode-selector'),
        textSizeSelector: document.getElementById('text-size-selector'),
        reduceMotionToggle: document.getElementById('reduceMotionToggle'),
        oledModeContainer: document.getElementById('oled-mode-container'),
        oledModeToggle: document.getElementById('oledModeToggle'),
        installAppBtn: document.getElementById('installAppBtn'),
        customConfirmModal: document.getElementById('customConfirmModal'),
        modalConfirmBtn: document.getElementById('modalConfirmBtn'),
        modalCancelBtn: document.getElementById('modalCancelBtn'),
        modalTitle: document.getElementById('modalTitle'),
        modalMessage: document.getElementById('modalMessage'),
    };

    // --- DATA CACHE ---
    let dataCache = {
        scores: {},
        attendance: {},
        profile: null,
        schedule: null,
        examSchedule: [],
        announcements: [],
        events: [],
        permissionHistory: [],
        isHeavyDataLoaded: false,
        isFetchingHeavyData: false,
        isInitialDataLoaded: false,
        isFetchingInitialData: false,
        latestPermissionRequest: null,
        notifications: []
    };

    // --- LEAVE FORM LOGIC ---
    function calculateComebackDate() {
        // Function intentionally left blank: No longer needed for Class Skip
    }

    function updateFormVisibility() {
        // Function intentionally left blank: Form is now static and always shows Leave Period
    }

    // --- THEME & APPEARANCE FUNCTIONS ---
    function setThemeColor(hue) {
        document.documentElement.style.setProperty('--theme-hue', hue);
        localStorage.setItem('themeHue', hue);

        ui.colorOptionsContainer.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.hue === hue);
        });
    }

    function setThemeMode(mode) {
        document.documentElement.setAttribute('data-theme-mode', mode);
        localStorage.setItem('themeMode', mode);

        ui.themeModeSelector.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeMode === mode);
        });

        const isDarkModeActive = (mode === 'dark') || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDarkModeActive) {
            ui.oledModeContainer.classList.remove('hidden');
        } else {
            ui.oledModeContainer.classList.add('hidden');
        }
    }

    function setTextSize(size) {
        document.documentElement.style.setProperty('--font-scale', size);
        localStorage.setItem('textSize', size);

        ui.textSizeSelector.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.textSize === size);
        });
    }

    function setReduceMotion(isEnabled) {
        localStorage.setItem('reduceMotion', isEnabled);
        document.documentElement.setAttribute('data-power-saving', String(isEnabled));
        if (ui.reduceMotionToggle) {
            ui.reduceMotionToggle.checked = isEnabled;
        }
    }

    function updateUIText() {
        const lang = localStorage.getItem('language') || 'km';
        if (!translations[lang]) return;

        document.querySelectorAll('[data-translate-key]').forEach(el => {
            const key = el.dataset.translateKey;
            const translation = translations[lang][key];
            if (translation) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });
    }

    function updateCurrentLanguageDisplay() {
        const lang = localStorage.getItem('language') || 'km';
        ui.currentLanguageDisplay.textContent = lang === 'km' ? 'Khmer' : 'English';
    }

    function renderLanguageSelection() {
        const currentLang = localStorage.getItem('language') || 'km';
        ui.languageOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.lang === currentLang);
        });
    }

    function setLanguage(lang) {
        localStorage.setItem('language', lang);
        document.documentElement.lang = lang;
        updateUIText();
        renderLanguageSelection();
        updateCurrentLanguageDisplay();
    }

    function handleLanguageSelect(e) {
        e.preventDefault();
        const selectedLang = e.currentTarget.dataset.lang;
        setLanguage(selectedLang);
        setTimeout(handleProfileBack, 200);
    }

    // --- INITIALIZATION ---
    async function init() {
        await loadTranslations();

        const savedHue = localStorage.getItem('themeHue') || '250';
        setThemeColor(savedHue);

        const savedThemeMode = localStorage.getItem('themeMode') || 'auto';
        setThemeMode(savedThemeMode);

        const savedTextSize = localStorage.getItem('textSize') || '1';
        setTextSize(savedTextSize);

        const savedReduceMotion = localStorage.getItem('reduceMotion') === 'true';
        setReduceMotion(savedReduceMotion);

        const savedOledMode = localStorage.getItem('oledMode') === 'true';
        setOledMode(savedOledMode);

        setLanguage(localStorage.getItem('language') || 'km');

        initCustomSelect(document.getElementById('gradeFilterResult'), renderResult);

        addEventListeners();

        await fetchCurrentSemester();

        const token = localStorage.getItem('token');
        if (token) {
            showDashboard(true);
        } else {
            showLoginPage();
        }

        if (ui.dashboard && ui.mainContent) {
            const ptrIndicator = document.createElement('div');
            ptrIndicator.id = 'pull-to-refresh-indicator';
            ptrIndicator.innerHTML = '<div class="spinner"></div>';
            ui.dashboard.insertBefore(ptrIndicator, ui.mainContent);
        }
    }

    function addEventListeners() {
        ui.loginForm.addEventListener('submit', handleLogin);
        ui.logoutButton.addEventListener('click', handleLogout);
        ui.backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginPage();
        });
        ui.forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showResetPage();
        });
        ui.requestResetForm.addEventListener('submit', handleRequestReset);
        ui.verifyOtpForm.addEventListener('submit', handleVerifyOtp);
        ui.passwordResetForm.addEventListener('submit', handlePasswordReset);

        ui.languageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showProfileSubPage(ui.languageView);
            renderLanguageSelection();
        });
        ui.appearanceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showProfileSubPage(ui.appearanceView);
        });

        ui.colorOptionsContainer.addEventListener('click', (e) => {
            const colorOption = e.target.closest('.color-option');
            if (colorOption && colorOption.dataset.hue) {
                setThemeColor(colorOption.dataset.hue);
            }
        });
        ui.themeModeSelector.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.dataset.themeMode) {
                setThemeMode(button.dataset.themeMode);
            }
        });
        ui.textSizeSelector.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.dataset.textSize) {
                setTextSize(button.dataset.textSize);
            }
        });
        ui.reduceMotionToggle.addEventListener('change', (e) => {
            setReduceMotion(e.target.checked);
        });

        ui.oledModeToggle.addEventListener('change', (e) => {
            setOledMode(e.target.checked);
        });

        ui.languageOptions.forEach(option => option.addEventListener('click', handleLanguageSelect));
        ui.navLinks.forEach(link => link.addEventListener('click', (e) => handleNavigation(link.getAttribute('href'), e)));
        ui.internalNavLinks.forEach(link => link.addEventListener('click', (e) => handleNavigation(link.getAttribute('href'), e)));
        ui.tabLinks.forEach(tab => {
            if (!tab.classList.contains('schedule-toggle')) {
                tab.addEventListener('click', handleTabClick);
            }
        });
        ui.myProfileBtn.addEventListener('click', (e) => { e.preventDefault(); showProfileSubPage(ui.myProfileView); });
        ui.changePasswordBtn.addEventListener('click', (e) => { e.preventDefault(); showProfileSubPage(ui.changePasswordView); });
        ui.feedbackBtn.addEventListener('click', (e) => { e.preventDefault(); showProfileSubPage(ui.feedbackView); });
        ui.emailSettingsBtn.addEventListener('click', (e) => { e.preventDefault(); showProfileSubPage(ui.editEmailView); });
        ui.profileSection.querySelectorAll('.back-button').forEach(btn => btn.addEventListener('click', handleProfileBack));
        ui.passwordChangeForm.addEventListener('submit', handleChangePassword);
        ui.feedbackForm.addEventListener('submit', handleFeedbackSubmit);
        ui.saveEmailBtn.addEventListener('click', handleUpdateEmail);
        ui.scoresTableBody.addEventListener('click', handleResultItemClick);
        ui.resultDetailView.querySelector('.back-button').addEventListener('click', showResultMainPage);
        ui.requestPermissionBtn.addEventListener('click', handleRequestPermissionClick);
        ui.permissionRequestView.querySelector('.back-button').addEventListener('click', showAttendanceMainPage);
        ui.viewPermissionHistoryBtn.addEventListener('click', showPermissionHistoryPage);
        ui.permissionHistoryView.querySelector('.back-button').addEventListener('click', showAttendanceMainPage);
        ui.permissionRequestForm.addEventListener('submit', handlePermissionSubmit);
        document.getElementById('withdrawRequestBtn').addEventListener('click', handleWithdrawRequest);
        document.getElementById('requestNewPermissionBtn').addEventListener('click', handleRequestAgain);
        document.getElementById('checkInBtn').addEventListener('click', handleCheckIn);
        ui.permissionRequestForm.addEventListener('change', (e) => {
            const target = e.target;

            if (target.name === 'statusType' || target.name === 'Day' || target.name === 'requestDate') {
                updateFormVisibility();
            }

            const parentField = target.closest('.form-field');
            if (parentField && parentField.classList.contains('error')) {
                parentField.classList.remove('error');
            }
        });
        document.getElementById('profile-image-upload').addEventListener('change', handleProfileImageUpload);
        initCustomSelect(ui.semesterFilterResult, renderResult);
        initCustomSelect(ui.semesterFilterAttendance, renderAttendance);
        initCustomSelect(ui.gradeFilterAttendance, renderAttendance);
        initCustomSelect(document.getElementById('feedbackCategorySelect'), null);
        ui.scheduleToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const targetView = e.target.dataset.view;
                ui.scheduleToggles.forEach(t => {
                    t.classList.toggle('active', t.dataset.view === targetView);
                    t.setAttribute('aria-selected', t.dataset.view === targetView);
                });
                document.querySelectorAll('.schedule-view').forEach(v => v.classList.remove('active'));
                if (targetView === 'class') {
                    ui.classScheduleView.classList.add('active');
                    renderSchedule();
                } else {
                    ui.examScheduleView.classList.add('active');
                    renderExamSchedule();
                }
            });
        });
        ui.scheduleDaySelector.addEventListener('click', (e) => {
            const dayItem = e.target.closest('.day-item');
            if (dayItem && !dayItem.classList.contains('active')) {
                ui.scheduleDaySelector.querySelector('.active')?.classList.remove('active');
                dayItem.classList.add('active');
                const timelineContainer = document.getElementById('schedule-timeline-container');
                timelineContainer.classList.add('is-changing');
                setTimeout(() => {
                    renderTimeline(dayItem.dataset.day);
                    timelineContainer.classList.remove('is-changing');
                }, 150);
            }
        });
        ui.mainContent.addEventListener('scroll', () => {
            if (ui.mainContent.scrollTop > 15) {
                ui.mainContent.classList.add('is-scrolled');
            } else {
                ui.mainContent.classList.remove('is-scrolled');
            }
        });

        ui.securityBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showProfileSubPage(ui.securityView);
            renderSecurityPage();
        });
        ui.viewMyFeedbackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showMyFeedbackPage();
        });
        document.getElementById('securityChangePasswordBtn').addEventListener('click', (e) => {
            e.preventDefault();
            showProfileSubPage(ui.changePasswordView);
        });

        // --- PULL TO REFRESH LISTENERS ---
        ui.mainContent.addEventListener('touchstart', handleTouchStart, { passive: true });
        ui.mainContent.addEventListener('touchmove', handleTouchMove, { passive: false });
        ui.mainContent.addEventListener('touchend', handleTouchEnd);

        // NOTIFICATIONS
        ui.notificationsBtn.addEventListener('click', showNotificationsPage);
        ui.notificationsView.querySelector('.back-button').addEventListener('click', hideNotificationsPage);
        document.getElementById('notifications-list-container').addEventListener('click', (e) => {
            const item = e.target.closest('.notification-item');
            if (item && item.dataset.link) {
                handleNavigation(item.dataset.link, e);
                setTimeout(hideNotificationsPage, 50);
            }
        });

        document.body.addEventListener('click', function (e) {
            if (e.target.matches('.password-toggle-icon')) {
                togglePasswordVisibility(e.target);
            }
        });

        if (ui.digitalIdBtn) {
            ui.digitalIdBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showProfileSubPage(ui.digitalIdView);
                renderDigitalIdCard();
            });
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            if (ui.installAppBtn) {
                ui.installAppBtn.style.display = 'flex';
            }
        });

        if (ui.installAppBtn) {
            ui.installAppBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (deferredInstallPrompt) {
                    deferredInstallPrompt.prompt();
                    await deferredInstallPrompt.userChoice;
                    deferredInstallPrompt = null;
                    ui.installAppBtn.style.display = 'none';
                }
            });
        }

        window.addEventListener('appinstalled', () => {
            if (ui.installAppBtn) {
                ui.installAppBtn.style.display = 'none';
            }
            deferredInstallPrompt = null;
        });

        ui.modalCancelBtn.addEventListener('click', hideCustomConfirm);
        ui.customConfirmModal.addEventListener('click', (e) => {
            if (e.target === ui.customConfirmModal) {
                hideCustomConfirm();
            }
        });
    }

    function initCustomSelect(filterElement, renderFn) {
        const trigger = filterElement.querySelector('.select-trigger');
        const triggerText = trigger.querySelector('span');
        const optionsContainer = filterElement.querySelector('.select-options');

        trigger.addEventListener('click', () => {
            const isOpen = filterElement.classList.toggle('open');
            trigger.setAttribute('aria-expanded', isOpen);
        });

        optionsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.select-option');
            if (option) {
                const newSemester = option.dataset.value;
                filterElement.dataset.value = newSemester;

                if (triggerText) {
                    triggerText.textContent = option.textContent.trim();
                    if (option.dataset.translateKey) {
                        triggerText.dataset.translateKey = option.dataset.translateKey;
                    }
                }

                optionsContainer.querySelector('.selected')?.classList.remove('selected');
                option.classList.add('selected');

                filterElement.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');

                const currentHash = window.location.hash.split('/')[0];
                if (currentHash === '#result' || currentHash === '#attendance') {
                    history.pushState(null, null, `${currentHash}/${newSemester}`);
                }

                if (typeof renderFn === 'function') {
                    renderFn();
                }
            }
        });

        window.addEventListener('click', (e) => {
            if (!filterElement.contains(e.target)) {
                if (filterElement.classList.contains('open')) {
                    filterElement.classList.remove('open');
                    trigger.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }

    async function fetchCurrentSemester() {
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getCurrentSemester`);
            const result = await response.json();
            if (result.success && result.currentSemester) {
                currentSemester = result.currentSemester;
            }
        } catch (error) {
            console.error("Error fetching current semester:", error);
        }
    }

    // --- PULL TO REFRESH HANDLERS ---
    function handleTouchStart(e) {
        if (ui.mainContent.scrollTop === 0 && !ptrState.isRefreshing) {
            ptrState.isDragging = true;
            ptrState.startY = e.touches[0].pageY;
        }
    }

    function handleTouchMove(e) {
        if (ptrState.isDragging && !ptrState.isRefreshing) {
            const currentY = e.touches[0].pageY;
            ptrState.pullDistance = Math.max(0, currentY - ptrState.startY);

            if (ptrState.pullDistance > 0) {
                if (e.cancelable) e.preventDefault();
                const indicator = document.getElementById('pull-to-refresh-indicator');
                const spinner = indicator.querySelector('.spinner');
                const pullThreshold = 300;
                indicator.style.opacity = '1';
                const maxPullHeight = window.innerHeight * 0.15;
                const dampenedDistance = ptrState.pullDistance / 2.5;
                const finalDistance = Math.min(dampenedDistance, maxPullHeight);
                ui.mainContent.style.transform = `translateY(${finalDistance}px)`;
                const pullProgress = Math.min(1, ptrState.pullDistance / pullThreshold);
                spinner.style.opacity = pullProgress;
                spinner.style.transform = `scale(${0.5 + pullProgress * 0.5}) rotate(${pullProgress * 360}deg)`;
            }
        }
    }

    async function handleTouchEnd() {
        if (ptrState.isDragging && !ptrState.isRefreshing) {
            ptrState.isDragging = false;
            const indicator = document.getElementById('pull-to-refresh-indicator');
            const spinner = indicator.querySelector('.spinner');
            const pullThreshold = 300;

            ui.mainContent.style.transition = 'transform 0.3s ease-out';
            indicator.style.transition = 'opacity 0.3s ease-out';
            spinner.style.transition = '';

            if (ptrState.pullDistance > pullThreshold) {
                ptrState.isRefreshing = true;
                ui.mainContent.style.transform = 'translateY(50px)';
                spinner.style.removeProperty('transform');
                spinner.style.opacity = '1';
                spinner.classList.add('is-refreshing');
                await refreshData(false);
                ptrState.isRefreshing = false;
                spinner.classList.remove('is-refreshing');
                ui.mainContent.style.transform = 'translateY(0)';
                indicator.style.opacity = '0';
            } else {
                ui.mainContent.style.transform = 'translateY(0)';
                indicator.style.opacity = '0';
                spinner.style.transform = '';
            }
            ptrState.pullDistance = 0;
            setTimeout(() => {
                ui.mainContent.style.transition = '';
                indicator.style.transition = '';
            }, 300);
        }
    }

    // --- API & DATA HANDLING ---
    async function refreshData(showToastNotification = false) {
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error("Not logged in");

            const [initialDataResult, permissionResult] = await Promise.all([
                fetch(`${SCRIPT_URL}?action=getInitialDashboardData&token=${token}`).then(res => res.json()),
                fetch(`${SCRIPT_URL}?action=getLatestPermissionRequest&token=${token}`).then(res => res.json())
            ]);

            if (initialDataResult.success) {
                dataCache.profile = initialDataResult.data.profile;
                dataCache.announcements = initialDataResult.data.announcements;
                dataCache.events = initialDataResult.data.events;
                dataCache.notifications = initialDataResult.data.notifications;
                updateNotificationBadge();
                localStorage.setItem('studentProfile', JSON.stringify(dataCache.profile));
            } else {
                console.error("Failed to refresh initial data:", initialDataResult.message);
            }

            if (permissionResult.success) {
                dataCache.latestPermissionRequest = permissionResult.data;
            } else {
                console.error("Failed to refresh permission data:", permissionResult.message);
            }

            rerenderCurrentSection();

            if (document.getElementById('permission-request-view').classList.contains('active')) {
                await checkExistingPermissionRequest();
            }

            if (showToastNotification) {
                showToast("Content updated!");
            }

        } catch (error) {
            console.error("Data refresh failed:", error);
            if (showToastNotification) {
                showToast("Failed to update. Check connection.");
            }
        }
    }

    async function fetchInitialDashboardData(token) {
        dataCache.isFetchingInitialData = true; // Mark as fetching
        try {
            const response = await fetch(`${SCRIPT_URL}?action=getInitialDashboardData&token=${token}`);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const result = await response.json();

            dataCache.isFetchingInitialData = false; // Mark done

            if (result.success) {
                dataCache.profile = result.data.profile;
                dataCache.announcements = result.data.announcements;
                dataCache.events = result.data.events;
                dataCache.notifications = result.data.notifications;

                dataCache.isInitialDataLoaded = true;

                updateNotificationBadge();
                localStorage.setItem('studentProfile', JSON.stringify(result.data.profile));
                return { success: true };
            }

            if (result.message && result.message.toLowerCase().includes('session')) {
                alert("Your session has expired. Please login again.");
                handleLogout();
                return { success: false, message: result.message };
            }

            throw new Error(result.message || 'Failed to load profile data.');
        } catch (error) {
            console.error('Fetch Initial Data Error:', error);
            dataCache.isFetchingInitialData = false; // Cancel loading on fail
            rerenderCurrentSection(); // Force skeleton to disappear
            return { success: false, message: error.message };
        }
    }

    async function fetchHeavyDashboardData(token) {
        if (dataCache.isHeavyDataLoaded) return { success: true };

        dataCache.isFetchingHeavyData = true; // Mark as fetching

        try {
            const response = await fetch(`${SCRIPT_URL}?action=getHeavyDashboardData&token=${token}`);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const result = await response.json();

            dataCache.isFetchingHeavyData = false; // Mark done

            if (result.success) {
                dataCache.scores = result.data.scores || {};
                dataCache.semesterTotals = result.data.semesterTotals;
                dataCache.attendance = result.data.attendance || {};
                dataCache.schedule = result.data.schedule || [];
                dataCache.examSchedule = result.data.examSchedule || [];

                dataCache.isHeavyDataLoaded = true;

                localStorage.setItem('studentSchedule', JSON.stringify(result.data.schedule || []));
                return { success: true };
            }

            if (result.message && result.message.toLowerCase().includes('session')) {
                alert("Your session has expired. Please login again.");
                handleLogout();
                return { success: false, message: result.message };
            }

            throw new Error(result.message || 'Failed to load detailed records.');
        } catch (error) {
            console.error('Fetch Heavy Data Error:', error);
            dataCache.isFetchingHeavyData = false; // Cancel loading on fail

            rerenderCurrentSection(); // Force skeleton to disappear

            const retryFunc = () => {
                dataCache.isHeavyDataLoaded = false;
                fetchHeavyDashboardData(token).then(rerenderCurrentSection);
            };

            renderErrorState(ui.scoresTableBody, retryFunc);
            renderErrorState(ui.attendanceListContainer, retryFunc);
            renderErrorState(ui.classScheduleView, retryFunc);
            renderErrorState(ui.examListContainer, retryFunc);
            return { success: false, message: error.message };
        }
    }

    // --- PAGE SWITCHING LOGIC ---
    function showPage(pageToShow) {
        ui.loginPage.style.display = 'none';
        ui.resetPage.classList.add('hidden');
        ui.dashboard.classList.add('hidden');

        switch (pageToShow) {
            case 'login':
                ui.loginPage.style.display = 'flex';
                break;
            case 'reset':
                ui.resetPage.classList.remove('hidden');
                break;
            case 'dashboard':
                ui.dashboard.classList.remove('hidden');
                break;
        }
    }

    function showLoginPage() {
        showPage('login');
        ui.loginForm.reset();
        updateUIText();
    }

    async function showDashboard(isReload = false) {
        showPage('dashboard');
        const token = localStorage.getItem('token');

        // 1. LOAD CACHE (Synchronous - Instant)
        const cachedProfile = localStorage.getItem('studentProfile');
        const cachedSchedule = localStorage.getItem('studentSchedule');

        if (cachedProfile) {
            try { dataCache.profile = JSON.parse(cachedProfile); } catch (e) { }
        }
        if (cachedSchedule) {
            try { dataCache.schedule = JSON.parse(cachedSchedule); } catch (e) { }
        }

        // 2. RENDER IMMEDIATELY (First Paint)
        if (dataCache.profile) {
            renderProfile();
            renderHome();
            const currentHash = window.location.hash || '#home';
            handleNavigation(currentHash);
            if (dataCache.schedule) {
                renderSchedule();
            }
        }

        // 3. BACKGROUND REFRESH
        if (token) {
            // ALWAYS fetch initial data on reload/login to get latest Announcements & Events
            if (isReload || !dataCache.isInitialDataLoaded) {
                fetchInitialDashboardData(token).then((res) => {
                    if (res.success) {
                        if (!cachedProfile) {
                            handleNavigation(window.location.hash || '#home');
                            renderProfile();
                        }
                        rerenderCurrentSection(); // <--- This populates News/Events
                    } else if (!cachedProfile) {
                        handleLogout();
                    }
                });
            } else {
                updateNotificationBadge();
            }

            // ALWAYS fetch heavy data on reload to get latest Scores & Attendance
            if (isReload || !dataCache.isHeavyDataLoaded) {
                fetchHeavyDashboardData(token)
                    .then(() => {
                        rerenderCurrentSection(); // <--- This populates Carousel
                    })
                    .catch(console.error);
            }
        } else {
            showLoginPage();
        }
    }


    // --- AUTHENTICATION & FLOW ---
    async function handleLogin(e) {
        e.preventDefault();
        toggleLoginButtonState('start');
        ui.loginError.classList.add('hidden');

        const studentId = document.getElementById('studentId').value.trim();
        const password = document.getElementById('password').value;

        if (!studentId || !password) {
            ui.loginError.textContent = 'Student ID and password are required.';
            ui.loginError.classList.remove('hidden');
            toggleLoginButtonState('reset');
            return;
        }

        try {
            // 1. Single Network Request
            const authResponse = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'login',
                    payload: {
                        studentId: studentId,
                        password: password
                    }
                })
            });

            const authResult = await authResponse.json();

            if (authResult.success) {
                // 2. Save Token
                localStorage.setItem('token', authResult.token);

                // 3. PERFORMANCE BOOST: Save Profile IMMEDIATELY from Login Response
                // We don't wait for another fetch. We render right now.
                if (authResult.user) {
                    dataCache.profile = authResult.user;
                    localStorage.setItem('studentProfile', JSON.stringify(authResult.user));
                }

                // 4. Instant Transition (Optimistic UI)
                // Switch to dashboard immediately. Do not await data fetching.
                showDashboard(false);

                // 5. Run Background Fetches
                // These run while the user is already looking at the dashboard.
                // We use Promise.all to run them in parallel.
                Promise.all([
                    fetchCurrentSemester(),
                    fetchInitialDashboardData(authResult.token), // Refreshes news/events
                    // Optional: Start heavy data fetch immediately too
                    fetchHeavyDashboardData(authResult.token).then(() => {
                        // Silent update of charts/tables when heavy data arrives
                        rerenderCurrentSection();
                    })
                ]).catch(err => console.warn("Background fetch error:", err));

                if (localStorage.getItem('onboardingComplete') !== 'true') {
                    setTimeout(startOnboardingTour, 500);
                }
            } else {
                ui.loginError.textContent = authResult.message || 'Invalid credentials.';
                ui.loginError.classList.remove('hidden');
                toggleLoginButtonState('reset');
            }
        } catch (error) {
            ui.loginError.textContent = 'A network error occurred.';
            ui.loginError.classList.remove('hidden');
            toggleLoginButtonState('reset');
        }
        // Note: We do NOT reset the button state on success, 
        // because the view swaps immediately. It looks cleaner.
    }

    function handleLogout(e) {
        if (e) e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('studentProfile');
        localStorage.removeItem('studentSchedule');

        window.location.href = window.location.pathname;
    }

    // --- NAVIGATION ---
    function handleNavigation(hash, e) {
        if (e) e.preventDefault();
        hash = hash || '#home';

        const [mainHash, subState] = hash.split('/');
        const targetSectionId = mainHash.substring(1);

        ui.contentSections.forEach(section => section.classList.toggle('active', section.id === targetSectionId));
        ui.navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === mainHash));

        showProfileMainPage();
        showResultMainPage();
        showAttendanceMainPage();

        const section = document.getElementById(targetSectionId);
        if (section) {
            const semesterFilter = section.querySelector('.custom-select');
            const semesterToSet = subState && ALL_SEMESTERS.includes(subState) ? subState : currentSemester;
            if (semesterFilter) {
                semesterFilter.dataset.value = semesterToSet;
            }
        }

        rerenderCurrentSection();
        ui.mainContent.scrollTop = 0;
        history.pushState(null, null, ' ' + hash);
    }

    function handleTabClick(e) {
        const targetId = e.target.dataset.tab;
        const tabContainer = e.target.closest('.tabs');
        if (!tabContainer) return;

        tabContainer.querySelectorAll('.tab-link').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });

        e.target.classList.add('active');
        e.target.setAttribute('aria-selected', 'true');

        const contentContainer = tabContainer.nextElementSibling.parentElement;
        contentContainer.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const activeContent = contentContainer.querySelector(`.tab-content[id*="${targetId}"]`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
    }

    function rerenderCurrentSection() {
        const activeSection = document.querySelector('.content-section.active');
        if (!activeSection) return;
        const renderMap = {
            'home': renderHome,
            'schedule': renderSchedule,
            'result': renderResult,
            'attendance': renderAttendance,
            'profile': renderProfile,
        };
        renderMap[activeSection.id]?.();
    }

    // --- NOTIFICATION LOGIC ---
    function updateNotificationBadge() {
        const unreadCount = dataCache.notifications.filter(n => !n.IsRead).length;
        if (unreadCount > 0) {
            ui.notificationBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            ui.notificationBadge.classList.remove('hidden');
        } else {
            ui.notificationBadge.classList.add('hidden');
        }
    }

    function renderNotifications() {
        const container = document.getElementById('notifications-list-container');
        renderList(container, dataCache.notifications, (item) => {
            const div = document.createElement('div');
            div.className = 'notification-item';
            div.classList.toggle('unread', !item.IsRead);
            div.dataset.link = item.Link || '#home';

            const itemDate = new Date(item.Timestamp);
            const timeAgo = formatTimeAgo(itemDate);

            div.innerHTML = `
                <p>${item.Message}</p>
                <span>${timeAgo}</span>
            `;
            return div;
        }, '<div class="card"><p>You have no notifications.</p></div>');
    }

    async function showNotificationsPage() {
        if (ui.homeSection.dataset.isAnimating) return;
        ui.homeSection.dataset.isAnimating = 'true';
        lastFocusedElement = document.activeElement;
        renderNotifications();
        onAnimationEnd(ui.notificationsView, () => {
            ui.homeMainView.classList.add('hidden');
            ui.homeMainView.classList.remove('slide-out-to-left');
            ui.notificationsView.classList.remove('slide-in-from-right');
            delete ui.homeSection.dataset.isAnimating;
            ui.notificationsView.querySelector('.back-button').focus();
        });
        ui.notificationsView.classList.remove('hidden');
        ui.homeMainView.classList.add('slide-out-to-left');
        ui.notificationsView.classList.add('slide-in-from-right');
        if (dataCache.notifications.some(n => !n.IsRead)) {
            try {
                await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'markNotificationsAsRead',
                        payload: { token: localStorage.getItem('token') }
                    }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                dataCache.notifications.forEach(n => n.IsRead = true);
                updateNotificationBadge();
            } catch (error) {
                console.error('Failed to mark notifications as read:', error);
            }
        }
    }

    function hideNotificationsPage() {
        if (ui.notificationsView.classList.contains('hidden') || ui.homeSection.dataset.isAnimating) return;
        ui.homeSection.dataset.isAnimating = 'true';
        onAnimationEnd(ui.homeMainView, () => {
            ui.notificationsView.classList.add('hidden');
            ui.notificationsView.classList.remove('slide-out-to-right');
            ui.homeMainView.classList.remove('slide-in-from-left');
            delete ui.homeSection.dataset.isAnimating;
            renderNotifications();
            if (lastFocusedElement) lastFocusedElement.focus();
        });
        ui.homeMainView.classList.remove('hidden');
        ui.notificationsView.classList.add('slide-out-to-right');
        ui.homeMainView.classList.add('slide-in-from-left');
    }

    // --- UI RENDERING ---
    function renderList(container, items, renderItemFn, fallbackHTML = '<p>Nothing to show.</p>') {
        container.innerHTML = '';
        if (items && items.length > 0) {
            const fragment = document.createDocumentFragment();
            items.forEach((item, index) => {
                const el = renderItemFn(item, index);
                el.style.animationDelay = `${index * 50}ms`;
                el.classList.add('list-item-animate');
                fragment.appendChild(el);
            });
            container.appendChild(fragment);
        } else {
            container.innerHTML = fallbackHTML;
        }
    }

    function renderErrorState(container, retryCallback) {
        if (!container) return;
        container.innerHTML = `
            <div class="error-state-container">
                <p class="error-state-message">Oops! Something went wrong.</p>
                <button class="retry-button">Retry</button>
            </div>`;
        const retryButton = container.querySelector('.retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                container.innerHTML = `
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                `;
                retryCallback();
            });
        }
    }

    // --- UTILITIES ---
    function onAnimationEnd(element, callback) {
        const isPowerSaving = document.documentElement.getAttribute('data-power-saving') === 'true';
        if (isPowerSaving) {
            setTimeout(callback, 0);
        } else {
            element.addEventListener('animationend', callback, { once: true });
        }
    }

    function showTopNotification(message, type = 'success') {
        document.querySelector('.top-notification')?.remove();

        const notification = document.createElement('div');
        notification.className = `top-notification ${type}`;
        notification.innerHTML = `<p>${message}</p>`;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);

        const autoDismiss = setTimeout(() => hideNotification(), 5000);
        let isDragging = false, startY, currentTranslateY = 0;

        function hideNotification() {
            notification.classList.remove('show');
            notification.addEventListener('transitionend', () => notification.remove(), { once: true });
        }

        function onPointerDown(e) {
            clearTimeout(autoDismiss);
            isDragging = true;
            startY = e.pageY;
            notification.classList.add('is-dragging');
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp, { once: true });
        }

        function onPointerMove(e) {
            if (!isDragging) return;
            const currentY = e.pageY;
            const deltaY = currentY - startY;

            if (deltaY < 0) {
                currentTranslateY = deltaY;
                notification.style.transform = `translateY(${currentTranslateY}px)`;
            }
        }

        function onPointerUp() {
            isDragging = false;
            notification.classList.remove('is-dragging');
            window.removeEventListener('pointermove', onPointerMove);

            if (currentTranslateY < -50) {
                hideNotification();
            } else {
                notification.style.transform = 'translateY(0)';
            }
            currentTranslateY = 0;
        }

        notification.addEventListener('pointerdown', onPointerDown);
    }

    function renderHome() {
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        const noClassesText = t.home_no_classes || "No classes scheduled.";
        const noNewsText = t.home_no_news || "No current announcements.";
        const noEventsText = t.home_no_events || "No upcoming events scheduled.";
        const locationLabel = t.event_location || "Location";

        // --- RENDER ALL CLASSES ---
        const todayContainer = document.getElementById('today-classes-container');

        if (todayContainer) {
            // FIX: Always show skeleton until the fresh data from the server is 100% loaded
            if (!dataCache.isHeavyDataLoaded) {
                todayContainer.innerHTML = `
                    <div class="skeleton skeleton-class-card"></div>
                    <div class="skeleton skeleton-class-card"></div>
                    <div class="skeleton skeleton-class-card"></div>
                `;
            } else {
                // 1. Get today's day name in English (e.g., "Monday")
                const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

                // 2. Filter the schedule to only include today's classes
                let todaySchedule = (dataCache.schedule || []).filter(item => {
                    const itemDay = item.day || item.DayOfWeek || item.Day || '';
                    return itemDay.toLowerCase() === todayName.toLowerCase();
                });

                // 3. Sort the classes by start time so they appear in chronological order
                todaySchedule.sort((a, b) => {
                    const timeA = a.startTime || a.StartTime || a.Start || '0:00';
                    const timeB = b.startTime || b.StartTime || b.Start || '0:00';
                    return parseTime(timeA) - parseTime(timeB);
                });

                // 4. Render the filtered list
                renderList(todayContainer, todaySchedule, (item) => {
                    const card = document.createElement('div');
                    card.className = 'horizontal-class-card';
                    const courseName = item.course || item.CourseName || item.Subject || 'Unknown';
                    const startTime = item.startTime || item.StartTime || item.Start || '';
                    const endTime = item.endTime || item.EndTime || item.End || '';

                    // --- EXTRACT GRADE INSTEAD OF CLASS ---
                    const p = dataCache.profile || {};
                    const studentGrade = item.grade || item.Grade || p.grade || p.Grade || 'N/A';

                    const classDay = item.day || item.DayOfWeek || item.Day || '';
                    const txtRoom = t.label_room || 'Room';

                    card.innerHTML = `
                        <div class="class-card-header">
                            <div class="class-letter-icon" style="background-color: ${getSubjectColor(courseName)};">
                                ${courseName.charAt(0).toUpperCase()}
                            </div>
                            <div class="class-info">
                                <h3>${courseName}</h3>
                                <p>${classDay} &nbsp;&bull;&nbsp; <i class='bx bx-map'></i> ${txtRoom} ${formatNumber(studentGrade)}</p>
                            </div>
                        </div>
                        <div class="class-card-time">
                            <i class='bx bx-time-five'></i> 
                            ${formatTimeForDisplay(startTime)} - ${formatTimeForDisplay(endTime)}
                        </div>
                    `;
                    return card;
                }, `<div class="card" style="width: 100%;"><p>${noClassesText}</p></div>`);
            }
        }

        // --- RENDER NEWS ---
        const newsContainer = document.getElementById('news-container');

        // FIX: Use the skeleton helper to draw 3 items
        if (!dataCache.isInitialDataLoaded) {
            renderLoadingSkeleton(newsContainer, 3);
        } else {
            renderList(newsContainer, dataCache.announcements, (ann) => {
                const item = document.createElement('div');
                item.className = 'news-item';
                const getVal = (obj, keyName) => {
                    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === keyName.toLowerCase());
                    return foundKey ? obj[foundKey] : null;
                };

                const rawDate = getVal(ann, 'datepost') || getVal(ann, 'timestamp') || new Date();
                let postDate = new Date(rawDate);
                if (isNaN(postDate.getTime())) { postDate = new Date(); }

                item.innerHTML = `
                <div class="news-date">
                    <span>${postDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                    <span>${postDate.getDate()}</span>
                </div>
                <div>
                    <h3>${getVal(ann, 'title') || 'No Title'}</h3>
                    <p>${String(getVal(ann, 'message') || '').substring(0, 100)}...</p>
                </div>`;
                return item;
            }, `<p>${noNewsText}</p>`);
        }

        // --- RENDER EVENTS ---
        const eventsContainer = document.getElementById('events-container');

        // FIX: Use the skeleton helper to draw 3 items
        if (!dataCache.isInitialDataLoaded) {
            renderLoadingSkeleton(eventsContainer, 3);
        } else {
            renderList(eventsContainer, dataCache.events, (event) => {
                const item = document.createElement('div');
                item.className = 'news-item';
                const eventDate = new Date(event.EventDate);
                item.innerHTML = `
                <div class="news-date">
                    <span>${eventDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                    <span>${eventDate.getDate()}</span>
                </div>
                <div>
                    <h3>${event.Title}</h3>
                    <p>${event.Description}</p>
                    <small style="color: var(--secondary-text);"><b>${locationLabel}:</b> ${event.Location}</small>
                </div>`;
                return item;
            }, `<p>${noEventsText}</p>`);
        }
    }

    function renderSchedule() {
        const container = document.getElementById('class-schedule-view');
        let daySelector = document.getElementById('schedule-day-selector');
        let timelineContainer = document.getElementById('schedule-timeline-container');

        if (!daySelector) {
            // Handle if element is missing (safety check)
        }
        daySelector.innerHTML = '';

        if (!timelineContainer) {
            timelineContainer = document.createElement('div');
            timelineContainer.id = 'schedule-timeline-container';
            container.appendChild(timelineContainer);
        }

        const today = new Date();
        const daysToRender = 30;

        // --- TRANSLATION LOGIC ---
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        // Map day indexes to translation keys
        const dayMap = [
            t.day_sun || 'Sun', t.day_mon || 'Mon', t.day_tue || 'Tue',
            t.day_wed || 'Wed', t.day_thu || 'Thu', t.day_fri || 'Fri', t.day_sat || 'Sat'
        ];
        // -------------------------

        let selectedDateStr = daySelector.dataset.selectedDate || today.toISOString().split('T')[0];
        daySelector.dataset.selectedDate = selectedDateStr;

        for (let i = 0; i < daysToRender; i++) {
            const date = new Date();
            date.setDate(today.getDate() + i);

            const dateStr = date.toISOString().split('T')[0];
            const dayName = dayMap[date.getDay()]; // Use translated name
            // TRANSLATE NUMBER: formatNumber()
            const dayNumber = formatNumber(String(date.getDate()).padStart(2, '0'));

            const btn = document.createElement('button');
            btn.className = `day-item ${dateStr === selectedDateStr ? 'active' : ''}`;
            btn.dataset.date = dateStr;
            // Store the English full name for data filtering (IMPORTANT: Keep this English for matching)
            btn.dataset.fullDayName = date.toLocaleDateString('en-US', { weekday: 'long' });

            btn.innerHTML = `
                <span>${dayName}</span>
                <span>${dayNumber}</span>
            `;

            if (dateStr === selectedDateStr) {
                setTimeout(() => {
                    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }, 100);
            }

            btn.addEventListener('click', () => {
                document.querySelectorAll('.day-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                daySelector.dataset.selectedDate = dateStr;
                btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                renderProfessionalTimeline(btn.dataset.fullDayName);
            });

            daySelector.appendChild(btn);
        }

        const activeBtn = daySelector.querySelector('.active');
        if (activeBtn) {
            renderProfessionalTimeline(activeBtn.dataset.fullDayName);
        }
    }

    function renderProfessionalTimeline(selectedDayName) {
        const container = document.getElementById('schedule-timeline-container');
        container.innerHTML = '';

        // FIX: Show timeline skeleton until data is fully loaded
        if (!dataCache.isHeavyDataLoaded) {
            renderLoadingSkeleton(container, 3);
            return;
        }

        const scheduleData = dataCache.schedule || [];

        // Filter by the English day name
        const daysEvents = scheduleData
            .filter(item => item.day === selectedDayName)
            .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

        // --- TRANSLATION SETUP ---
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        const txtNoClass = t.msg_no_classes_for || 'No classes scheduled for';
        const txtUnknown = t.label_teacher_unknown || 'Unknown';
        const txtRoom = t.label_room || 'Room';
        const txtAM = t.time_am || 'AM';
        const txtPM = t.time_pm || 'PM';

        // Translate Display Day Name
        const engDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const kmDays = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];

        let displayDayName = selectedDayName;
        if (lang === 'km') {
            const idx = engDays.indexOf(selectedDayName);
            if (idx !== -1) displayDayName = kmDays[idx];
        }

        if (daysEvents.length === 0) {
            container.innerHTML = `
                <div class="empty-schedule-modern">
                    <i class='bx bx-calendar-x'></i>
                    <p>${txtNoClass}<br><b>${displayDayName}</b></p>
                </div>`;
            return;
        }

        daysEvents.forEach((item, index) => {
            const block = document.createElement('div');
            block.className = 'timeline-block';
            block.style.animationDelay = `${index * 0.1}s`;

            // 1. Get Clean Time Strings (e.g., "8:00")
            // We use formatTime but strip any text it adds so we can build our own custom display
            const startTimeRaw = formatTime(item.startTime).replace(/<[^>]*>/g, '').replace(/[a-zA-Z\u1780-\u17FF]+$/g, '').trim();
            const endTimeRaw = formatTime(item.endTime).replace(/<[^>]*>/g, '').replace(/[a-zA-Z\u1780-\u17FF]+$/g, '').trim();

            // 2. DETECT AM/PM CORRECTLY
            let h = 0;
            let isPm = false;

            // Case A: It's a Date Object (common in direct JS)
            if (item.startTime instanceof Date) {
                h = item.startTime.getHours();
                isPm = h >= 12;
            }
            // Case B: It's an ISO String from Google Sheets (e.g., "2023-10-25T13:00:00...")
            else if (typeof item.startTime === 'string' && item.startTime.includes('T')) {
                const dt = new Date(item.startTime);
                h = dt.getHours();
                isPm = h >= 12;
            }
            // Case C: It's a simple Time String (e.g., "1:00 PM" or "13:00")
            else if (typeof item.startTime === 'string') {
                if (item.startTime.toLowerCase().includes('pm')) {
                    isPm = true;
                } else if (item.startTime.includes(':')) {
                    // Try to parse "13:00" format
                    h = parseInt(item.startTime.split(':')[0]);
                    isPm = h >= 12 && h < 24;
                }
            }

            const ampmLabel = isPm ? txtPM : txtAM;
            const txtRoom = t.label_room || 'Room';

            // --- EXTRACT GRADE INSTEAD OF CLASS ---
            const p = dataCache.profile || {};
            const studentGrade = item.grade || item.Grade || p.grade || p.Grade || 'N/A';

            block.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="timeline-card">
                    <div class="timeline-header">
                        <div class="timeline-time">
                            ${startTimeRaw} - ${endTimeRaw} <small>${ampmLabel}</small>
                        </div>
                    </div>
                    <h3 class="timeline-title">${item.course}</h3>
                    <div class="timeline-details">
                        <div class="timeline-detail-item">
                            <i class='bx bx-user'></i>
                            <span>${item.teacher || txtUnknown}</span>
                        </div>
                        <div class="timeline-detail-item">
                            <i class='bx bx-map'></i>
                            <span>${txtRoom} ${formatNumber(studentGrade)}</span>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(block);
        });
    }

    function renderTimeline(day) {
        // Redundant with renderProfessionalTimeline, but kept if user wants alternate view
        // Logic similar to renderProfessionalTimeline but different HTML structure
    }

    function formatTimeDisplay(val) {
        const h = Math.floor(val);
        const m = Math.round((val - h) * 60);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        const mStr = m < 10 ? '0' + m : m;
        return `${h12}:${mStr} ${ampm}`;
    }

    function renderExamSchedule() {
        // FIX: Show card skeletons until exam data is fully loaded
        if (!dataCache.isHeavyDataLoaded) {
            renderLoadingSkeleton(ui.examListContainer, 3);
            return;
        }

        const exams = dataCache.examSchedule || [];
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        renderList(ui.examListContainer, exams, (item) => {
            const card = document.createElement('div');
            card.className = 'card exam-card';

            const examDate = new Date(item.Date);

            // Use correct locale for date formatting
            const dateLocale = lang === 'km' ? 'km-KH' : 'en-GB';
            const formattedDate = examDate.toLocaleDateString(dateLocale, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            // Translate Time Numbers
            const startTime = formatTimeForDisplay(item.StartTime);
            const endTime = formatTimeForDisplay(item.EndTime);

            // Format time string numbers (e.g. "8:00 AM" -> "៨:០០ AM")
            const displayTime = `${formatNumber(startTime.replace(/[a-zA-Z]/g, '').trim())} - ${formatNumber(endTime.replace(/[a-zA-Z]/g, '').trim())}`;
            const ampm = startTime.includes('PM') || endTime.includes('PM') ? 'PM' : '';

            card.innerHTML = `
                <div class="exam-card-header">
                    <h3>${item.Subject}</h3>
                    <span class="status-badge status-pending">${item.ExamType}</span>
                </div>
                <div class="exam-card-details">
                    <span><i class='bx bxs-calendar'></i> ${formattedDate}</span>
                    <span><i class='bx bxs-time-five'></i> ${displayTime} ${ampm}</span>
                </div>
            `;
            return card;
        }, `<div class="card"><p>${t.msg_no_exam_schedule || 'No exam schedules have been posted.'}</p></div>`);
    }

    // --- Replace renderResult in script.js ---
    function renderResult() {
        if (!dataCache.profile) return;

        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};
        const gradeLabel = lang === 'km' ? 'ថ្នាក់ទី' : 'Grade';
        const gradeFilter = document.getElementById('gradeFilterResult');

        const gradeMap = {};
        const profileGrade = dataCache.profile?.grade;
        const profileClass = dataCache.profile?.class;

        if (profileGrade) {
            gradeMap[profileGrade] = new Set();
            // Prevent major words from bleeding into dropdown
            if (profileClass && !profileClass.includes('វិទ្យា')) {
                gradeMap[profileGrade].add(profileClass);
            }
        }

        Object.values(dataCache.scores || {}).flat().forEach(item => {
            if (item.grade) {
                if (!gradeMap[item.grade]) gradeMap[item.grade] = new Set();
                const cls = item.exactClass || item.class || item.section;
                if (cls && !cls.includes('វិទ្យា')) {
                    gradeMap[item.grade].add(cls);
                }
            }
        });

        const availableGrades = Object.keys(gradeMap).sort((a, b) => parseInt(a) - parseInt(b));
        let selectedGrade = gradeFilter.dataset.value;

        if (!selectedGrade || selectedGrade === "1" || !gradeMap[selectedGrade]) {
            selectedGrade = String(profileGrade || (availableGrades.length > 0 ? availableGrades[availableGrades.length - 1] : "12"));
            gradeFilter.dataset.value = selectedGrade;
        }

        const gradeOptionsContainer = gradeFilter.querySelector('.select-options');
        if (gradeOptionsContainer) {
            let html = '';
            availableGrades.forEach(g => {
                const sections = Array.from(gradeMap[g]);
                let displayStr = `${gradeLabel} ${formatNumber(g)}`;
                if (sections.length > 0) {
                    displayStr += `[${sections.join(', ')}]`; // e.g. 10[10A, 10B]
                }

                const isSelected = String(g) === selectedGrade ? 'selected' : '';
                html += `<div class="select-option ${isSelected}" data-value="${g}">${displayStr}</div>`;
            });

            gradeOptionsContainer.innerHTML = html || `<div class="select-option selected" data-value="${selectedGrade}">${gradeLabel} ${formatNumber(selectedGrade)}</div>`;

            const trigger = gradeFilter.querySelector('.select-trigger span');
            if (trigger) {
                const triggerSections = gradeMap[selectedGrade] ? Array.from(gradeMap[selectedGrade]) : [];
                let triggerStr = `${gradeLabel} ${formatNumber(selectedGrade)}`;
                if (triggerSections.length > 0) triggerStr += `[${triggerSections.join(', ')}]`;
                trigger.textContent = triggerStr;
            }
        }

        const semesterFilter = ui.semesterFilterResult;
        let availableCategories = Object.keys(dataCache.scores || {});
        if (availableCategories.length === 0) availableCategories = ["Semester 1"];
        let selectedCategory = semesterFilter.dataset.value;
        if (!selectedCategory || !availableCategories.includes(selectedCategory)) {
            selectedCategory = availableCategories[availableCategories.length - 1];
            semesterFilter.dataset.value = selectedCategory;
        }

        const getDisplayLabel = (key) => {
            const lang = localStorage.getItem('language') || 'km';
            const t = translations[lang] || {};

            if (key === "Semester 1") return t.msg_semester + " " + formatNumber(1);
            if (key === "Semester 2") return t.msg_semester + " " + formatNumber(2);

            const monthMap = {
                "January": "month_01", "February": "month_02", "March": "month_03",
                "April": "month_04", "May": "month_05", "June": "month_06",
                "July": "month_07", "August": "month_08", "September": "month_09",
                "October": "month_10", "November": "month_11", "December": "month_12"
            };
            const monthKey = monthMap[key];
            if (monthKey && t[monthKey]) return t[monthKey];

            return t[key] || key;
        };

        const semOptionsContainer = semesterFilter.querySelector('.select-options');
        if (semOptionsContainer) {
            semOptionsContainer.innerHTML = availableCategories.map(key => {
                const isSelected = key === selectedCategory ? 'selected' : '';
                return `<div class="select-option ${isSelected}" data-value="${key}">${getDisplayLabel(key)}</div>`;
            }).join('');
            const trigger = semesterFilter.querySelector('.select-trigger span');
            if (trigger) trigger.textContent = getDisplayLabel(selectedCategory);
        }

        const scoresForCategory = dataCache.scores[selectedCategory] || [];
        const filteredScores = scoresForCategory.filter(item => String(item.grade) === selectedGrade);
        const container = ui.scoresTableBody;
        container.innerHTML = '';

        const hasAnyData = dataCache.scores && Object.keys(dataCache.scores).length > 0;

        if (filteredScores.length === 0) {
            const txtNoResult = t.msg_no_result_data || "No results for Grade";
            if (!hasAnyData && !dataCache.isHeavyDataLoaded) {
                renderLoadingSkeleton(container);
            } else {
                container.innerHTML = `
            <div class="empty-state-schedule">
                <i class='bx bx-bar-chart-alt-2'></i>
                <p>${txtNoResult} ${formatNumber(selectedGrade)} - ${getDisplayLabel(selectedCategory)}.</p>
            </div>`;
            }
            const cgpaEl = document.getElementById('cgpa-value');
            if (cgpaEl) cgpaEl.textContent = '--';
            return;
        }

        let totalScore = 0;
        let count = 0;

        const getGradeColor = (grade) => {
            const g = (grade || '').toUpperCase();
            if (g === 'A') return '#10B981';
            if (g === 'B') return '#3B82F6';
            if (g === 'C') return '#F59E0B';
            if (g === 'D') return '#EF4444';
            if (g === 'E' || g === 'F') return '#EF4444';
            return '#8B5CF6';
        };

        const getGradeBg = (grade) => {
            const g = (grade || '').toUpperCase();
            if (g === 'A') return '#ECFDF5';
            if (g === 'B') return '#EFF6FF';
            if (g === 'C') return '#FFFBEB';
            if (g === 'D' || g === 'F') return '#FEF2F2';
            return '#F3E8FF';
        };

        filteredScores.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'modern-grade-item';
            div.style.animation = `fadeInUp 0.4s ease forwards ${index * 0.05}s`;
            div.style.opacity = '0';
            div.style.cursor = 'pointer';

            div.addEventListener('click', () => {
                showResultDetail(item.course);
            });

            const score = parseFloat(item.totalScore) || 0;
            const gradeLetter = item.gradeLabel || 'N/A';
            const color = getGradeColor(gradeLetter);
            const bgColor = getGradeBg(gradeLetter);
            const icon = getSubjectIcon(item.course);

            div.innerHTML = `
            <div class="grade-icon-box" style="background-color: ${bgColor}; color: ${color};">
                <i class='${icon}'></i>
            </div>
            <div class="grade-info">
                <div class="grade-course-name">${item.course}</div>
                <div class="grade-progress-track">
                    <div class="grade-progress-fill" style="width: ${Math.min(score, 100)}%; background-color: ${color};"></div>
                </div>
            </div>
            <div class="grade-score-box">
                <span class="grade-letter-big" style="color: ${color}">${gradeLetter}</span>
                <span class="grade-points-small">${formatNumber(score.toFixed(1))} pts</span>
            </div>
        `;

            container.appendChild(div);

            if (!isNaN(score)) {
                totalScore += score;
                count++;
            }
        });

        if (count > 0) {
            const totalText = t.result_total_avg || "Total Average";
            const avg = (totalScore / count).toFixed(2);

            const totalDiv = document.createElement('div');
            totalDiv.className = 'modern-grade-item total-row';
            totalDiv.style.marginTop = '0.5rem';

            totalDiv.innerHTML = `
            <div class="grade-icon-box" style="background-color: rgba(255,255,255,0.2); color: white;">
                <i class='bx bx-calculator'></i>
            </div>
            <div class="grade-info">
                <div class="grade-course-name">${totalText}</div>
            </div>
            <div class="grade-score-box">
                <span class="grade-letter-big" style="color: white;">${formatNumber(avg)}</span>
            </div>
        `;
            container.appendChild(totalDiv);

            const cgpaEl = document.getElementById('cgpa-value');
            if (cgpaEl) cgpaEl.textContent = formatNumber(avg);

            const circle = document.querySelector('.circle');
            if (circle) circle.setAttribute('stroke-dasharray', `${avg}, 100`);
        }
    }

    // --- Replace renderAttendance in script.js ---
    function renderAttendance() {
        const allowedSemesters = ['1', '2'];
        let selectedSem = ui.semesterFilterAttendance.dataset.value;

        if (!selectedSem || !allowedSemesters.includes(selectedSem)) {
            selectedSem = '1';
            ui.semesterFilterAttendance.dataset.value = '1';
        }

        const optionsContainer = ui.semesterFilterAttendance.querySelector('.select-options');
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};
        const semText = lang === 'km' ? 'ឆមាសទី' : 'Semester';

        if (optionsContainer) {
            optionsContainer.innerHTML = allowedSemesters.map(s =>
                `<div class="select-option ${s === selectedSem ? 'selected' : ''}" data-value="${s}">${semText} ${formatNumber(s)}</div>`
            ).join('');

            const triggerSpan = ui.semesterFilterAttendance.querySelector('.select-trigger span');
            if (triggerSpan) triggerSpan.textContent = `${semText} ${formatNumber(selectedSem)}`;
        }

        const gradeMapAtt = {};
        const profileGrade = dataCache.profile?.grade;
        const profileClass = dataCache.profile?.class;

        if (profileGrade) {
            gradeMapAtt[profileGrade] = new Set();
            if (profileClass && !profileClass.includes('វិទ្យា')) {
                gradeMapAtt[profileGrade].add(profileClass);
            }
        }

        Object.values(dataCache.attendance || {}).flat().forEach(item => {
            if (item.grade) {
                if (!gradeMapAtt[item.grade]) gradeMapAtt[item.grade] = new Set();
                const cls = item.exactClass || item.class || item.section;
                if (cls && !cls.includes('វិទ្យា')) {
                    gradeMapAtt[item.grade].add(cls);
                }
            }
        });

        const availableGradesAtt = Object.keys(gradeMapAtt).sort((a, b) => parseInt(a) - parseInt(b));
        let selectedGrade = ui.gradeFilterAttendance ? ui.gradeFilterAttendance.dataset.value : null;

        if (!selectedGrade || selectedGrade === "1" || !gradeMapAtt[selectedGrade]) {
            selectedGrade = String(profileGrade || (availableGradesAtt.length > 0 ? availableGradesAtt[availableGradesAtt.length - 1] : "12"));
            if (ui.gradeFilterAttendance) ui.gradeFilterAttendance.dataset.value = selectedGrade;
        }

        if (ui.gradeFilterAttendance) {
            const gradeOptionsContainer = ui.gradeFilterAttendance.querySelector('.select-options');
            const gradeText = lang === 'km' ? 'ថ្នាក់ទី' : 'Grade';

            if (gradeOptionsContainer) {
                let gradesHTML = '';
                availableGradesAtt.forEach(g => {
                    const sections = Array.from(gradeMapAtt[g]);
                    let displayStr = `${gradeText} ${formatNumber(g)}`;
                    if (sections.length > 0) {
                        displayStr += `[${sections.join(', ')}]`;
                    }
                    const isSelected = String(g) === String(selectedGrade) ? 'selected' : '';
                    gradesHTML += `<div class="select-option ${isSelected}" data-value="${g}">${displayStr}</div>`;
                });

                gradeOptionsContainer.innerHTML = gradesHTML || `<div class="select-option selected" data-value="${selectedGrade}">${gradeText} ${formatNumber(selectedGrade)}</div>`;

                const gradeTrigger = ui.gradeFilterAttendance.querySelector('.select-trigger span');
                if (gradeTrigger) {
                    const triggerSections = gradeMapAtt[selectedGrade] ? Array.from(gradeMapAtt[selectedGrade]) : [];
                    let triggerStr = `${gradeText} ${formatNumber(selectedGrade)}`;
                    if (triggerSections.length > 0) triggerStr += `[${triggerSections.join(', ')}]`;
                    gradeTrigger.textContent = triggerStr;
                }
            }
        }

        if (!dataCache.isHeavyDataLoaded) {
            renderLoadingSkeleton(ui.attendanceListContainer, 3);
            document.getElementById('overall-attendance-percent').textContent = '--%';
            document.getElementById('total-present').textContent = '--';
            document.getElementById('total-absent').textContent = '--';
            document.getElementById('total-permission').textContent = '--';
            return;
        }

        const attendanceInSemester = dataCache.attendance ? (dataCache.attendance[selectedSem] || []) : [];
        const filteredAttendance = attendanceInSemester.filter(record => {
            if (!record.grade || record.grade === "") return true;
            return String(record.grade) === String(selectedGrade);
        });

        if (filteredAttendance.length === 0) {
            document.getElementById('overall-attendance-percent').textContent = '--%';
            document.getElementById('total-present').textContent = formatNumber('0');
            document.getElementById('total-absent').textContent = formatNumber('0');
            document.getElementById('total-permission').textContent = formatNumber('0');

            const summaryChart = document.querySelector('.summary-chart');
            if (summaryChart) summaryChart.style.backgroundImage = '';

            const txtNoRecord = t.msg_no_records_grade || 'No records found for Grade';
            const txtSem = t.msg_semester || 'Semester';

            ui.attendanceListContainer.innerHTML = `
        <div class="card">
            <p>${txtNoRecord} ${formatNumber(selectedGrade)}, ${txtSem} ${formatNumber(selectedSem)}.</p>
        </div>`;
            return;
        }

        const groupedByCourse = filteredAttendance.reduce((acc, record) => {
            const course = record.course || 'Unknown';
            if (!acc[course]) {
                acc[course] = { 'Present': 0, 'Absent': 0, 'Permission': 0, 'Total': 0 };
            }

            const rawStatus = (record.status || '').toString().toLowerCase().trim();
            let statusKey = null;

            if (rawStatus.includes('present') || rawStatus.includes('វត្តមាន') || rawStatus === 'p') {
                statusKey = 'Present';
            } else if (rawStatus.includes('absent') || rawStatus.includes('អវត្តមាន') || rawStatus === 'a') {
                statusKey = 'Absent';
            } else if (rawStatus.includes('permission') || rawStatus.includes('ច្បាប់')) {
                statusKey = 'Permission';
            }

            if (statusKey) acc[course][statusKey]++;
            acc[course]['Total']++;
            return acc;
        }, {});

        let totalPresent = 0, totalAbsent = 0, totalPermission = 0, grandTotal = 0;
        Object.values(groupedByCourse).forEach(counts => {
            totalPresent += counts.Present;
            totalAbsent += counts.Absent;
            totalPermission += counts.Permission;
            grandTotal += counts.Total;
        });

        const overallPercent = grandTotal > 0 ? Math.round((totalPresent / grandTotal) * 100) : 100;

        document.getElementById('overall-attendance-percent').textContent = `${isNaN(overallPercent) ? '--' : formatNumber(overallPercent)}%`;
        document.getElementById('total-present').textContent = formatNumber(totalPresent);
        document.getElementById('total-absent').textContent = formatNumber(totalAbsent);
        document.getElementById('total-permission').textContent = formatNumber(totalPermission);

        const absentDeg = grandTotal > 0 ? (totalAbsent / grandTotal) * 360 : 0;
        const permDeg = grandTotal > 0 ? (totalPermission / grandTotal) * 360 : 0;

        const absentEnd = absentDeg;
        const permEnd = absentDeg + permDeg;

        const summaryChart = document.querySelector('.summary-chart');
        if (summaryChart) {
            summaryChart.style.backgroundImage = `conic-gradient(
            var(--status-denied-text) 0deg ${absentEnd}deg,
            var(--schedule-blue-dark) ${absentEnd}deg ${permEnd}deg,
            var(--status-approved-text) ${permEnd}deg 360deg
        )`;
        }

        const attendanceSummary = Object.entries(groupedByCourse).map(([course, counts]) => ({ course, ...counts }));

        renderList(ui.attendanceListContainer, attendanceSummary, (item) => {
            const div = document.createElement('div');
            div.className = 'card attendance-course-card';

            const totalSessions = item.Total || 0;
            const itemRelevantSessions = Math.max(0, totalSessions - item.Permission);
            const coursePercent = itemRelevantSessions > 0 ? Math.round((item.Present / itemRelevantSessions) * 100) : (totalSessions > 0 ? 0 : 100);

            const presentBar = totalSessions > 0 ? (item.Present / totalSessions) * 100 : 0;
            const absentBar = totalSessions > 0 ? (item.Absent / totalSessions) * 100 : 0;
            const permissionBar = totalSessions > 0 ? (item.Permission / totalSessions) * 100 : 0;

            div.innerHTML = `
        <div class="attendance-course-card-header">
            <h3>${item.course}</h3>
            <span class="attendance-course-card-percent">${isNaN(coursePercent) ? '--' : formatNumber(coursePercent)}%</span>
        </div>
        <div class="progress-bar">
            <div class="progress-bar-fill present" style="width: ${presentBar}%"></div>
            <div class="progress-bar-fill absent" style="width: ${absentBar}%"></div>
            <div class="progress-bar-fill permission" style="width: ${permissionBar}%"></div>
        </div>
        <div class="attendance-course-card-details">
            <span>${t.attendance_present_label || 'Present'}: <b>${formatNumber(item.Present)}</b></span>
            <span>${t.attendance_absent_label || 'Absent'}: <b>${formatNumber(item.Absent)}</b></span>
            <span>${t.attendance_permission_label || 'Permission'}: <b>${formatNumber(item.Permission)}</b></span>
        </div>
    `;
            return div;
        }, `<div class="card"><p>No records found.</p></div>`);
    }

    function updateGpaAndCredits() {
        const gradeToPoint = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0 };
        let totalPoints = 0, totalCourses = 0;
        Object.values(dataCache.scores).flat().forEach(s => {
            const point = gradeToPoint[s.gradeLabel?.toUpperCase()];
            if (point !== undefined) {
                totalPoints += point;
                totalCourses++;
            }
        });
        const cgpa = totalCourses > 0 ? (totalPoints / totalCourses).toFixed(2) : '--';
        const cgpaElement = document.getElementById('cgpa-value');
        if (cgpaElement) cgpaElement.textContent = cgpa;
    }

    function renderProfile() {
        if (!dataCache.profile) return;
        updateGpaAndCredits();

        // Destructure keys matching Google Sheet headers: 'grade' and 'yearStudent'
        const { englishName, studentId, profileImgUrl, grade, yearStudent } = dataCache.profile;

        // Use calculated GPA from results or fallback
        const cgpaEl = document.getElementById('cgpa-value');
        const gpa = cgpaEl ? cgpaEl.textContent : '--';

        const profileCard = document.querySelector('#profile-main-view .profile-card');
        const skeletonLoader = profileCard.querySelector('.profile-skeleton-loader');

        if (profileCard) {
            const tempImg = new Image();
            const finalImgSrc = profileImgUrl || `https://placehold.co/128x128/eeeeee/333333?text=${englishName?.[0] || '?'}`;

            tempImg.onload = () => {
                const existingContent = profileCard.querySelector('.profile-card-content');
                if (existingContent) {
                    existingContent.remove();
                }

                const contentHTML = `
                <div class="profile-card-content">
                    <img id="profile-img-view" class="profile-img-lg"
                        src="${finalImgSrc}"
                        alt="Student profile picture">
                    <h2 id="profile-englishName-view" class="profile-name">${englishName || 'N/A'}</h2>
                    <p id="profile-id-view" class="profile-id">${studentId || 'N/A'}</p>
                </div>
            `;

                if (skeletonLoader) {
                    skeletonLoader.style.display = 'none';
                }
                profileCard.insertAdjacentHTML('beforeend', contentHTML);

                const content = profileCard.querySelector('.profile-card-content');
                setTimeout(() => {
                    if (content) content.classList.add('loaded');
                }, 10);
            };

            tempImg.onerror = () => {
                tempImg.src = `https://placehold.co/128x128/eeeeee/333333?text=${englishName?.[0] || '?'}`;
            };

            tempImg.src = finalImgSrc;
        }

        // --- UPDATE PROFILE STATS ---
        const profileGpaEl = document.getElementById('profile-gpa');
        const profileGradeEl = document.getElementById('profile-grade-stat');
        const profileYearEl = document.getElementById('profile-year');

        if (profileGpaEl) profileGpaEl.textContent = gpa;

        // Display Grade directly from sheet data
        if (profileGradeEl) profileGradeEl.textContent = grade || '--';

        // Display Year Student directly from sheet data
        if (profileYearEl) profileYearEl.textContent = yearStudent || '--';

        populateFullProfileDetails(dataCache.profile);
    }

    function populateFullProfileDetails(profile) {
        // 1. Header Images & Name
        document.getElementById('my-profile-img').src = profile.profileImgUrl || `https://placehold.co/128x128/eeeeee/333333?text=${profile.englishName?.[0] || '?'}`;
        document.getElementById('my-profile-name').textContent = profile.englishName;
        document.getElementById('my-profile-id').textContent = profile.studentId;

        // 2. Personal Information (Standard Fields)
        const personalFields = ['khmerName', 'phone', 'sex', 'dob', 'email'];
        personalFields.forEach(key => {
            const el = document.getElementById(`profile-${key}`);
            if (el) {
                let value = profile[key] || '';
                if (key === 'dob' && value) {
                    value = new Date(value).toLocaleDateString('en-GB');
                }
                el.textContent = value;
            }
        });
        if (ui.emailInput) ui.emailInput.value = profile.email || '';

        // 3. ACADEMIC INFORMATION (Fixing the mapping here)

        // Map Google Sheet 'grade' -> HTML 'Class'
        const classEl = document.getElementById('profile-display-class');
        if (classEl) classEl.textContent = profile.grade || '';

        // Map Google Sheet 'section' -> HTML 'Major'
        const majorEl = document.getElementById('profile-display-major');
        if (majorEl) majorEl.textContent = profile.section || '';

        // Map Google Sheet 'generation' -> HTML 'Generation'
        const genEl = document.getElementById('profile-display-generation');
        if (genEl) genEl.textContent = profile.generation || '';

        // Map Google Sheet 'yearStudent' -> HTML 'Year student'
        const yearEl = document.getElementById('profile-display-year');
        if (yearEl) yearEl.textContent = profile.yearStudent || '';
    }

    // --- SUB-PAGE LOGIC ---
    function handleResultItemClick(e) {
        const resultItem = e.target.closest('.result-item');
        if (resultItem && resultItem.dataset.courseName) {
            lastFocusedElement = resultItem;
            showResultDetail(resultItem.dataset.courseName);
        }
    }

    function showResultDetail(courseName) {
        if (ui.resultSection.dataset.isAnimating) return;
        ui.resultSection.dataset.isAnimating = 'true';

        document.getElementById('result-detail-title').textContent = courseName;

        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        // --- 1. MONTHLY HISTORY LOGIC (Keep previous fix) ---
        const scoreContainer = document.getElementById('result-score-details');
        scoreContainer.innerHTML = '';

        const monthOrder = [
            'October', 'តុលា', 'November', 'វិច្ឆិកា', 'December', 'ធ្នូ',
            'January', 'មករា', 'February', 'កុម្ភៈ', 'March', 'មីនា',
            'April', 'មេសា', 'May', 'ឧសភា', 'June', 'មិថុនា',
            'July', 'កក្កដា', 'August', 'សីហា', 'September', 'កញ្ញា'
        ];

        const allMonthsData = [];
        const normalize = (str) => (str || '').toString().toLowerCase().trim();
        const targetCourse = normalize(courseName);

        if (dataCache.scores) {
            Object.keys(dataCache.scores).forEach(sheetName => {
                if (sheetName.toLowerCase().includes('semester') || sheetName.toLowerCase().includes('ឆមាស')) return;
                const courseData = dataCache.scores[sheetName]?.find(s => normalize(s.course) === targetCourse);
                if (courseData) {
                    allMonthsData.push({
                        month: sheetName,
                        score: courseData.totalScore,
                        grade: courseData.gradeLabel
                    });
                }
            });
        }

        allMonthsData.sort((a, b) => {
            let idxA = monthOrder.findIndex(m => a.month.includes(m));
            let idxB = monthOrder.findIndex(m => b.month.includes(m));
            if (idxA === -1) idxA = 99;
            if (idxB === -1) idxB = 99;
            return idxA - idxB;
        });

        if (allMonthsData.length > 0) {
            allMonthsData.forEach(item => {
                const scoreVal = parseFloat(item.score) || 0;
                let colorClass = 'var(--primary-text)';
                if (item.grade === 'A' || item.grade === 'B') colorClass = '#10B981';
                else if (item.grade === 'C') colorClass = '#F59E0B';
                else if (item.grade === 'F') colorClass = '#EF4444';

                scoreContainer.innerHTML += `
                <div class="detail-item">
                    <span class="detail-label" style="font-weight:600; color:var(--primary-text);">${item.month}</span>
                    <div style="text-align:right;">
                        <span class="detail-value" style="font-size:1.1rem;">${formatNumber(item.score)}</span>
                        <span style="font-size:0.8rem; font-weight:700; color:${colorClass}; margin-left:8px;">${item.grade}</span>
                    </div>
                </div>`;
            });
        } else {
            // --- FALLBACK: SHOW SEMESTER DETAILS WITH TRANSLATED LABELS ---
            const selectedSem = ui.semesterFilterResult.dataset.value || currentSemester;
            const courseScores = dataCache.scores[selectedSem]?.find(s => normalize(s.course) === targetCourse);

            if (courseScores) {
                // Use keys from translation file
                const scoreMap = {
                    [t.label_score_attendance || 'Attendance']: courseScores.attendanceScore,
                    [t.label_score_assignment || 'Assignment']: courseScores.assignmentScore,
                    [t.label_score_midterm || 'Midterm']: courseScores.midtermScore,
                    [t.label_score_final || 'Final']: courseScores.finalScore,
                    [t.label_score_total || 'Total Score']: courseScores.totalScore,
                    [t.label_score_ranking || 'Ranking']: courseScores.ranking,
                    [t.label_score_grade || 'Final Grade']: courseScores.grade
                };
                for (const [label, value] of Object.entries(scoreMap)) {
                    scoreContainer.innerHTML += `<div class="detail-item"><span class="detail-label">${label}</span><span class="detail-value">${formatNumber(value || 'N/A')}</span></div>`;
                }
            } else {
                scoreContainer.innerHTML = `<div class="detail-item"><span class="detail-value">${t.msg_no_score_details || 'No score details available.'}</span></div>`;
            }
        }

        // --- 2. ATTENDANCE SUMMARY WITH TRANSLATION ---
        const attendanceContainer = document.getElementById('result-attendance-summary');
        attendanceContainer.innerHTML = '';

        let totalPresent = 0, totalAbsent = 0, totalPermission = 0;

        if (dataCache.attendance) {
            Object.values(dataCache.attendance).flat().forEach(record => {
                if (normalize(record.course) === targetCourse) {
                    const status = (record.status || '').toLowerCase();
                    if (status.includes('present') || status.includes('វត្តមាន')) totalPresent++;
                    else if (status.includes('absent') || status.includes('អវត្តមាន')) totalAbsent++;
                    else if (status.includes('permission') || status.includes('ច្បាប់')) totalPermission++;
                }
            });
        }

        if (totalPresent + totalAbsent + totalPermission > 0) {
            const lblPresent = t.label_score_attendance || 'Attendance'; // Or specific key if different
            const lblPerm = t.attendance_permission_label || 'Permission';
            const lblAbsent = t.attendance_absent_label || 'Absent';

            attendanceContainer.innerHTML += `<div class="detail-item"><span class="detail-label">${lblPresent}</span><span class="detail-value" style="color:#10B981">${formatNumber(totalPresent)}</span></div>`;
            attendanceContainer.innerHTML += `<div class="detail-item"><span class="detail-label">${lblPerm}</span><span class="detail-value" style="color:#F59E0B">${formatNumber(totalPermission)}</span></div>`;
            attendanceContainer.innerHTML += `<div class="detail-item"><span class="detail-label">${lblAbsent}</span><span class="detail-value" style="color:#EF4444">${formatNumber(totalAbsent)}</span></div>`;
        } else {
            const msg = lang === 'km' ? 'គ្មានទិន្នន័យវត្តមាន' : 'No attendance records found.';
            attendanceContainer.innerHTML = `<div class="detail-item"><span class="detail-value">${msg}</span></div>`;
        }

        onAnimationEnd(ui.resultDetailView, () => {
            ui.resultMainView.classList.add('hidden');
            ui.resultMainView.classList.remove('slide-out-to-left');
            ui.resultDetailView.classList.remove('slide-in-from-right');
            delete ui.resultSection.dataset.isAnimating;
            ui.resultDetailView.querySelector('.back-button').focus();
        });
        ui.resultDetailView.classList.remove('hidden');
        ui.resultMainView.classList.add('slide-out-to-left');
        ui.resultDetailView.classList.add('slide-in-from-right');
    }

    function showResultMainPage() {
        if (ui.resultDetailView.classList.contains('hidden') || ui.resultSection.dataset.isAnimating) return;
        ui.resultSection.dataset.isAnimating = 'true';
        onAnimationEnd(ui.resultMainView, () => {
            ui.resultDetailView.classList.add('hidden');
            ui.resultDetailView.classList.remove('slide-out-to-right');
            ui.resultMainView.classList.remove('slide-in-from-left');
            delete ui.resultSection.dataset.isAnimating;
            if (lastFocusedElement) {
                lastFocusedElement.focus();
                lastFocusedElement = null;
            }
        });
        ui.resultMainView.classList.remove('hidden');
        ui.resultDetailView.classList.add('slide-out-to-right');
        ui.resultMainView.classList.add('slide-in-from-left');
    }

    function handleProfileBack() {
        if (clockInterval) clearInterval(clockInterval);
        const previousPageId = profileNavHistory.pop();
        const fromPage = ui.profileSection.querySelector('.sub-page:not(.hidden)');
        const toPage = previousPageId ? document.getElementById(previousPageId) : ui.profileMainView;
        if (!fromPage) return;
        transitionProfilePages(fromPage, toPage, 'back');
    }

    function transitionProfilePages(fromPage, toPage, direction = 'forward') {
        if (ui.profileSection.dataset.isAnimating) return;
        ui.profileSection.dataset.isAnimating = 'true';
        const [outClass, inClass] = direction === 'forward'
            ? ['slide-out-to-left', 'slide-in-from-right']
            : ['slide-out-to-right', 'slide-in-from-left'];
        onAnimationEnd(toPage, () => {
            fromPage.classList.add('hidden');
            fromPage.classList.remove(outClass);
            toPage.classList.remove(inClass);
            delete ui.profileSection.dataset.isAnimating;
            if (direction === 'back') {
                if (lastFocusedElement) {
                    lastFocusedElement.focus();
                    lastFocusedElement = null;
                }
            } else {
                toPage.querySelector('.back-button')?.focus();
            }
        });
        toPage.classList.remove('hidden');
        fromPage.classList.add(outClass);
        toPage.classList.add(inClass);
    }

    function showProfileSubPage(subPage) {
        const fromPage = ui.profileSection.querySelector('#profile-main-view:not(.hidden), .sub-page:not(.hidden)');
        if (fromPage) {
            profileNavHistory.push(fromPage.id);
            lastFocusedElement = document.activeElement;
            transitionProfilePages(fromPage, subPage, 'forward');
        }
    }

    function showProfileMainPage() {
        if (clockInterval) clearInterval(clockInterval);
        const activeSubPage = ui.profileSection.querySelector('.sub-page:not(.hidden)');
        if (activeSubPage) {
            transitionProfilePages(activeSubPage, ui.profileMainView, 'back');
        } else {
            ui.profileMainView.classList.remove('hidden');
            ui.myProfileView.classList.add('hidden');
            ui.changePasswordView.classList.add('hidden');
            ui.languageView.classList.add('hidden');
            ui.editEmailView.classList.add('hidden');
            ui.feedbackView.classList.add('hidden');
            ui.securityView.classList.add('hidden');
            if (ui.digitalIdView) ui.digitalIdView.classList.add('hidden');
            if (ui.appearanceView) ui.appearanceView.classList.add('hidden');
        }
        profileNavHistory = [];
    }

    async function handleRequestPermissionClick(e) {
        e.preventDefault();

        // 1. Check for valid email
        const hasValidEmail = dataCache.profile && dataCache.profile.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dataCache.profile.email);
        if (!hasValidEmail) {
            const lang = localStorage.getItem('language') || 'km';
            const t = translations[lang] || {};
            showToast(t.toast_add_email || "Please add an email address.", 'toast-fixed-width');
            handleNavigation('#profile');
            setTimeout(() => { showProfileSubPage(ui.editEmailView); }, 100);
            return;
        }

        // 2. DISABLE BUTTON TO PREVENT SPAM CLICKS
        const btn = e.currentTarget;
        btn.disabled = true;

        // 3. NAVIGATE IMMEDIATELY & SHOW SKELETON LOADER
        showPermissionRequestPage('loading');

        try {
            // 4. CHECK STATUS FROM SERVER
            const token = localStorage.getItem('token');
            const response = await fetch(`${SCRIPT_URL}?action=getLatestPermissionRequest&token=${token}`);
            const result = await response.json();

            // 5. DECIDE DISPLAY MODE (Case-insensitive check for 'Pending')
            const isPending = result.success && result.data && (result.data.Status || '').toLowerCase() === 'pending';

            if (isPending) {
                // FOUND PENDING -> SWITCH CONTENT TO OVERLAY
                dataCache.latestPermissionRequest = result.data;
                updatePermissionRequestPageContent('overlay');
            } else {
                // APPROVED / REJECTED / NO DATA -> SWITCH CONTENT TO FORM
                dataCache.latestPermissionRequest = null;
                updatePermissionRequestPageContent('form');
            }

        } catch (error) {
            console.error("Error checking status:", error);
            updatePermissionRequestPageContent('form'); // Default to form on error
        } finally {
            btn.disabled = false;
        }
    }


    function updatePermissionRequestPageContent(mode) {
        const skeleton = document.getElementById('permission-form-skeleton');
        const form = document.getElementById('permissionRequestForm');
        const overlay = document.getElementById('permission-overlay');

        if (mode === 'loading') {
            skeleton.classList.remove('hidden');
            form.classList.add('hidden');
            overlay.classList.remove('show');
            overlay.classList.add('hidden');
        } else if (mode === 'overlay') {
            skeleton.classList.add('hidden');
            form.classList.add('hidden');
            renderPermissionOverlay();
        } else {
            // Mode is 'form'
            skeleton.classList.add('hidden');
            form.classList.remove('hidden');
            overlay.classList.remove('show');
            overlay.classList.add('hidden');

            // Reset form date
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateInput = document.getElementById('permissionDate');
            if (dateInput) dateInput.value = `${year}-${month}-${day}`;

            if (typeof updateFormVisibility === 'function') updateFormVisibility();
        }
    }

    function showPermissionRequestPage(mode = 'form') {
        if (ui.attendanceSection.dataset.isAnimating) return;

        ui.attendanceSection.dataset.isAnimating = 'true';
        lastFocusedElement = document.activeElement;

        // Apply the requested UI state (loading/form/overlay)
        updatePermissionRequestPageContent(mode);

        // Animate Transition to Sub-page
        onAnimationEnd(ui.permissionRequestView, () => {
            ui.attendanceMainView.classList.add('hidden');
            ui.attendanceMainView.classList.remove('slide-out-to-left');
            ui.permissionRequestView.classList.remove('slide-in-from-right');
            delete ui.attendanceSection.dataset.isAnimating;
            ui.permissionRequestView.querySelector('.back-button').focus();
        });

        ui.permissionRequestView.classList.remove('hidden');
        ui.attendanceMainView.classList.add('slide-out-to-left');
        ui.permissionRequestView.classList.add('slide-in-from-right');
    }



    function showAttendanceMainPage() {
        if (activeVirtualScrollListener) {
            ui.mainContent.removeEventListener('scroll', activeVirtualScrollListener);
            activeVirtualScrollListener = null;
            const historyListContainer = document.getElementById('permission-history-list');
            historyListContainer.innerHTML = '';
            historyListContainer.style.height = '';
            historyListContainer.style.position = '';
            historyListContainer.style.overflow = '';
        }
        const activeSubPage = ui.attendanceSection.querySelector('.sub-page:not(.hidden)');
        if (!activeSubPage || ui.attendanceSection.dataset.isAnimating) return;
        ui.attendanceSection.dataset.isAnimating = 'true';
        onAnimationEnd(ui.attendanceMainView, () => {
            activeSubPage.classList.add('hidden');
            activeSubPage.classList.remove('slide-out-to-right');
            ui.attendanceMainView.classList.remove('slide-in-from-left');
            delete ui.attendanceSection.dataset.isAnimating;
            if (lastFocusedElement) {
                lastFocusedElement.focus();
                lastFocusedElement = null;
            }
        });
        ui.attendanceMainView.classList.remove('hidden');
        activeSubPage.classList.add('slide-out-to-right');
        ui.attendanceMainView.classList.add('slide-in-from-left');
    }

    function renderPermissionHistoryList() {
        const historyListContainer = document.getElementById('permission-history-list');

        if (!dataCache.permissionHistory || dataCache.permissionHistory.length === 0) {
            historyListContainer.style.height = 'auto';
            historyListContainer.innerHTML = '<div class="card"><p>No history available.</p></div>';
            return;
        }

        renderVirtualizedList(historyListContainer, dataCache.permissionHistory, (item) => {
            const div = document.createElement('div');
            div.className = 'swipe-container';
            div.dataset.transactionId = item.TransactionID;

            div.innerHTML = `
                <div class="swipe-action-delete" aria-label="Delete">
                    <i class='bx bx-trash'></i>
                    <span>Delete</span>
                </div>
                <div class="swipe-card card" style="margin-bottom: 0; border: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                        <div>
                            <p style="font-weight: 600; margin-bottom: 0.25rem;">${item.StatusType}</p>
                            <small style="color: var(--secondary-text);">
                                ${new Date(item.RequestDate).toLocaleDateString('en-GB')}
                            </small>
                        </div>
                        <span class="status-badge status-${(item.Status || '').toLowerCase()}">${getTranslatedStatus(item.Status)}</span>
                    </div>
                </div>
            `;
            return div;
        }, 85);
    }

    async function showPermissionHistoryPage(e) {
        if (e) e.preventDefault();

        const isAlreadyVisible = !ui.permissionHistoryView.classList.contains('hidden');

        if (!isAlreadyVisible) {
            if (ui.attendanceSection.dataset.isAnimating) return;
            ui.attendanceSection.dataset.isAnimating = 'true';
            lastFocusedElement = document.activeElement;

            onAnimationEnd(ui.permissionHistoryView, () => {
                ui.attendanceMainView.classList.add('hidden');
                ui.attendanceMainView.classList.remove('slide-out-to-left');
                ui.permissionHistoryView.classList.remove('slide-in-from-right');
                delete ui.attendanceSection.dataset.isAnimating;
                ui.permissionHistoryView.querySelector('.back-button').focus();
            });
            ui.permissionHistoryView.classList.remove('hidden');
            ui.attendanceMainView.classList.add('slide-out-to-left');
            ui.permissionHistoryView.classList.add('slide-in-from-right');
        }

        const historyListContainer = document.getElementById('permission-history-list');

        // Show skeleton only on first load
        if (!isAlreadyVisible) {
            historyListContainer.innerHTML = `
            <div class="skeleton skeleton-card"></div>
            <div class="skeleton skeleton-card"></div>
            <div class="skeleton skeleton-card"></div>`;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SCRIPT_URL}?action=getAllPermissionRequests&token=${token}`);
            const result = await response.json();

            if (result.success && result.data) {
                // Save to local cache and render instantly
                dataCache.permissionHistory = result.data.filter(item => item.Status !== 'Pending');
                renderPermissionHistoryList();
            }
        } catch (error) {
            historyListContainer.style.height = 'auto';
            historyListContainer.innerHTML = `<div class="card"><p>Error loading history: ${error.message}</p></div>`;
        }
    }

    // --- SWIPE TO DELETE LOGIC FOR HISTORY ---
    let startX = 0, currentX = 0;
    let isSwiping = false;
    let activeSwipeCard = null;

    const historyList = document.getElementById('permission-history-list');

    historyList.addEventListener('touchstart', (e) => {
        const swipeCard = e.target.closest('.swipe-card');
        if (!swipeCard) return;

        // Close any previously opened cards
        document.querySelectorAll('.swipe-card.swiped-open').forEach(card => {
            if (card !== swipeCard) card.classList.remove('swiped-open');
        });

        startX = e.touches[0].clientX;
        isSwiping = true;
        activeSwipeCard = swipeCard;
        activeSwipeCard.classList.add('is-swiping');
    }, { passive: true });

    historyList.addEventListener('touchmove', (e) => {
        if (!isSwiping || !activeSwipeCard) return;
        currentX = e.touches[0].clientX;
        const diffX = currentX - startX;

        // Only allow swiping left (negative diffX), up to -100px max resistance
        if (diffX < 0 && diffX > -100) {
            activeSwipeCard.style.transform = `translateX(${diffX}px)`;
        }
    }, { passive: true });

    historyList.addEventListener('touchend', (e) => {
        if (!isSwiping || !activeSwipeCard) return;
        isSwiping = false;
        activeSwipeCard.classList.remove('is-swiping');

        const diffX = currentX - startX;

        // If swiped more than 40px left, snap open. Otherwise, snap closed.
        if (diffX < -40) {
            activeSwipeCard.style.transform = ''; // Clear inline style
            activeSwipeCard.classList.add('swiped-open');
        } else {
            activeSwipeCard.style.transform = '';
            activeSwipeCard.classList.remove('swiped-open');
        }
        activeSwipeCard = null;
    });

    // --- HANDLE DELETE BUTTON CLICK ---
    historyList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.swipe-action-delete');
        if (deleteBtn) {
            const container = deleteBtn.closest('.swipe-container');
            const transactionId = container.dataset.transactionId;

            showCustomConfirm(
                "Delete Record",
                "Are you sure you want to delete this history record? This cannot be undone.",
                async () => {
                    // 1. FREEZE THE SCREEN: Prevent clicking and scrolling
                    document.body.classList.add('is-processing');

                    // 2. Show loading spinner on the delete button
                    const icon = deleteBtn.querySelector('i');
                    icon.className = 'bx bx-loader-alt bx-spin';

                    try {
                        const token = localStorage.getItem('token');
                        const payload = { token, transactionId };

                        // 3. Wait for server deletion
                        const res = await fetch(SCRIPT_URL, {
                            method: 'POST',
                            body: JSON.stringify({ action: 'deletePermissionRequest', payload }),
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                        });

                        const result = await res.json();

                        if (result.success) {
                            showToast("Record deleted successfully.", "success");

                            // 4. Animate the card sliding out
                            container.classList.add('removing');

                            // 5. After animation (300ms), remove from local array & rebuild list
                            setTimeout(() => {
                                if (dataCache.permissionHistory) {
                                    dataCache.permissionHistory = dataCache.permissionHistory.filter(item => item.TransactionID !== transactionId);
                                    renderPermissionHistoryList();
                                }

                                // UNFREEZE THE SCREEN
                                document.body.classList.remove('is-processing');
                            }, 300);

                        } else {
                            showToast(result.message || "Failed to delete.", "error");
                            icon.className = 'bx bx-trash'; // Restore trash icon
                            document.body.classList.remove('is-processing'); // UNFREEZE
                        }
                    } catch (err) {
                        showToast("Network error.", "error");
                        icon.className = 'bx bx-trash'; // Restore trash icon
                        document.body.classList.remove('is-processing'); // UNFREEZE
                    }
                }
            );
        }
    });

    async function handlePermissionSubmit(e) {
        e.preventDefault();
        const form = ui.permissionRequestForm;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!dataCache.profile) {
            showToast('Profile data not loaded. Cannot submit.', 'error');
            return;
        }

        form.querySelectorAll('.form-field.error').forEach(el => el.classList.remove('error'));

        const { generation, major, class: pClass } = dataCache.profile;
        const requestDateInput = document.getElementById('permissionDate');
        const reasonInput = document.getElementById('permissionReason');

        // 1. AUTOMATICALLY SET STATUS TO CLASS SKIP ("ច្បាប់ម៉ោងរៀន")
        const selectedStatus = 'ច្បាប់ម៉ោងរៀន';

        const requestDate = requestDateInput.value;
        const reason = reasonInput.value;
        let duration = '';

        // 2. GET DURATION (AM / PM / 1 Day)
        const durationRadio = form.querySelector('input[name="Day"]:checked');
        if (durationRadio) duration = durationRadio.value;

        let isValid = true;

        let selectedSubjects = "No classes";
        if (requestDate && dataCache.schedule) {
            // 1. Get the day of the week in English (e.g., "Monday")
            const dateObj = new Date(requestDate);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

            // 2. Filter the student's schedule for this specific day
            const daySchedule = dataCache.schedule.filter(item => {
                const itemDay = item.day || item.DayOfWeek || item.Day || '';
                return itemDay.toLowerCase() === dayName.toLowerCase();
            });

            // 3. Filter by Time (AM / PM)
            const timeFilteredSchedule = daySchedule.filter(item => {
                // If it's a full day ("1"), keep all classes
                if (duration === '1') return true;

                // Get the start time of the class
                const startTime = item.startTime || item.StartTime || item.Start;
                let startHour = 0;

                // Safely parse the hour from various data formats
                if (startTime instanceof Date) {
                    startHour = startTime.getHours();
                } else if (typeof startTime === 'string' && startTime.includes('T')) {
                    startHour = new Date(startTime).getHours();
                } else if (typeof startTime === 'string') {
                    const str = startTime.toLowerCase().trim();
                    let h = parseInt(str.split(':')[0]);
                    if (str.includes('pm') && h < 12) h += 12;
                    if (str.includes('am') && h === 12) h = 0;
                    startHour = h;
                }

                // Check against the selected duration
                if (duration === 'AM') {
                    return startHour < 12; // Morning classes (before 12 PM)
                } else if (duration === 'PM') {
                    return startHour >= 12; // Afternoon classes (12 PM or later)
                }
                return true;
            });

            // 4. Extract unique subjects and join them with a comma
            if (timeFilteredSchedule.length > 0) {
                const uniqueSubjects = [...new Set(timeFilteredSchedule.map(item => item.course || item.CourseName || item.Subject))].filter(sub => sub);
                selectedSubjects = uniqueSubjects.join(', ');
            }
        }

        if (!requestDate) {
            requestDateInput.closest('.form-field').classList.add('error');
            isValid = false;
        }
        if (!reason.trim()) {
            reasonInput.closest('.form-field').classList.add('error');
            isValid = false;
        }
        if (!duration) {
            const durationGroup = document.getElementById('leave-duration-group');
            if (durationGroup) durationGroup.classList.add('error');
            isValid = false;
        }

        if (!isValid) {
            const lang = localStorage.getItem('language') || 'km';
            const t = translations[lang] || {};
            showToast(t.toast_fill_fields || "Please fill all fields", 'error');
            return;
        }

        toggleButtonSpinner(submitBtn, true);
        const payload = {
            token: localStorage.getItem('token'),
            requestDate,
            reason,
            duration,
            generation,
            major,
            class: pClass,
            statusType: selectedStatus,
            subjects: selectedSubjects // <--- ENSURE THIS LINE IS HERE
        };
        sendPermissionRequest(payload, submitBtn);
    }


    async function sendPermissionRequest(payload, submitBtn) {
        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'submitPermissionRequest', payload }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const result = await res.json();
            if (result.success) {
                const lang = localStorage.getItem('language') || 'km';
                const t = translations[lang] || {};
                showTopNotification(t.perm_submit_success || "Submitted!");

                ui.permissionRequestForm.reset();

                // 1. Manually update the local cache with the new PENDING request
                dataCache.latestPermissionRequest = {
                    TransactionID: result.transactionId,
                    RequestDate: payload.requestDate,
                    StatusType: payload.statusType,
                    duration: payload.duration,
                    Reason: payload.reason,
                    Status: 'Pending',
                    ReturnTimestamp: null
                };

                // 2. Hide the form and show the Invoice immediately 
                updatePermissionRequestPageContent('overlay');

            } else {
                throw new Error(result.message || 'Submission failed on the server.');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            toggleButtonSpinner(submitBtn, false);
        }
    }


    async function updateProfileFieldOnServer(field, value) {
        const payload = {
            token: localStorage.getItem('token'),
            field: field,
            value: value
        };
        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'updateProfileField', payload }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            return await res.json();
        } catch (error) {
            return { success: false, message: 'Could not connect to the server.' };
        }
    }

    async function handleUpdateEmail(e) {
        e.preventDefault();
        const saveBtn = ui.saveEmailBtn;
        const newEmail = ui.emailInput.value.trim();

        if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            return alert('Please enter a valid email address.');
        }

        toggleHeaderButtonSpinner(saveBtn, true);

        try {
            const result = await updateProfileFieldOnServer('email', newEmail);
            if (result.success) {
                // --- TRANSLATION LOGIC ---
                const lang = localStorage.getItem('language') || 'km';
                const t = translations[lang] || {};
                showTopNotification(t.notif_email_updated || 'Email updated successfully!');

                if (dataCache.profile) {
                    dataCache.profile.email = newEmail;
                }
                ui.profileEmail.textContent = newEmail || 'N/A';
                setTimeout(handleProfileBack, 500);
            } else {
                throw new Error(result.message || 'Failed to update email.');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            toggleHeaderButtonSpinner(saveBtn, false);
        }
    }

    function validateStrongPassword(password) {
        if (password.length < 6) return 'Password must be at least 6 characters long.';
        if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
        if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
        if (!/\d/.test(password)) return 'Password must contain at least one number.';
        if (!/[\W_]/.test(password)) return 'Password must contain at least one symbol (e.g., !@#$%).';
        return null; // Returns null if the password is valid
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // 1. Check if empty
        if (!newPassword || !currentPassword) {
            return showToast('All password fields are required.', 'error');
        }

        // 2. Strong Password Check
        const passwordError = validateStrongPassword(newPassword);
        if (passwordError) {
            return showToast(passwordError, 'error');
        }

        // 3. Match Check
        if (newPassword !== confirmPassword) {
            return showToast('New passwords do not match.', 'error');
        }

        toggleButtonSpinner(submitBtn, true);

        const payload = {
            token: localStorage.getItem('token'),
            currentPassword,
            newPassword
        };

        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'changePassword', payload }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const result = await res.json();

            if (result.success) {
                // --- TRANSLATION LOGIC ---
                const lang = localStorage.getItem('language') || 'km';
                const t = translations[lang] || {};
                showTopNotification(t.notif_password_updated || 'Password updated successfully!');

                ui.passwordChangeForm.reset();
                setTimeout(handleProfileBack, 500);
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('Error: Could not send request.', 'error');
        } finally {
            toggleButtonSpinner(submitBtn, false);
        }
    }

    async function handleFeedbackSubmit(e) {
        e.preventDefault();
        const form = ui.feedbackForm;
        const submitBtn = form.querySelector('button[type="submit"]');
        const category = document.getElementById('feedbackCategorySelect').dataset.value;
        const message = document.getElementById('feedbackMessage').value;

        if (!message || message.trim().length < 10) {
            showToast('Please enter a message at least 10 characters long.');
            return;
        }

        toggleButtonSpinner(submitBtn, true);

        const payload = {
            token: localStorage.getItem('token'),
            category,
            message
        };

        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'submitFeedback', payload }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const result = await res.json();

            if (result.success) {
                // --- TRANSLATION LOGIC ---
                const lang = localStorage.getItem('language') || 'km';
                const t = translations[lang] || {};
                showTopNotification(t.notif_feedback_submitted || 'Feedback submitted successfully!');

                form.reset();
                // Reset the custom select dropdown text if needed
                const triggerText = form.querySelector('#feedbackCategorySelect .select-trigger span');
                const defaultOption = form.querySelector('#feedbackCategorySelect .select-option');
                if (triggerText && defaultOption) {
                    triggerText.textContent = defaultOption.textContent.trim();
                }
                setTimeout(handleProfileBack, 500);
            } else {
                throw new Error(result.message || 'Submission failed.');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            toggleButtonSpinner(submitBtn, false);
        }
    }

    async function handleProfileImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            return alert('Please select an image file.');
        }
        const MAX_SIZE_MB = 5;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return alert(`File is too large. Max size is ${MAX_SIZE_MB}MB.`);
        }
        const imageContainer = document.querySelector('.profile-image-changer');
        imageContainer.classList.add('uploading');
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            try {
                const base64Data = reader.result.split(',')[1];
                const payload = {
                    token: localStorage.getItem('token'),
                    fileName: file.name,
                    mimeType: file.type,
                    fileData: base64Data
                };
                const res = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'uploadImage', payload }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                const result = await res.json();
                if (result.success && result.newImageUrl) {
                    alert('Profile image updated!');
                    const newUrl = result.newImageUrl + '&t=' + new Date().getTime();
                    document.getElementById('profile-img-view').src = newUrl;
                    document.getElementById('my-profile-img').src = newUrl;
                    if (dataCache.profile) {
                        dataCache.profile.profileImgUrl = newUrl;
                    }
                } else {
                    throw new Error(result.message || 'Upload failed.');
                }
            } catch (error) {
                alert(error.message);
            } finally {
                imageContainer.classList.remove('uploading');
                e.target.value = '';
            }
        };
        reader.onerror = () => {
            alert('Failed to read file.');
            imageContainer.classList.remove('uploading');
        };
    }

    // --- PERMISSION OVERLAY LOGIC ---
    async function checkExistingPermissionRequest() {
        const overlay = document.getElementById('permission-overlay');
        const token = localStorage.getItem('token');
        const skeleton = document.getElementById('permission-form-skeleton');

        try {
            const res = await fetch(`${SCRIPT_URL}?action=getLatestPermissionRequest&token=${token}`);
            const result = await res.json();

            if (skeleton) skeleton.classList.add('hidden');

            if (result.success && result.data) {
                dataCache.latestPermissionRequest = result.data;
                const req = result.data;

                if (req.Status === 'Pending') {
                    // Pending -> Show Invoice Overlay (on top of whatever view is active)
                    // Hide form container sub-page if it was attempting to show
                    ui.permissionRequestView.classList.add('hidden');
                    ui.attendanceMainView.classList.remove('hidden');
                    renderPermissionOverlay();
                } else {
                    // Approved/Rejected -> Ensure overlay is hidden
                    overlay.classList.remove('show');
                    overlay.classList.add('hidden');
                }
            } else {
                dataCache.latestPermissionRequest = null;
                overlay.classList.remove('show');
                overlay.classList.add('hidden');
            }

        } catch (error) {
            console.error("Error checking permissions:", error);
            if (skeleton) skeleton.classList.add('hidden');
        }
    }

    function getDisplayDuration(dayValue) {
        if (!dayValue) return 'N/A';
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        // Fixed keys handled by JSON translation
        if (dayValue === 'AM') return t.perm_duration_morning || '1 Morning';
        if (dayValue === 'PM') return t.perm_duration_afternoon || '1 Afternoon';
        if (dayValue === 'Night') return t.perm_duration_night || '1 Night';
        if (String(dayValue) === '0.5') return t.perm_duration_half_day || 'Half Day';
        if (String(dayValue) === '1') return t.perm_duration_1_day || '1 Day';
        if (String(dayValue) === '2') return t.perm_duration_2_days || '2 Days';
        if (String(dayValue) === '3') return t.perm_duration_3_days || '3 Days';
        if (String(dayValue) === '4') return t.perm_duration_4_days || '4 Days';
        if (String(dayValue) === '5') return t.perm_duration_5_days || '5 Days';

        // Fallback for other numbers: Convert the number part
        const dayText = t.duration_days || 'Days';
        return `${formatNumber(dayValue)} ${dayText}`;
    }

    function renderPermissionOverlay() {
        const overlay = document.getElementById('permission-overlay');
        const request = dataCache.latestPermissionRequest;
        const profile = dataCache.profile;

        // Safety Check
        if (!request || !profile) {
            overlay.classList.remove('show');
            overlay.classList.add('hidden');
            return;
        }

        // --- FIX: KEEP OVERLAY IN THE FORM CONTAINER ---
        // Ensure it sits in the sub-page layout properly
        const container = document.getElementById('permission-form-container');
        if (overlay.parentNode !== container) {
            container.appendChild(overlay);
        }

        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        // 1. Populate Profile Image
        const imgElement = document.getElementById('overlay-profile-img');
        if (imgElement) {
            imgElement.src = profile.profileImgUrl || `https://placehold.co/128x128/eeeeee/333333?text=${profile.englishName?.[0] || '?'}`;
        }

        // 2. Build Details List (Robust Key Mapping to catch both lowercase & uppercase DB names)
        const detailsList = document.getElementById('overlay-details-list');
        detailsList.innerHTML = '';

        const details = {
            [t.perm_label_name || 'Name']: profile.englishName,
            [t.perm_label_grade || 'Class']: profile.grade,
            [t.perm_label_request_date || 'Request Date']: new Date(request.RequestDate || request.requestDate).toLocaleDateString('en-GB'),
            [t.perm_label_leave_type || 'Leave Type']: request.StatusType || request.statusType,
            [t.perm_label_duration || 'Duration']: getDisplayDuration(request.duration || request.DayStop),
            [t.perm_label_reason || 'Reason']: request.Reason || request.reason,
            [t.perm_label_status || 'Status']: `<span class="status-badge status-${(request.Status || '').toLowerCase()}">${getTranslatedStatus(request.Status)}</span>`
        };

        if (request.ReturnTimestamp) {
            const returnDate = new Date(request.ReturnTimestamp);
            const formattedTime = returnDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const formattedDate = returnDate.toLocaleDateString('en-GB');
            details[t.perm_label_returned_on || 'Returned On'] = `${formattedDate} at ${formattedTime}`;
        }

        for (const [label, value] of Object.entries(details)) {
            const item = document.createElement('div');
            item.className = 'detail-item';
            item.innerHTML = `<span class="detail-label">${label}</span><span class="detail-value">${value || 'N/A'}</span>`;
            detailsList.appendChild(item);
        }

        // 3. Handle Buttons
        const withdrawBtn = document.getElementById('withdrawRequestBtn');
        const requestAgainBtn = document.getElementById('requestNewPermissionBtn');
        const checkInBtn = document.getElementById('checkInBtn');

        if (withdrawBtn) withdrawBtn.style.display = 'none';
        if (requestAgainBtn) requestAgainBtn.style.display = 'none';
        if (checkInBtn) checkInBtn.style.display = 'none';

        const statusLower = (request.Status || '').toLowerCase();

        if (statusLower === 'pending') {
            if (withdrawBtn) withdrawBtn.style.display = 'inline-flex';
        }
        else if (statusLower === 'approved') {
            if (requestAgainBtn) requestAgainBtn.style.display = 'inline-flex';
            const validTypesForCheckIn = ['ច្បាប់ទៅផ្ទះ', 'ច្បាប់ចេញចូល'];
            const hasReturned = !!request.ReturnTimestamp;
            if (validTypesForCheckIn.includes(request.StatusType) && !hasReturned) {
                if (checkInBtn) checkInBtn.style.display = 'inline-flex';
            }
        }
        else {
            if (requestAgainBtn) requestAgainBtn.style.display = 'inline-flex';
        }

        // 4. Show Overlay
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('show'), 10);
    }

    function handleRequestAgain(e) {
        if (e) e.preventDefault();
        const overlay = document.getElementById('permission-overlay');

        // If the overlay was moved to body, move it back to its container (optional but good for structure)
        const container = document.getElementById('permission-form-container');
        if (container && overlay.parentNode === document.body) {
            container.appendChild(overlay);
        }

        // Switch to the Form View instantly
        updatePermissionRequestPageContent('form');
    }


    async function handleCheckIn() {
        if (!dataCache.latestPermissionRequest) return;
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        const targetLocation = { latitude: 11.416196, longitude: 104.764711 };
        const maxDistanceKm = 0.33;

        showToast(t.location_checking || "Checking location...");

        if (!navigator.geolocation) {
            showToast(t.location_unsupported || "Geolocation not supported", 'error');
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            const distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                targetLocation.latitude,
                targetLocation.longitude
            );

            if (distance <= maxDistanceKm) {
                const onConfirm = async () => {
                    const checkInBtn = document.getElementById('checkInBtn');
                    toggleButtonSpinner(checkInBtn, true);
                    const payload = {
                        studentId: localStorage.getItem('token'),
                        transactionId: dataCache.latestPermissionRequest.TransactionID
                    };
                    try {
                        const res = await fetch(SCRIPT_URL, {
                            method: 'POST',
                            body: JSON.stringify({ action: 'logReturn', payload }),
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                        });
                        const result = await res.json();
                        if (result.success) {
                            const lang = localStorage.getItem('language') || 'km';
                            const t = translations[lang] || {};
                            showTopNotification(t.notif_checked_in || 'Checked in successfully!');

                            dataCache.latestPermissionRequest = null;
                            handleRequestAgain();
                        } else {
                            throw new Error(result.message || 'Failed to check-in.');
                        }
                    } catch (error) {
                        alert(`Error: ${error.message}`);
                    } finally {
                        toggleButtonSpinner(checkInBtn, false);
                    }
                };

                showCustomConfirm(
                    t.confirm_checkin_title || "Confirm Check-in",
                    t.confirm_checkin_message || "Are you sure?",
                    onConfirm
                );
            } else {
                showToast(`${t.location_too_far || "Too far"} (${(distance * 1000).toFixed(0)}m)`, 'error');
            }
        } catch (error) {
            let errorMessage = 'Could not get location.';
            if (error.code === 1) errorMessage = t.location_denied || "Location denied";
            else if (error.code === 2) errorMessage = 'Location unavailable.';
            else if (error.code === 3) errorMessage = 'Location request timed out.';
            showToast(errorMessage, 'error');
        }
    }

    async function handleWithdrawRequest() {
        if (!dataCache.latestPermissionRequest) return;

        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        const onConfirm = async () => {
            const payload = {
                token: localStorage.getItem('token'),
                transactionId: dataCache.latestPermissionRequest.TransactionID
            };
            try {
                const res = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'withdrawPermissionRequest', payload }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                const result = await res.json();
                if (result.success) {
                    const lang = localStorage.getItem('language') || 'km';
                    const t = translations[lang] || {}; // (Define 't' if not already defined in this scope)
                    showTopNotification(t.notif_request_withdrawn || 'Request withdrawn successfully.');

                    dataCache.latestPermissionRequest = null;
                    handleRequestAgain();
                } else {
                    throw new Error(result.message || 'Failed to withdraw request.');
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        };

        showCustomConfirm(
            t.confirm_withdraw_title || "Confirm Withdraw",
            t.confirm_withdraw_message || "Are you sure you want to withdraw?",
            onConfirm
        );
    }

    // --- PASSWORD RESET FUNCTIONS ---
    function showResetPage() {
        showPage('reset');
        updateUIText();
        resetState = { studentId: null, otp: null };
        ui.requestResetForm.classList.remove('hidden');
        ui.verifyOtpForm.classList.add('hidden');
        ui.passwordResetForm.classList.add('hidden');
        ui.requestResetForm.reset();
        ui.verifyOtpForm.reset();
        ui.passwordResetForm.reset();
    }

    async function handleRequestReset(e) {
        e.preventDefault();
        const studentId = document.getElementById('resetStudentId').value.trim();
        if (!studentId) {
            return showToast('Please enter your Student ID.');
        }
        const submitBtn = ui.requestResetForm.querySelector('button[type="submit"]');
        toggleButtonSpinner(submitBtn, true);

        resetState.studentId = studentId;

        const payload = { studentId };
        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'requestPasswordReset', payload }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const result = await res.json();
            showToast(result.message);
            if (result.success) {
                ui.requestResetForm.classList.add('hidden');
                ui.verifyOtpForm.classList.remove('hidden');
            }
        } catch (error) {
            showToast('A network error occurred. Please try again.', 'error');
        } finally {
            toggleButtonSpinner(submitBtn, false);
        }
    }

    async function handleVerifyOtp(e) {
        e.preventDefault();
        const otp = document.getElementById('otpInput').value.trim();
        if (otp.length !== 6) {
            return showToast('Please enter the 6-digit OTP.');
        }
        const submitBtn = ui.verifyOtpForm.querySelector('button[type="submit"]');
        toggleButtonSpinner(submitBtn, true);

        resetState.otp = otp;

        const payload = { studentId: resetState.studentId, otp };
        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'verifyOTP', payload }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const result = await res.json();
            if (result.success) {
                showToast('OTP Verified!', 'success');
                ui.verifyOtpForm.classList.add('hidden');
                ui.passwordResetForm.classList.remove('hidden');
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('A network error occurred. Please try again.', 'error');
        } finally {
            toggleButtonSpinner(submitBtn, false);
        }
    }

    async function handlePasswordReset(e) {
        e.preventDefault();
        const newPassword = document.getElementById('resetNewPassword').value;
        const confirmPassword = document.getElementById('resetConfirmPassword').value;

        // 1. Strong Password Check
        const passwordError = validateStrongPassword(newPassword);
        if (passwordError) {
            return showToast(passwordError, 'error');
        }

        // 2. Match Check
        if (newPassword !== confirmPassword) {
            return showToast('Passwords do not match.', 'error');
        }

        // 3. Session Check
        if (!resetState.studentId || !resetState.otp) {
            return showToast('Invalid session. Please request a new OTP.', 'error');
        }

        const submitBtn = ui.passwordResetForm.querySelector('button[type="submit"]');
        toggleButtonSpinner(submitBtn, true);

        const payload = {
            studentId: resetState.studentId,
            otp: resetState.otp,
            newPassword
        };

        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'resetPasswordWithOTP', payload }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const result = await res.json();

            showToast(result.message, result.success ? 'success' : 'error');

            if (result.success) {
                setTimeout(() => showLoginPage(), 2000);
            }
        } catch (error) {
            showToast('A network error occurred. Please try again.', 'error');
        } finally {
            toggleButtonSpinner(submitBtn, false);
        }
    }

    function toggleLoginButtonState(state) {
        const [text, spinner] = [ui.loginBtn.querySelector('.login-text'), ui.loginBtn.querySelector('.login-spinner')];
        if (state === 'start') {
            text.classList.add('hidden');
            spinner.classList.remove('hidden');
            ui.loginBtn.disabled = true;
        } else {
            text.classList.remove('hidden');
            spinner.classList.add('hidden');
            ui.loginBtn.disabled = false;
        }
    }

    function toggleButtonSpinner(button, isLoading) {
        if (!button) return;
        const textElements = button.querySelectorAll('.button-text');
        const spinnerEl = button.querySelector('.login-spinner');

        if (isLoading) {
            if (textElements) {
                textElements.forEach(el => el.classList.add('hidden'));
            }
            if (spinnerEl) spinnerEl.classList.remove('hidden');
            button.disabled = true;
        } else {
            if (textElements) {
                textElements.forEach(el => el.classList.remove('hidden'));
            }
            if (spinnerEl) spinnerEl.classList.add('hidden');
            button.disabled = false;
        }
    }

    function toggleHeaderButtonSpinner(button, isLoading) {
        if (!button) return;
        const textEl = button.querySelector('.button-text');
        const spinnerEl = button.querySelector('.header-spinner');
        if (isLoading) {
            if (textEl) textEl.classList.add('hidden');
            if (spinnerEl) spinnerEl.classList.remove('hidden');
            button.disabled = true;
        } else {
            if (textEl) textEl.classList.remove('hidden');
            if (spinnerEl) spinnerEl.classList.add('hidden');
            button.disabled = false;
        }
    }

    function formatTimeForDisplay(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        let h = date.getHours();
        let m = date.getMinutes();

        // --- TRANSLATION LOGIC FOR AM/PM ---
        const lang = localStorage.getItem('language') || 'km';
        const tObj = translations[lang] || {};
        const ampm = h >= 12 ? (tObj.time_pm || 'PM') : (tObj.time_am || 'AM');
        // ------------------------------------

        const h12 = h % 12 || 12;
        const mStr = m < 10 ? '0' + m : m;

        return `${formatNumber(h12)}:${formatNumber(mStr)} ${ampm}`;
    }

    function showToast(message, customClass = '') {
        document.querySelector('.toast-notification')?.remove();
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        if (customClass) {
            toast.classList.add(customClass);
        }
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    function togglePasswordVisibility(icon) {
        const wrapper = icon.closest('.password-wrapper');
        if (wrapper) {
            const input = wrapper.querySelector('input');
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('bx-hide');
                    icon.classList.add('bx-show');
                } else {
                    input.type = 'password';
                    icon.classList.remove('bx-show');
                    icon.classList.add('bx-hide');
                }
            }
        }
    }

    async function renderSecurityPage() {
        const container = document.getElementById('login-history-list');
        container.innerHTML = `
        <div class="skeleton" style="height: 40px; width: 100%; border-radius: 8px;"></div>
        <div class="skeleton" style="height: 40px; width: 100%; border-radius: 8px;"></div>
        <div class="skeleton" style="height: 40px; width: 100%; border-radius: 8px;"></div>
    `;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SCRIPT_URL}?action=getLoginHistory&token=${token}`);
            const result = await response.json();

            if (!result.success) throw new Error(result.message);

            renderList(container, result.data, (item) => {
                const div = document.createElement('div');
                div.className = 'history-item';

                const isSuccess = item.Status === 'Success';
                const iconClass = isSuccess ? 'bx-check-circle' : 'bx-x-circle';
                const statusClass = isSuccess ? 'success' : 'failed';

                const itemDate = new Date(item.Timestamp);
                const timeAgo = formatTimeAgo(itemDate);

                div.innerHTML = `
                <div class="history-item-icon ${statusClass}">
                    <i class='bx ${iconClass}'></i>
                </div>
                <div class="history-item-info">
                    <p>${item.Status}</p>
                    <span>${itemDate.toLocaleString()} (${timeAgo})</span>
                </div>
            `;
                return div;
            }, '<div class="card"><p>No login history found.</p></div>');

        } catch (error) {
            container.innerHTML = `<div class="card"><p>Could not load login history.</p></div>`;
            console.error("Error fetching login history:", error);
        }
    }

    function renderDigitalIdCard() {
        if (!dataCache.profile) return;
        const profile = dataCache.profile;

        // Mapping Photo & ID
        document.getElementById('id-card-photo').src = profile.profileImgUrl || `https://placehold.co/128x128/eeeeee/333333?text=${profile.englishName?.[0] || '?'}`;
        document.getElementById('id-card-main-id').textContent = profile.studentId;

        // Mapping Names
        document.getElementById('id-card-khmer-name').textContent = profile.khmerName || 'N/A';
        document.getElementById('id-card-name').textContent = profile.englishName || 'N/A';

        // Mapping Academic Data from Sheet
        // Use the specific keys provided in your User Summary/Script mapping
        document.getElementById('id-card-class').textContent = profile.grade || 'N/A';
        document.getElementById('id-card-major').textContent = profile.section || 'N/A'; // Sheet 'section' usually maps to Major
        document.getElementById('id-card-generation').textContent = profile.generation || 'N/A';
        document.getElementById('id-card-year').textContent = profile.yearStudent || 'N/A';

        // QR Code Generation
        const qrCodeContainer = document.getElementById('id-card-qrcode');
        qrCodeContainer.innerHTML = '';
        new QRCode(qrCodeContainer, {
            text: profile.studentId,
            width: 50,
            height: 50,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        startLiveClock();
    }

    function startLiveClock() {
        if (clockInterval) clearInterval(clockInterval);

        const clockEl = document.getElementById('live-clock');
        if (clockEl) {
            clockInterval = setInterval(() => {
                const now = new Date();
                clockEl.textContent = now.toLocaleTimeString('en-GB');
            }, 1000);
        }
    }

    function setOledMode(isEnabled) {
        localStorage.setItem('oledMode', isEnabled);
        if (isEnabled) {
            document.documentElement.setAttribute('data-theme-oled', 'true');
        } else {
            document.documentElement.removeAttribute('data-theme-oled');
        }
        if (ui.oledModeToggle) {
            ui.oledModeToggle.checked = isEnabled;
        }
    }

    let activeVirtualScrollListener = null;

    function renderVirtualizedList(container, fullData, renderItemFn, itemHeight, overscan = 5, fallbackHTML = '<div class="card"><p>Nothing to show.</p></div>') {
        if (activeVirtualScrollListener) {
            ui.mainContent.removeEventListener('scroll', activeVirtualScrollListener);
            activeVirtualScrollListener = null;
        }
        container.innerHTML = '';

        if (!fullData || fullData.length === 0) {
            container.innerHTML = fallbackHTML;
            return;
        }

        const totalHeight = fullData.length * itemHeight;
        container.style.height = `${totalHeight}px`;
        container.style.position = 'relative';
        container.style.overflow = 'hidden';

        let lastRenderedStartIndex = -1;

        function updateVisibleItems() {
            const scrollTop = ui.mainContent.scrollTop;
            const clientHeight = ui.mainContent.clientHeight;

            const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
            const endIndex = Math.min(fullData.length, startIndex + Math.ceil(clientHeight / itemHeight) + (2 * overscan));

            if (startIndex === lastRenderedStartIndex) {
                return;
            }
            lastRenderedStartIndex = startIndex;

            const visibleItems = fullData.slice(startIndex, endIndex);
            const fragment = document.createDocumentFragment();

            visibleItems.forEach((item, i) => {
                const absoluteIndex = startIndex + i;
                const topPosition = absoluteIndex * itemHeight;
                const el = renderItemFn(item, absoluteIndex);

                el.style.position = 'absolute';
                el.style.top = '0';
                el.style.transform = `translateY(${topPosition}px)`;
                el.style.width = '100%';
                el.style.paddingTop = '0.5rem';
                el.style.paddingBottom = '0.5rem';

                fragment.appendChild(el);
            });

            container.innerHTML = '';
            container.appendChild(fragment);
        }

        activeVirtualScrollListener = updateVisibleItems;
        ui.mainContent.addEventListener('scroll', updateVisibleItems, { passive: true });
        updateVisibleItems();
    }

    async function showMyFeedbackPage() {
        showProfileSubPage(ui.myFeedbackView);
        const container = document.getElementById('my-feedback-list');
        container.innerHTML = `
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
    `;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SCRIPT_URL}?action=getFeedbackHistory&token=${token}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const statusClassMap = {
                'New': 'status-pending',
                'Viewed': 'status-approved',
                'In Progress': 'status-approved',
                'Resolved': 'status-approved',
                'Closed': 'status-denied'
            };

            renderList(container, result.data, (item) => {
                const div = document.createElement('div');
                div.className = 'card';
                const itemDate = new Date(item.Timestamp);
                const statusClass = statusClassMap[item.Status] || 'status-pending';

                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                        <div>
                            <p style="font-weight: 600; margin-bottom: 0.25rem;">${item.StatusType || 'Permission'}</p>
                            <small style="color: var(--secondary-text);">
                                ${new Date(item.RequestDate).toLocaleDateString('en-GB')} | ${getDisplayDuration(item.duration || item.DayStop)}
                            </small>
                        </div>
                        <span class="status-badge status-${(item.Status || '').toLowerCase()}">${getTranslatedStatus(item.Status)}</span>
                    </div>`;
                return div;
            }, '<div class="card"><p>You have not submitted any feedback yet.</p></div>');

        } catch (error) {
            container.innerHTML = `<div class="card"><p>Could not load feedback history.</p></div>`;
            console.error("Error fetching feedback history:", error);
        }
    }

    function startOnboardingTour() {
        const lang = localStorage.getItem('language') || 'km';
        const t = translations[lang] || {};

        const tourButtons = {
            back: t.tour_btn_back || 'Back',
            next: t.tour_btn_next || 'Next',
            start: t.tour_btn_start || 'Start Tour',
            finish: t.tour_btn_finish || 'Finish'
        };

        const tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shepherd-custom-theme',
                scrollTo: { behavior: 'smooth', block: 'center' },
                cancelIcon: {
                    enabled: true
                },
                buttons: [
                    {
                        action() {
                            return this.back();
                        },
                        classes: 'shepherd-button-secondary',
                        text: tourButtons.back,
                    },
                    {
                        action() {
                            return this.next();
                        },
                        text: tourButtons.next,
                    },
                ],
            },
        });

        tour.addStep({
            title: t.tour_welcome_title || "Welcome!",
            text: t.tour_welcome_text || "Welcome to the app!",
            buttons: [
                {
                    action() {
                        return this.next();
                    },
                    text: tourButtons.start,
                },
            ],
        });

        tour.addStep({
            title: t.tour_home_title || "Home",
            text: t.tour_home_text || "Home screen description",
            attachTo: {
                element: '.bottom-nav-link[href="#home"]',
                on: 'top',
            },
        });

        tour.addStep({
            title: t.tour_notifications_title || "Notifications",
            text: t.tour_notifications_text || "Check notifications here",
            attachTo: {
                element: '#notificationsBtn',
                on: 'bottom',
            },
        });

        tour.addStep({
            title: t.tour_attendance_title || "Attendance",
            text: t.tour_attendance_text || "Check attendance here",
            attachTo: {
                element: '.bottom-nav-link[href="#attendance"]',
                on: 'top',
            },
        });

        tour.addStep({
            title: t.tour_schedule_title || "Schedule",
            text: t.tour_schedule_text || "Check schedule here",
            attachTo: {
                element: '.bottom-nav-link[href="#schedule"]',
                on: 'top',
            },
        });

        tour.addStep({
            title: t.tour_result_title || "Results",
            text: t.tour_result_text || "Check results here",
            attachTo: {
                element: '.bottom-nav-link[href="#result"]',
                on: 'top',
            },
        });

        tour.addStep({
            title: t.tour_profile_title || "Profile",
            text: t.tour_profile_text || "Manage profile here",
            attachTo: {
                element: '.bottom-nav-link[href="#profile"]',
                on: 'top',
            },
            buttons: [
                {
                    action() {
                        return this.back();
                    },
                    classes: 'shepherd-button-secondary',
                    text: tourButtons.back,
                },
                {
                    action() {
                        return this.complete();
                    },
                    text: tourButtons.finish,
                },
            ],
        });

        tour.on('complete', () => {
            localStorage.setItem('onboardingComplete', 'true');
        });
        tour.on('cancel', () => {
            localStorage.setItem('onboardingComplete', 'true');
        });

        tour.start();
    }

    function showCustomConfirm(title, message, onConfirmCallback) {
        ui.modalTitle.textContent = title;
        ui.modalMessage.textContent = message;

        const newConfirmBtn = ui.modalConfirmBtn.cloneNode(true);
        ui.modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, ui.modalConfirmBtn);
        ui.modalConfirmBtn = newConfirmBtn;

        ui.modalConfirmBtn.addEventListener('click', () => {
            onConfirmCallback();
            hideCustomConfirm();
        }, { once: true });

        ui.customConfirmModal.classList.remove('hidden');
        setTimeout(() => ui.customConfirmModal.classList.add('show'), 10);
    }

    function hideCustomConfirm() {
        ui.customConfirmModal.classList.remove('show');

        setTimeout(() => {
            ui.customConfirmModal.classList.add('hidden');
        }, 200);
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            0.5 - Math.cos(dLat) / 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            (1 - Math.cos(dLon)) / 2;
        return R * 2 * Math.asin(Math.sqrt(a));
    }

    function renderLoadingSkeleton(container, count = 3) {
        if (!container) return;
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            if (container.id === 'scoresTableBody') {
                skeletonHTML += `
                <div class="skeleton-grade-item">
                    <div class="skeleton skeleton-grade-icon"></div>
                    <div class="skeleton-grade-info">
                        <div class="skeleton skeleton-text title"></div>
                        <div class="skeleton skeleton-text desc"></div>
                    </div>
                    <div class="skeleton skeleton-grade-score"></div>
                </div>`;
            } else if (container.id === 'attendanceListContainer') {
                skeletonHTML += `
                <div class="skeleton-attendance-card">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <div class="skeleton skeleton-text title" style="width:40%; margin:0;"></div>
                        <div class="skeleton skeleton-text title" style="width:15%; margin:0;"></div>
                    </div>
                    <div class="skeleton skeleton-text desc"></div>
                    <div style="display:flex; justify-content:space-between; margin-top:12px;">
                        <div class="skeleton skeleton-text" style="width:25%"></div>
                        <div class="skeleton skeleton-text" style="width:25%"></div>
                        <div class="skeleton skeleton-text" style="width:25%"></div>
                    </div>
                </div>`;
            } else if (container.id === 'schedule-timeline-container' || container.id === 'class-schedule-view') {
                skeletonHTML += `
                <div class="skeleton-timeline-block">
                    <div class="skeleton-timeline-dot"></div>
                    <div class="skeleton-timeline-card">
                        <div class="skeleton skeleton-time-pill"></div>
                        <div class="skeleton skeleton-text title" style="width: 50%; margin-top: 8px;"></div>
                        <div class="skeleton skeleton-text desc-short"></div>
                        <div class="skeleton skeleton-text desc-short" style="width: 40%;"></div>
                    </div>
                </div>`;
            } else if (container.id === 'news-container' || container.id === 'events-container') {
                skeletonHTML += `
                <div class="skeleton-news-item">
                    <div class="skeleton skeleton-news-date"></div>
                    <div class="skeleton-news-content">
                        <div class="skeleton skeleton-text title"></div>
                        <div class="skeleton skeleton-text desc"></div>
                        <div class="skeleton skeleton-text desc-short"></div>
                    </div>
                </div>`;
            } else if (container.id === 'today-classes-container') {
                skeletonHTML += `
                <div class="skeleton-class-card">
                    <div class="class-card-header">
                        <div class="skeleton class-letter-icon"></div>
                        <div class="class-info" style="width: 100%;">
                            <div class="skeleton skeleton-text title" style="margin-bottom: 8px;"></div>
                            <div class="skeleton skeleton-text desc-short"></div>
                        </div>
                    </div>
                    <div class="skeleton class-card-time" style="margin-top: 12px; border:none; width: 80%;"></div>
                </div>`;
            } else {
                skeletonHTML += '<div class="skeleton skeleton-card" style="height: 80px; margin-bottom: 1rem; border-radius: 12px;"></div>';
            }
        }
        container.innerHTML = skeletonHTML;
    }


    function formatTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) {
            return 'Just now';
        }

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
            return `${diffInMinutes}m ago`;
        }

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        }

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) {
            return `${diffInDays}d ago`;
        }

        return date.toLocaleDateString();
    }

    // --- PASTE AT THE VERY BOTTOM OF SCRIPT.JS ---

    function renderSheetView(data) {
        // UPDATED ID: Matches the container used in showResultDetail
        const container = document.getElementById('result-score-details');
        if (!container) return;

        let totalScore = 0;
        let subjectCount = 0;

        const rows = data.map((item, index) => {
            const score = parseFloat(item.score);
            if (!isNaN(score)) {
                totalScore += score;
                subjectCount++;
            }

            const isFailing = !isNaN(score) && score < 25;

            return `
        <tr>
            <td class="col-no">${index + 1}</td>
            <td class="col-sub">${item.subject}</td>
            <td class="col-score ${isFailing ? 'failing' : ''}">
                <span class="score-value">${item.score}</span>
            </td>
            <td class="col-grade">${calculateGrade(item.score)}</td>
        </tr>
        `;
        }).join('');

        const average = subjectCount > 0 ? (totalScore / subjectCount).toFixed(2) : "0";

        const html = `
    <div class="sheet-container">
        <table class="sheet-table">
            <thead>
                <tr>
                    <th class="col-no">ល.រ</th>
                    <th class="col-sub">ខែ/Month</th> 
                    <th class="col-score">ពិន្ទុ</th>
                    <th class="col-grade">និទ្ទេស</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                <tr style="background-color: #f8f9fa; font-weight: bold;">
                    <td colspan="2" style="text-align: right;">សរុប (Total):</td>
                    <td colspan="2" style="text-align: center;">${parseFloat(totalScore.toFixed(2))}</td>
                </tr>
                <tr style="background-color: #f8f9fa; font-weight: bold;">
                    <td colspan="2" style="text-align: right;">មធ្យមភាគ (Avg):</td>
                    <td colspan="2" style="text-align: center; color: var(--primary-color);">${average}</td>
                </tr>
            </tbody>
        </table>
    </div>`;

        container.innerHTML = html;
    }

    function calculateGrade(score) {
        if (score === null || score === undefined || score === '') return '-';
        const s = parseFloat(score);
        if (isNaN(s)) return score;
        if (s >= 90) return 'A';
        if (s >= 80) return 'B';
        if (s >= 70) return 'C';
        if (s >= 60) return 'D';
        if (s >= 50) return 'E';
        return 'F';
    }

    init();
});