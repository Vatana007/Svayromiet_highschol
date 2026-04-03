/**
 * Student Information System Backend - Full Merged Version
 * Includes: Student App Logic + Prime Admin Panel Features
 */

function testDriveAccess() {
  const file = DriveApp.createFile('test.txt', 'hello', MimeType.PLAIN_TEXT);
  file.setTrashed(true);
  Logger.log('Drive works!');
}

// ==========================================
// --- 1. CONFIGURATION ---
// ==========================================

const ADMIN_EMAIL = "vuthvatana09@gmail.com";
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyU-gBFaLZmSXRVd8VhIsRo8-3dKd1L6PbnXdXqZxJtWrJM1tGI7J5hcXWBL3IlfDnG/exec";

// STATIC DATABASES
const DB_USERS_ID = "1-KZ1XMbSP6f-MXbLdFdf-dxeZj2IKPfB6jRg7cfkqdk";
const DB_PERMS_ID = "10a7Iq7P4Cksn116BsMuVthpdgl-GNPVpyummYa9GB-U";

// DYNAMIC DATABASES (Mapped by Generation -> Grade)
const DB_ACADEMIC_MAP = {
  // GENERATION 1
  "1": {
    "10": {
      scores: "",
      attendance: ""
    },
    "11D": {
      scores: "1XMKlhqAKBVhroAJqeS6Uy4r5y-rMuX3ZrnhNXyYAYnQ", // <--- ដាក់ ID ថ្មីរបស់អ្នកនៅត្រង់នេះ
      attendance: "1LeC-lV3mQJpD4v_sdsAy_B_ggpSRQvGMtpjWY8T08x8"
    },
    "12": {
      scores: "PASTE_GEN_1_GRADE_12_SCORES_ID",
      attendance: "PASTE_GEN_1_GRADE_12_ATTENDANCE_ID"
    }
  },
  // GENERATION 2
  "2": {
    "10": {
      scores: "PASTE_GEN_2_GRADE_10_SCORES_ID",
      attendance: "PASTE_GEN_2_GRADE_10_ATTENDANCE_ID"
    },
    "default": {
      scores: "PASTE_GEN_2_DEFAULT_SCORES_ID",
      attendance: "PASTE_GEN_2_DEFAULT_ATTENDANCE_ID"
    }
  },

  // GENERATION 3
  "3": {
    "default": {
      scores: "PASTE_GEN_3_DEFAULT_SCORES_ID",
      attendance: "PASTE_GEN_3_DEFAULT_ATTENDANCE_ID"
    }
  }
};

// បន្ថែម ឬជំនួស Function នេះទៅក្នុង appscript.js របស់អ្នក
function saveStudentScore(payload) {
  try {
    // ឧទាហរណ៍ការទាញយក ID របស់ Sheet: 
    // const targetDbId = DB_ACADEMIC_MAP[payload.generation][payload.grade].scores;

    // payload.termName អាចជា "October", "November" ឬ "Semester 1", "Semester 2"
    const sheetName = payload.termName || "Sheet1";
    const sheet = SpreadsheetApp.openById(targetDbId).getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, message: `រកមិនឃើញផ្ទាំងបញ្ចួលពិន្ទុសម្រាប់ "${sheetName}" ទេ! សូមបង្កើត Sheet នេះសិន។` };
    }

    // រៀបចំទិន្នន័យជាជួរ (Row) តាមលំដាប់ពី Column A ដល់ U
    const newRow = [
      payload.no || "",                 // A: ល.រ
      payload.studentId || "",          // B: អត្តលេខ
      payload.studentName || "",        // C: គោត្តនាម និង នាម
      payload.gender || "",             // D: ភេទ
      payload.math || 0,                // E: គណិត
      payload.physics || 0,             // F: រូប
      payload.chemistry || 0,           // G: គីមី
      payload.biology || 0,             // H: ជីវ
      payload.earth || 0,               // I: ផែនដី
      payload.history || 0,             // J: ប្រវត្តិ
      payload.geography || 0,           // K: ភូមិ
      payload.civics || 0,              // L: ពលរដ្ឋ
      payload.khmer || 0,               // M: ខ្មែរ
      payload.english || 0,             // N: អង់គ្លេស
      payload.pe || 0,                  // O: អ.កាយ
      payload.ict || 0,                 // P: កសិកម្ម/ICT
      payload.totalScore || 0,          // Q: ពិន្ទុសរុប
      payload.average || 0,             // R: មធ្យមភាគ
      payload.rank || "",               // S: ចំណាត់ថ្នាក់
      payload.grade || "",              // T: និទ្ទេស
      payload.note || ""                // U: ផ្សេងៗ
    ];

    // បញ្ចូលទិន្នន័យទៅកាន់ជួរបន្ទាប់ (Append Row)
    sheet.appendRow(newRow);

    return { success: true, message: `រក្សាទុកពិន្ទុចូល ${sheetName} បានជោគជ័យ!` };
  } catch (error) {
    return { success: false, message: "មានបញ្ហា: " + error.message };
  }
}

// ==========================================
// --- 2. ROUTING (doGet & doPost) ---
// ==========================================

function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  try {
    // Legacy HTML Action for Email Links
    if (action === 'adminAction') {
      return handleAdminActionHTML(params.id, params.status);
    }

    let result = { success: false, message: "Invalid Action" };

    switch (action) {
      // ==========================================
      // --- STUDENT APP ENDPOINTS ---
      // ==========================================
      case 'getInitialDashboardData':
        result = getInitialDashboardData(params.token);
        break;
      case 'getHeavyDashboardData':
        result = getHeavyDashboardData(params.token);
        break;
      case 'getLatestPermissionRequest':
        result = getLatestPermissionRequest(params.token);
        break;
      case 'getAllPermissionRequests':
        result = getAllPermissionRequests(params.token);
        break;
      case 'getCurrentSemester':
        result = { success: true, currentSemester: "1" };
        break;
      case 'getLoginHistory':
        result = getLoginHistory(params.token);
        break;
      case 'getFeedbackHistory':
        result = getFeedbackHistory(params.token);
        break;

      // ==========================================
      // --- ADMIN PANEL ENDPOINTS ---
      // ==========================================
      case 'getAdminDashboardStats':
        result = getAdminDashboardStats();
        break;
      case 'adminGetAllStudents':
        result = adminGetAllStudents();
        break;
      case 'adminGetAllSchedule': // For the new Grid Schedule
        result = adminGetAllSchedule();
        break;
      case 'adminGetAllExams': // For the new Exam Tab
        result = adminGetAllExams();
        break;
      case 'adminGetAllScores': // NEW SCORE ENDPOINT
        result = adminGetAllScores();
        break;
      case 'adminGetAnnouncements':
        result = adminGetAnnouncements();
        break;
      case 'adminGetAllFeedback':
        result = adminGetAllFeedback();
        break;
      case 'adminGetScoreFilters':
        result = adminGetScoreFilters();
        break;
      case 'apiAdminAction': // JSON Action for Dashboard buttons
        result = handleAdminActionJSON(params.id, params.status);
        break;
      case 'adminDeleteAnnouncement':
        result = adminDeleteAnnouncement(params.timestamp);
        break;

      // --- NEW: FETCH ALL PERMISSIONS FOR ADMIN ---
      case 'adminGetAllPermissionRequests':
        result = adminGetAllPermissionRequests();
        break;
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function adminGetScoreFilters() {
  try {
    const ss = SpreadsheetApp.openById(DB_USERS_ID);

    // 1. Get Generations and Grades from "Users" sheet
    const usersSheet = ss.getSheetByName("Users");
    let generations = new Set();
    let grades = new Set();

    if (usersSheet) {
      const usersData = usersSheet.getDataRange().getValues();
      const headers = usersData[0].map(h => String(h).toLowerCase().trim());

      // Look for headers, but fallback to Column I (index 8) and Column J (index 9) if headers change
      let gradeIdx = headers.indexOf('grade');
      if (gradeIdx === -1) gradeIdx = 8; // Column I

      let genIdx = headers.indexOf('generation');
      if (genIdx === -1) genIdx = headers.indexOf('gen');
      if (genIdx === -1) genIdx = 9; // Column J

      // Start from row 1 to skip headers
      for (let i = 1; i < usersData.length; i++) {
        let g = String(usersData[i][gradeIdx]).trim();
        let gen = String(usersData[i][genIdx]).trim();

        if (g) grades.add(g);
        if (gen) generations.add(gen);
      }
    }

    // 2. Get Terms/Months from "Score" sheet
    let terms = new Set();

    // Loop through all generation/grade entries that have a valid scores DB ID
    for (let gen in DB_ACADEMIC_MAP) {
      for (let targetGrade in DB_ACADEMIC_MAP[gen]) {
        let dbId = DB_ACADEMIC_MAP[gen][targetGrade].scores;
        if (!dbId || dbId.includes("PASTE_") || dbId === "") continue;

        try {
          const scoresSS = SpreadsheetApp.openById(dbId);
          const sheets = scoresSS.getSheets();

          sheets.forEach(sheet => {
            const name = sheet.getName().trim();
            // Skip sheets that look like system/template sheets
            if (name && name.toLowerCase() !== "sheet1" && name.toLowerCase() !== "template") {
              terms.add(name);
            }
          });
        } catch (e) {
          // Skip if a spreadsheet can't be opened
        }
      }
    }

    return {
      success: true,
      data: {
        // Convert Sets back to arrays and sort them cleanly
        generations: Array.from(generations).sort((a, b) => a - b),
        grades: Array.from(grades).sort((a, b) => a - b),
        terms: Array.from(terms)
      }
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function adminGetAllScores() {
  try {
    let allScores = [];

    // 1. Fetch User Map (To display English Names)
    let userMap = {};
    try {
      const ssUsers = SpreadsheetApp.openById(DB_USERS_ID);
      const userSheet = ssUsers.getSheetByName("Users");
      if (userSheet) {
        const userData = userSheet.getDataRange().getValues();
        const headers = userData[0].map(h => String(h).toLowerCase().trim());
        const idIdx = headers.indexOf('studentid');
        const nameIdx = headers.indexOf('englishname');
        if (idIdx !== -1 && nameIdx !== -1) {
          for (let i = 1; i < userData.length; i++) {
            userMap[String(userData[i][idIdx]).trim()] = userData[i][nameIdx];
          }
        }
      }
    } catch (e) { }

    // 2. Loop through Dynamic Databases
    for (let gen in DB_ACADEMIC_MAP) {
      for (let targetGrade in DB_ACADEMIC_MAP[gen]) {
        let dbId = DB_ACADEMIC_MAP[gen][targetGrade].scores;
        if (!dbId || dbId.includes("PASTE_") || dbId === "") continue;

        let ss = SpreadsheetApp.openById(dbId);
        let sheets = ss.getSheets();

        sheets.forEach(sheet => {
          let sheetName = sheet.getName();
          let data = sheet.getDataRange().getValues();
          if (data.length < 2) return;

          let headers = data[0].map(h => String(h).toLowerCase().trim());

          // Helper function to find column index by multiple possible names (English/Khmer)
          const getCol = (...names) => {
            for (let n of names) {
              let idx = headers.indexOf(n.toLowerCase());
              if (idx !== -1) return idx;
            }
            return -1;
          };

          // Map the columns
          let idIdx = getCol('studentid', 'អត្តលេខ', 'id');
          let nameIdx = getCol('studentname', 'ឈ្មោះសិស្ស', 'ឈ្មោះ', 'name');
          let genderIdx = getCol('gender', 'sex', 'ភេទ');
          let gradeIdx = getCol('grade', 'ថ្នាក់', 'កម្រិតថ្នាក់');
          let classIdx = getCol('class', 'section', 'បន្ទប់');

          // Subjects
          let mathIdx = getCol('math', 'គណិតវិទ្យា', 'គណិត');
          let phyIdx = getCol('physics', 'phy', 'រូបវិទ្យា', 'រូប');
          let chemIdx = getCol('chemistry', 'chem', 'គីមីវិទ្យា', 'គីមី');
          let bioIdx = getCol('biology', 'bio', 'ជីវវិទ្យា', 'ជីវ');
          let earthIdx = getCol('earth', 'ផែនដីវិទ្យា', 'ផែនដី');
          let hisIdx = getCol('history', 'his', 'ប្រវត្តិវិទ្យា', 'ប្រវត្តិ');
          let geoIdx = getCol('geography', 'geo', 'ភូមិវិទ្យា', 'ភូមិ');
          let civIdx = getCol('civics', 'civ', 'ពលរដ្ឋវិជ្ជា', 'ពលរដ្ឋ');
          let khmIdx = getCol('khmer', 'khm', 'ភាសាខ្មែរ', 'ខ្មែរ');
          let engIdx = getCol('english', 'eng', 'ភាសាអង់គ្លេស', 'អង់គ្លេស');
          let peIdx = getCol('pe', 'អប់រំកាយ', 'កីឡា');
          let ictIdx = getCol('ict', 'កសិកម្ម/ict', 'កុំព្យូទ័រ');

          // Results
          let totalIdx = getCol('totalscore', 'total', 'ពិន្ទុសរុប');
          let avgIdx = getCol('average', 'avg', 'មធ្យមភាគ');
          let rankIdx = getCol('rank', 'ចំណាត់ថ្នាក់');
          let gradeLetterIdx = getCol('និទ្ទេស', 'gradeletter'); // Kept separate from class grade

          if (idIdx === -1) return;

          for (let i = 1; i < data.length; i++) {
            let row = data[i];
            let sId = String(row[idIdx]).trim();
            if (!sId) continue;

            const getVal = (idx) => idx !== -1 ? row[idx] : '';

            allScores.push({
              studentId: sId,
              name: userMap[sId] || getVal(nameIdx) || 'Unknown',
              gender: getVal(genderIdx),
              category: sheetName,
              grade: gradeIdx !== -1 ? row[gradeIdx] : targetGrade,
              class: classIdx !== -1 ? row[classIdx] : 'N/A',

              math: getVal(mathIdx), phy: getVal(phyIdx), chem: getVal(chemIdx), bio: getVal(bioIdx),
              earth: getVal(earthIdx), his: getVal(hisIdx), geo: getVal(geoIdx), civ: getVal(civIdx),
              khm: getVal(khmIdx), eng: getVal(engIdx), pe: getVal(peIdx), ict: getVal(ictIdx),

              total: getVal(totalIdx),
              average: getVal(avgIdx),
              rank: getVal(rankIdx),
              gradeLetter: getVal(gradeLetterIdx)
            });
          }
        });
      }
    }
    return { success: true, data: allScores.reverse() }; // Newest first
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function adminGetAllPermissionRequests() {
  try {
    const ss = SpreadsheetApp.openById(DB_PERMS_ID);
    const sheet = ss.getSheetByName("All of Permissions");

    if (!sheet) return { success: false, message: "Sheet not found" };

    const data = sheet.getDataRange().getValues();
    const requests = [];

    // Loop through all rows (Skip header row 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // FIX: Check if row has StudentID (Col 1) OR Reason (Col 5) instead of requiring TransactionID
      // This ensures we catch manual entries or older data
      if (row[1] || row[5]) {

        // Safety: Use existing ID or generate a temporary one based on row index
        let safeId = row[7] ? String(row[7]) : "ROW-" + i;
        let safeStatus = row[6] ? row[6] : "Pending"; // Default to Pending if empty

        requests.push({
          timestamp: row[0],
          studentId: row[1],
          generation: row[2],
          requestDate: row[3],
          duration: row[4],
          reason: row[5],
          status: safeStatus,
          id: safeId,
          type: row[8],
          name: row[9],
          subjects: row[10] || "N/A" // <--- ADD THIS LINE
        });

      }
    }

    // Return data (Newest first)
    return { success: true, data: requests.reverse() };

  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

function doPost(e) {
  try {
    // 1. Parse the incoming JSON data
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const payload = postData.payload;
    let result = { success: false, message: "Invalid Action" }; // Default result

    // 2. Route to the correct function based on 'action'
    switch (action) {
      // --- STUDENT APP ACTIONS ---
      case 'login':
        result = handleLogin(payload.studentId, payload.password);
        break;
      case 'submitPermissionRequest':
        result = submitPermissionRequest(payload);
        break;
      case 'withdrawPermissionRequest':
        result = withdrawPermissionRequest(payload); // <-- Updated to point to our new function
        break;
      case 'logReturn':
        result = { success: true, message: "Return logged (Placeholder)" };
        break;
      case 'updateProfileField':
        result = updateProfileField(payload);
        break;
      case 'uploadImage':
        result = uploadImage(payload);
        break;
      case 'changePassword':
        result = changePassword(payload);
        break;
      case 'submitFeedback':
        result = submitFeedback(payload);
        break;
      case 'deletePermissionRequest':
        result = deletePermissionRequest(payload);
        break;

      // --- NEW FORGOT PASSWORD ACTIONS ---
      case 'requestPasswordReset':
        result = requestPasswordReset(payload);
        break;
      case 'verifyOTP':
        result = verifyOTP(payload);
        break;
      case 'resetPasswordWithOTP':
        result = resetPasswordWithOTP(payload);
        break;

      // --- ADMIN PANEL ACTIONS ---
      case 'adminLogin':
        result = handleAdminLogin(payload.username, payload.password);
        break;

      case 'adminHandleRequest':
        // --- FIX WAS HERE: Changed 'output' to 'result' ---
        result = adminHandleRequest(payload);
        break;

      case 'adminManageExam':
        result = adminManageExam(payload);
        break;

      case 'adminPostAnnouncement':
        result = adminPostAnnouncement(payload);
        break;

      case 'adminGetSpecificScores':
        result = adminGetSpecificScores(payload);
        break;

      case 'adminCreateStudentSheet':
        const resultSheet = adminCreateStudentSheet();
        return ContentService.createTextOutput(JSON.stringify(resultSheet))
          .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Return the result as JSON
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function adminGetSpecificScores(payload) {
  try {
    const gen = String(payload.generation);
    const targetGrade = String(payload.grade);
    const term = String(payload.term);

    // 1. Find the correct database ID based on Gen and Grade
    let dbId = "";
    if (DB_ACADEMIC_MAP[gen] && DB_ACADEMIC_MAP[gen][targetGrade]) {
      dbId = DB_ACADEMIC_MAP[gen][targetGrade].scores;
    } else if (DB_ACADEMIC_MAP[gen] && DB_ACADEMIC_MAP[gen]["default"]) {
      dbId = DB_ACADEMIC_MAP[gen]["default"].scores;
    }

    if (!dbId || dbId.includes("PASTE_") || dbId === "") {
      return { success: false, message: "រកមិនឃើញទិន្នន័យសម្រាប់ជំនាន់ និងថ្នាក់នេះទេ (Database missing)." };
    }

    // 2. Open the Sheet and target the specific month/term
    const ss = SpreadsheetApp.openById(dbId);
    const sheet = ss.getSheetByName(term);

    if (!sheet) {
      return { success: false, message: `មិនមានទិន្នន័យសម្រាប់ខែ/ឆមាស: "${term}" ទេ!` };
    }

    // 3. Fetch User Map (For English Names)
    let userMap = {};
    try {
      const ssUsers = SpreadsheetApp.openById(DB_USERS_ID);
      const userSheet = ssUsers.getSheetByName("Users");
      if (userSheet) {
        const userData = userSheet.getDataRange().getValues();
        const h = userData[0].map(x => String(x).toLowerCase().trim());
        const idIdx = h.indexOf('studentid');
        const nameIdx = h.indexOf('englishname');
        if (idIdx !== -1 && nameIdx !== -1) {
          for (let i = 1; i < userData.length; i++) userMap[String(userData[i][idIdx]).trim()] = userData[i][nameIdx];
        }
      }
    } catch (e) { }

    // 4. Read the target sheet data
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true, data: [] };

    let headers = data[0].map(h => String(h).toLowerCase().trim());

    const getCol = (...names) => {
      for (let n of names) { let idx = headers.indexOf(n.toLowerCase()); if (idx !== -1) return idx; }
      return -1;
    };

    let idIdx = getCol('studentid', 'អត្តលេខ', 'id');
    let nameIdx = getCol('studentname', 'ឈ្មោះសិស្ស', 'ឈ្មោះ', 'name');
    let genderIdx = getCol('gender', 'sex', 'ភេទ');
    let classIdx = getCol('class', 'section', 'បន្ទប់');

    let mathIdx = getCol('math', 'គណិតវិទ្យា', 'គណិត');
    let phyIdx = getCol('physics', 'phy', 'រូបវិទ្យា', 'រូប');
    let chemIdx = getCol('chemistry', 'chem', 'គីមីវិទ្យា', 'គីមី');
    let bioIdx = getCol('biology', 'bio', 'ជីវវិទ្យា', 'ជីវ');
    let earthIdx = getCol('earth', 'ផែនដីវិទ្យា', 'ផែនដី');
    let hisIdx = getCol('history', 'his', 'ប្រវត្តិវិទ្យា', 'ប្រវត្តិ');
    let geoIdx = getCol('geography', 'geo', 'ភូមិវិទ្យា', 'ភូមិ');
    let civIdx = getCol('civics', 'civ', 'ពលរដ្ឋវិជ្ជា', 'ពលរដ្ឋ');
    let khmIdx = getCol('khmer', 'khm', 'ភាសាខ្មែរ', 'ខ្មែរ');
    let engIdx = getCol('english', 'eng', 'ភាសាអង់គ្លេស', 'អង់គ្លេស');
    let peIdx = getCol('pe', 'អប់រំកាយ', 'កីឡា');
    let ictIdx = getCol('ict', 'កសិកម្ម/ict', 'កុំព្យូទ័រ');

    let totalIdx = getCol('totalscore', 'total', 'ពិន្ទុសរុប');
    let avgIdx = getCol('average', 'avg', 'មធ្យមភាគ');
    let rankIdx = getCol('rank', 'ចំណាត់ថ្នាក់');
    let gradeLetterIdx = getCol('និទ្ទេស', 'gradeletter');

    if (idIdx === -1) return { success: false, message: "ទម្រង់តារាងខុស (Invalid Sheet Format)." };

    let allScores = [];
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      let sId = String(row[idIdx]).trim();
      if (!sId) continue;

      const getVal = (idx) => idx !== -1 ? row[idx] : '';

      allScores.push({
        studentId: sId,
        name: userMap[sId] || getVal(nameIdx) || 'Unknown',
        gender: getVal(genderIdx),
        category: term,
        grade: targetGrade,
        class: classIdx !== -1 ? row[classIdx] : 'N/A',
        math: getVal(mathIdx), phy: getVal(phyIdx), chem: getVal(chemIdx), bio: getVal(bioIdx),
        earth: getVal(earthIdx), his: getVal(hisIdx), geo: getVal(geoIdx), civ: getVal(civIdx),
        khm: getVal(khmIdx), eng: getVal(engIdx), pe: getVal(peIdx), ict: getVal(ictIdx),
        total: getVal(totalIdx), average: getVal(avgIdx), rank: getVal(rankIdx), gradeLetter: getVal(gradeLetterIdx)
      });
    }

    return { success: true, data: allScores };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

function deletePermissionRequest(payload) {
  const LOCK = LockService.getScriptLock();
  if (!LOCK.tryLock(10000)) return { success: false, message: "System busy." };

  try {
    // 1. Verify user token to ensure they own the record
    const studentId = verifySession(payload.token);
    if (!studentId) return { success: false, message: "Invalid Session." };

    const ss = SpreadsheetApp.openById(DB_PERMS_ID);
    const sheet = ss.getSheetByName("All of Permissions");
    const data = sheet.getDataRange().getValues();
    const targetId = String(payload.transactionId).trim();

    // 2. Find and delete row
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][7] || "").trim() === targetId) {
        // Security check: Ensure the record actually belongs to the user trying to delete it
        if (String(data[i][1] || "").trim() === String(studentId).trim()) {
          sheet.deleteRow(i + 1); // +1 because array is 0-indexed but sheet rows are 1-indexed
          return { success: true, message: "Deleted successfully." };
        } else {
          return { success: false, message: "Unauthorized." };
        }
      }
    }

    return { success: false, message: "Record not found." };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    LOCK.releaseLock();
  }
}

// ==========================================
// --- FORGOT PASSWORD FUNCTIONS ---
// ==========================================

function requestPasswordReset(payload) {
  const studentId = String(payload.studentId).trim();
  const profile = getStudentProfile(studentId);

  // 1. Verify Student ID and Email
  if (!profile) return { success: false, message: "Student ID not found." };
  if (!profile.email) return { success: false, message: "No email registered. Please contact the admin." };

  // 2. Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 3. Store OTP securely in script properties (Expires in 10 minutes)
  const props = PropertiesService.getScriptProperties();
  const expiry = new Date().getTime() + (10 * 60 * 1000);
  props.setProperty('OTP_' + studentId, JSON.stringify({ otp: otp, expiry: expiry }));

  // 4. Send Email
  const subject = "Password Reset OTP - Svay Rieng High School";
  const body = `Hello ${profile.englishName},\n\nYour OTP for resetting your password is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.`;

  try {
    MailApp.sendEmail(profile.email, subject, body);
    return { success: true, message: "OTP sent to your registered email." };
  } catch (e) {
    return { success: false, message: "Failed to send email. " + e.toString() };
  }
}

function verifyOTP(payload) {
  const studentId = String(payload.studentId).trim();
  const providedOtp = String(payload.otp).trim();

  const props = PropertiesService.getScriptProperties();
  const storedData = props.getProperty('OTP_' + studentId);

  // 1. Check if an OTP was actually requested
  if (!storedData) return { success: false, message: "No active OTP found. Please request a new one." };

  const parsed = JSON.parse(storedData);

  // 2. Check Expiration
  if (new Date().getTime() > parsed.expiry) {
    props.deleteProperty('OTP_' + studentId);
    return { success: false, message: "OTP has expired. Please request a new one." };
  }

  // 3. Check Match
  if (parsed.otp !== providedOtp) {
    return { success: false, message: "Invalid OTP." };
  }

  return { success: true, message: "OTP verified successfully." };
}

function resetPasswordWithOTP(payload) {
  const studentId = String(payload.studentId).trim();
  const providedOtp = String(payload.otp).trim();
  const newPassword = String(payload.newPassword);

  const props = PropertiesService.getScriptProperties();
  const storedData = props.getProperty('OTP_' + studentId);

  // 1. Verify OTP one last time for security
  if (!storedData) return { success: false, message: "Session expired. Please start over." };
  const parsed = JSON.parse(storedData);
  if (new Date().getTime() > parsed.expiry || parsed.otp !== providedOtp) {
    return { success: false, message: "Invalid or expired OTP." };
  }

  // 2. Update password in "Users" sheet
  try {
    const ss = SpreadsheetApp.openById(DB_USERS_ID);
    const sheet = ss.getSheetByName("Users");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const passIdx = headers.indexOf('password');
    const idIdx = headers.indexOf('studentId');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === studentId) {
        // Change the password
        sheet.getRange(i + 1, passIdx + 1).setValue(newPassword);
        // Destroy the used OTP so it can't be reused
        props.deleteProperty('OTP_' + studentId);

        return { success: true, message: "Password updated successfully!" };
      }
    }
    return { success: false, message: "User not found in database." };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// Find the adminHandleRequest function and replace it with this:

function adminHandleRequest(payload) {
  const LOCK = LockService.getScriptLock();
  if (!LOCK.tryLock(10000)) return { success: false, message: "System busy, please try again." };

  try {
    const ss = SpreadsheetApp.openById(DB_PERMS_ID);
    const sheet = ss.getSheetByName("All of Permissions");
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).toLowerCase().trim());

    const targetId = String(payload.id).trim();
    let foundIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][7] || "").trim() === targetId) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex === -1) {
      return { success: false, message: "Transaction ID not found in Sheet." };
    }

    const newStatus = payload.status;
    sheet.getRange(foundIndex + 1, 7).setValue(newStatus);

    let targetSheet = ss.getSheetByName(newStatus);
    if (!targetSheet) {
      targetSheet = ss.insertSheet(newStatus);
      targetSheet.appendRow(data[0]);
      targetSheet.getRange(1, 1, 1, data[0].length).setFontWeight("bold");
    }

    let rowData = data[foundIndex];
    rowData[6] = newStatus;
    targetSheet.appendRow(rowData);

    // ==========================================
    // ចាប់យក "មូលហេតុ" ពី Column D (Index 3) 
    // ឬស្វែងរកតាមឈ្មោះ Header ដោយស្វ័យប្រវត្តិ
    // ==========================================
    if (newStatus === "Approved") {
      const idIdx = headers.indexOf('studentid') !== -1 ? headers.indexOf('studentid') : 1;
      const genIdx = headers.indexOf('generation') !== -1 ? headers.indexOf('generation') : 2;
      const dateIdx = headers.indexOf('requestdate') !== -1 ? headers.indexOf('requestdate') : (headers.indexOf('date') !== -1 ? headers.indexOf('date') : 3);

      // ចាប់យក Reason ពី Column D (លេខ 3) ជាគោល
      const reasonIdx = headers.indexOf('reason') !== -1 ? headers.indexOf('reason') : 3;

      const sId = rowData[idIdx];
      const sDate = rowData[dateIdx];
      const sReason = rowData[reasonIdx]; // ទាញយកមូលហេតុ
      const sGen = rowData[genIdx];

      syncPermissionToAttendance(sId, sDate, sReason, sGen);
    }

    return { success: true, message: "Updated successfully" };

  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  } finally {
    LOCK.releaseLock();
  }
}
// --- NEW SESSION SECURITY FUNCTIONS ---

function createSession(studentId) {
  const ss = SpreadsheetApp.openById(DB_USERS_ID);
  let sheet = ss.getSheetByName("Sessions");
  if (!sheet) sheet = ss.insertSheet("Sessions");

  // Generate a random, unguessable token
  const token = Utilities.getUuid();
  const now = new Date();
  const expiry = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // Expires in 24 hours

  // Save to database
  sheet.appendRow([token, studentId, now, expiry]);

  return token;
}

function verifySession(token) {
  const ss = SpreadsheetApp.openById(DB_USERS_ID);
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  const now = new Date();

  // Loop through sessions (skip header)
  for (let i = 1; i < data.length; i++) {
    const rowToken = data[i][0];
    const expiry = new Date(data[i][3]);

    // Check if Token matches AND is not expired
    if (String(rowToken) === String(token) && expiry > now) {
      return data[i][1]; // Return the real Student ID
    }
  }
  return null; // Invalid or expired token
}

// ==========================================
// --- 3. ADMIN PANEL FUNCTIONS (NEW) ---
// ==========================================

function handleAdminLogin(username, password) {
  // 1. Get real admins from the Sheet
  const admins = getSheetData(DB_USERS_ID, "Admins");

  // 2. Check if the user exists in the Sheet
  const user = admins.find(a =>
    String(a['username']).trim() === String(username).trim() &&
    String(a['password']).trim() === String(password).trim()
  );

  // 3. Login Success
  if (user) {
    const token = Utilities.base64Encode(user['username'] + ":" + new Date().getTime());
    return {
      success: true,
      token: token,
      role: user['role'] || 'Admin',
      name: user['name'] || username
    };
  }

  // 4. Login Failed
  return { success: false, message: "Invalid Credentials" };
}

function getAdminDashboardStats() {
  const users = getSheetData(DB_USERS_ID, "Users");
  const permissions = getSheetData(DB_PERMS_ID, "All of Permissions");

  const pending = permissions.filter(p => String(p.Status).toLowerCase() === "pending").length;

  // Active Today
  const today = new Date();
  const history = getSheetData(DB_USERS_ID, "LoginHistory");
  const active = history.filter(l => {
    const logDate = new Date(l.Timestamp);
    return logDate.getDate() === today.getDate() &&
      logDate.getMonth() === today.getMonth() &&
      logDate.getFullYear() === today.getFullYear();
  }).length;

  return {
    success: true,
    data: {
      totalStudents: users.length,
      pendingPermissions: pending,
      activeToday: active,
      recentPermissions: permissions.slice(-5).reverse()
    }
  };
}

function adminGetAllStudents() {
  const users = getSheetData(DB_USERS_ID, "Users");
  // Filter sensitive fields if necessary
  const students = users.map(u => ({
    studentId: u.studentId,
    englishName: u.englishName,
    khmerName: u.khmerName,
    class: u.class,
    sex: u.sex,
    phone: u.phone,
    profileImgUrl: u.profileImgUrl
  }));
  return { success: true, data: users };
}

function adminGetAllSchedule() {
  // Returns entire schedule for the Grid View
  const data = getSheetData(DB_USERS_ID, "Schedule");
  return { success: true, data: data };
}

function adminGetAllExams() {
  // Returns exam list
  const data = getSheetData(DB_USERS_ID, "Exams");
  return { success: true, data: data };
}

function adminGetAnnouncements() {
  const data = getSheetData(DB_USERS_ID, "Announcements");
  return { success: true, data: data.reverse() };
}

function adminGetAllFeedback() {
  const data = getSheetData(DB_USERS_ID, "Feedback");
  return { success: true, data: data.reverse() };
}

function adminPostAnnouncement(payload) {
  try {
    const ss = SpreadsheetApp.openById(DB_USERS_ID);
    let sheet = ss.getSheetByName("Announcements");

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet("Announcements");
      // Define Headers in exact order you asked
      sheet.appendRow(["Title", "Message", "DatePost", "Timestamp", "PostedBy"]);
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }

    // Prepare Data
    const title = payload.title || "No Title";       // Col A
    const message = payload.message || "";           // Col B
    const userDate = payload.date || new Date();     // Col C
    const timestamp = new Date();                    // Col D (System)
    const postedBy = "Admin";                        // Col E (System)

    // Append Row: [Title, Message, DatePost, Timestamp, PostedBy]
    sheet.appendRow([title, message, userDate, timestamp, postedBy]);

    return { success: true };

  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

function adminDeleteAnnouncement(timestamp) {
  const ss = SpreadsheetApp.openById(DB_USERS_ID);
  const sheet = ss.getSheetByName("Announcements");
  const data = sheet.getDataRange().getValues();

  // Find by timestamp (Column 1 / Index 0)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(timestamp)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: "Not found" };
}

function handleAdminActionJSON(transId, status) {
  const ss = SpreadsheetApp.openById(DB_PERMS_ID);
  const sheet = ss.getSheetByName("All of Permissions");
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][7]) === String(transId)) {
      sheet.getRange(i + 1, 7).setValue(status);

      if (status === "Approved") {
        let approvedSheet = ss.getSheetByName("Approved");
        if (!approvedSheet) approvedSheet = ss.insertSheet("Approved");
        let rowData = data[i];
        rowData[6] = "Approved"; 
        approvedSheet.appendRow(rowData);
        
        // ==========================================
        // ចាប់យក "មូលហេតុ" ពី Column D (Index 3) 
        // ==========================================
        const idIdx = headers.indexOf('studentid') !== -1 ? headers.indexOf('studentid') : 1;
        const genIdx = headers.indexOf('generation') !== -1 ? headers.indexOf('generation') : 2;
        const dateIdx = headers.indexOf('requestdate') !== -1 ? headers.indexOf('requestdate') : (headers.indexOf('date') !== -1 ? headers.indexOf('date') : 3);
        const reasonIdx = headers.indexOf('reason') !== -1 ? headers.indexOf('reason') : 3; 

        const sId = data[i][idIdx];
        const sDate = data[i][dateIdx];
        const sReason = data[i][reasonIdx]; // ទាញយកមូលហេតុ
        const sGen = data[i][genIdx];

        syncPermissionToAttendance(sId, sDate, sReason, sGen);
      }
      
      const studentId = data[i][1];
      sendStudentNotification(studentId, status, transId);

      return { success: true, message: `Request ${status}` };
    }
  }
  return { success: false, message: "Transaction not found" };
}

// ==========================================
// --- 4. STUDENT APP LOGIC (ORIGINAL) ---
// ==========================================

function debugProfile() {
  const data = getSheetData(DB_USERS_ID, "Users");
  const first = data[0]; // Get first student row
  Logger.log(JSON.stringify(first)); // Print all fields
}

function handleLogin(id, pass) {
  const data = getSheetData(DB_USERS_ID, "Users");

  // ជួសជុល៖ ការពារការដកឃ្លា (Space) និងអក្សរធំ/តូច (case-insensitive)
  const user = data.find(u =>
    String(u['studentId']).trim().toUpperCase() === String(id).trim().toUpperCase() &&
    String(u['password']).trim() === String(pass).trim()
  );

  if (user) {
    logLogin(id, "Success");
    const sessionToken = createSession(id);

    // ជួសជុល៖ ប្តូរពី 'profile' មក 'user' វិញទើបវាស្គាល់
    const normalizedProfile = Object.assign({}, user);
    if (!normalizedProfile.englishName) {
      normalizedProfile.englishName =
        user.EnglishName || user.english_name ||
        user.fullName || user.name || '';
    }

    // ជួសជុល៖ ប្តូរពី 'token: token' មក 'token: sessionToken' វិញ
    return { success: true, token: sessionToken, user: normalizedProfile };
  }

  logLogin(id, "Failed");
  return { success: false, message: "Invalid ID or Password" };
}

function getInitialDashboardData(token) {
  const studentId = verifySession(token);
  if (!studentId) return { success: false, message: "Session expired or invalid" };

  const profile = getStudentProfile(studentId);
  if (!profile) return { success: false, message: "User not found" };

  const allSchedule = getSheetData(DB_USERS_ID, "Schedule");
  const allExams = getSheetData(DB_USERS_ID, "Exams");

  // Strictly use "class" instead of section
  const studentClass = String(profile.class || "").trim().toLowerCase();

  const mySchedule = allSchedule.filter(s => {
    const genMatch = String(s.generation || s.Gen || "") === String(profile.generation);
    const gradeMatch = String(s.grade || s.Grade || "") === String(profile.grade);

    const schedClass = String(s.class || s.Class || "").trim().toLowerCase();
    const classMatch = schedClass === "" || studentClass === "" || schedClass === studentClass;

    return genMatch && gradeMatch && classMatch;
  }).map(s => ({
    day: s.DayOfWeek || s.Day || "",
    course: s.CourseName || s.Subject || s.Course || "",
    startTime: s.StartTime || s.Start || "",
    endTime: s.EndTime || s.End || "",
    teacher: s.Teacher || "",
    room: s.class || s.Class || profile.class || "N/A"
  }));

  const myExams = allExams.filter(e =>
    String(e.grade) === String(profile.grade) &&
    String(e.generation) === String(profile.generation)
  );

  return {
    success: true,
    data: {
      profile: profile,
      announcements: getSheetData(DB_USERS_ID, "Announcements"),
      events: getSheetData(DB_USERS_ID, "Events"),
      notifications: [],
      schedule: mySchedule,
      examSchedule: myExams
    }
  };
}

function getHeavyDashboardData(token) {
  const studentId = verifySession(token);
  if (!studentId) return { success: false, message: "Session expired or invalid" };

  const profile = getStudentProfile(studentId);
  if (!profile) return { success: false, message: "User profile not found" };

  const genKey = String(profile.generation).trim();
  const gradeKey = String(profile.grade).trim();
  let dbConfig = null;

  if (DB_ACADEMIC_MAP[genKey]) {
    if (DB_ACADEMIC_MAP[genKey][gradeKey]) {
      dbConfig = DB_ACADEMIC_MAP[genKey][gradeKey];
    } else {
      dbConfig = DB_ACADEMIC_MAP[genKey]["default"];
    }
  }
  if (!dbConfig) dbConfig = DB_ACADEMIC_MAP["1"]["default"];

  // ✅ Pre-populate ALL sheet tab names so dropdown always shows every month
  const scoresByCategory = {};

  try {
    const ss = SpreadsheetApp.openById(dbConfig.scores);
    const sheets = ss.getSheets();

    // Columns to SKIP when building the subject score list
    // Includes both English AND Khmer header names from your sheet
    const METADATA_COLS = [
      // English
      'studentid', 'student_id', 'id', 'no', 'grade', 'semester', 'total', 'average',
      'rank', 'index', 'class', 'section', 'name', 'gender', 'sex', 'note',
      // Khmer — matches your actual sheet column headers
      'ល.រ', 'អូរលេខ', 'អត្តលេខ', 'លេខសិស្ស', 'លេខ',
      'គោត្តនាម និង នាម', 'គោត្តនាម', 'នាម', 'ភេទ',
      'ចំណាត់ថ្នាក់', 'មធ្យមភាគ', 'ពិន្ទុសរុប', 'និទ្ទេស', 'ផ្សេងៗ', 'ចំណាំ'
    ];

    // Possible Khmer/English column names for Student ID (Column B in your sheet = អូរលេខ)
    const ID_COL_NAMES = [
      'studentid', 'student_id', 'id',
      'អូរលេខ', 'អត្តលេខ', 'លេខសិស្ស', 'លេខ'
    ];

    // Possible Khmer/English column names to SKIP (metadata)
    const GRADE_COL_NAMES = ['grade', 'ថ្នាក់', 'កម្រិតថ្នាក់'];
    const CLASS_COL_NAMES = ['class', 'section', 'បន្ទប់', 'ផ្នែក'];

    // STEP 1: Register ALL tab names first (empty array = no data yet for this student)
    sheets.forEach(sheet => {
      const name = sheet.getName().trim();
      if (name) scoresByCategory[name] = [];
    });

    // STEP 2: Fill in real scores where student data exists
    sheets.forEach(sheet => {
      const sheetName = sheet.getName().trim();
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return;

      const headers = data[0];
      const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());

      // Find Student ID column — supports both Khmer and English headers
      let idIdx = -1;
      for (let name of ID_COL_NAMES) {
        const i = lowerHeaders.indexOf(name.toLowerCase());
        if (i !== -1) { idIdx = i; break; }
      }
      // ✅ Fallback: if still not found, assume Column B (index 1) is the student ID
      if (idIdx === -1) idIdx = 1;

      // Find Grade column
      let gradeIdx = -1;
      for (let name of GRADE_COL_NAMES) {
        const i = lowerHeaders.indexOf(name.toLowerCase());
        if (i !== -1) { gradeIdx = i; break; }
      }

      // Find Class column
      let classIdx = -1;
      for (let name of CLASS_COL_NAMES) {
        const i = lowerHeaders.indexOf(name.toLowerCase());
        if (i !== -1) { classIdx = i; break; }
      }

      // Find Overall Grade (និទ្ទេស) column
      let gradeLetterIdx = -1;
      const GRADE_LETTER_NAMES = ['និទ្ទេស', 'gradeletter', 'grade letter'];
      for (let name of GRADE_LETTER_NAMES) {
        const i = lowerHeaders.indexOf(name.toLowerCase());
        if (i !== -1) { gradeLetterIdx = i; break; }
      }
      // បើរកតាមឈ្មោះ Header មិនឃើញ យក Column T (Index 19) ជាគោល
      if (gradeLetterIdx === -1 && headers.length > 19) {
          gradeLetterIdx = 19;
      }

      // Find rows that belong to this student (trim both sides to avoid space mismatch)
      const studentRows = data.slice(1).filter(r =>
        String(r[idIdx]).trim() === String(studentId).trim()
      );

      studentRows.forEach(row => {
        let rowGrade = (gradeIdx !== -1 && row[gradeIdx]) ? row[gradeIdx] : profile.grade;
        let exactClass = (classIdx !== -1 && row[classIdx]) ? String(row[classIdx]) : (profile.class || '');
        
        // ទាញយកនិទ្ទេសរួមពី Column T
        let overallGradeLetter = gradeLetterIdx !== -1 ? row[gradeLetterIdx] : '';

        headers.forEach((header, index) => {
          const headerLower = String(header).toLowerCase().trim();
          // Skip metadata columns and empty headers
          const isMeta = METADATA_COLS.some(m => m.toLowerCase() === headerLower);
          if (isMeta || header === "" || header == null) return;

          const score = row[index];
          if (score === "" || score == null) return;

          scoresByCategory[sheetName].push({
            category: sheetName,
            course: header,
            totalScore: score,
            grade: String(rowGrade),
            exactClass: exactClass,
            gradeLabel: calculateGrade(score),
            overallGrade: overallGradeLetter // បន្ថែមនិទ្ទេសយកទៅឱ្យ Frontend
          });
        });
      });
    });

  } catch (e) {
    console.log("Error fetching scores: " + e.toString());
  }

  const mappedAttendance = getAllAttendanceRecords(studentId, dbConfig);

  const attendanceBySem = mappedAttendance.reduce((acc, curr) => {
    if (!acc[curr.semester]) acc[curr.semester] = [];
    acc[curr.semester].push(curr);
    return acc;
  }, {});

  const rawSchedule = getSheetData(DB_USERS_ID, "Schedule");
  const studentClass = String(profile.class || "").trim().toLowerCase();

  const mySchedule = rawSchedule.filter(s => {
    const genMatch = String(s.generation || s.Gen || "") === String(profile.generation);
    const gradeMatch = String(s.grade || s.Grade || "") === String(profile.grade);
    const schedClass = String(s.class || s.Class || "").trim().toLowerCase();
    const classMatch = schedClass === "" || studentClass === "" || schedClass === studentClass;
    return genMatch && gradeMatch && classMatch;
  }).map(s => ({
    day: s.DayOfWeek || s.Day || "",
    course: s.CourseName || s.Subject || s.Course || "",
    startTime: s.StartTime || s.Start || "",
    endTime: s.EndTime || s.End || "",
    teacher: s.Teacher || "",
    room: s.class || s.Class || profile.class || "N/A"
  }));

  return {
    success: true,
    data: {
      scores: scoresByCategory,
      attendance: attendanceBySem,
      schedule: mySchedule,
      examSchedule: getSheetData(DB_USERS_ID, "Exams").filter(r => String(r.class) == String(profile.class))
    }
  };
}

function submitPermissionRequest(p) {
  const realStudentId = verifySession(p.token);
  if (!realStudentId) return { success: false, message: "Invalid Session" };

  const ss = SpreadsheetApp.openById(DB_PERMS_ID);
  const sheet = ss.getSheetByName("All of Permissions");

  const profile = getStudentProfile(realStudentId);
  const generation = profile ? profile.generation : "";
  const name = profile ? profile.englishName : "Unknown";

  const transId = "TRX-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  const timestamp = new Date();

  // Appends to Sheet -> Column G is automatically set to "Pending"
  sheet.appendRow([
    timestamp,          // Col A
    realStudentId,      // Col B
    generation,         // Col C
    p.requestDate,      // Col D
    p.duration,         // Col E
    p.reason,           // Col F
    "Pending",          // Col G: Status (Always Pending initially)
    transId,            // Col H: Transaction ID
    p.statusType,       // Col I
    name,               // Col J
    p.subjects || ""    // Col K: Subjects missed (NEW)
  ]);

  return {
    success: true,
    transactionId: transId,
    timestamp: timestamp,
    status: "Pending" // Returns Pending to the student app
  };
}


function submitFeedback(payload) {
  const ss = SpreadsheetApp.openById(DB_USERS_ID);
  let sheet = ss.getSheetByName("Feedback");
  if (!sheet) {
    sheet = ss.insertSheet("Feedback");
    sheet.appendRow(["Timestamp", "StudentID", "Category", "Message", "Status"]);
  }

  sheet.appendRow([new Date(), payload.studentId, payload.category, payload.message, "New"]);
  return { success: true };
}

// ==========================================
// --- 5. HELPER FUNCTIONS ---
// ==========================================

function getStudentProfile(id) {
  const data = getSheetData(DB_USERS_ID, "Users");
  return data.find(u => String(u['studentId']) === String(id));
}

function getSheetData(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    return getSheetDataFromObject(sheet);
  } catch (e) {
    return [];
  }
}

// Formula Parsing for Images (CRITICAL FOR STUDENT APP)
function getSheetDataFromObject(sheet) {
  try {
    const range = sheet.getDataRange();
    const values = range.getValues();
    const formulas = range.getFormulas();

    if (values.length < 2) return [];
    const headers = values[0];

    return values.slice(1).map((row, rIndex) => {
      let obj = {};
      const formulaRow = formulas[rIndex + 1];

      headers.forEach((h, i) => {
        let val = row[i];

        // ✅ Normalize englishName — support any column header spelling
        if (['englishname', 'english_name', 'fullname', 'name', 'ឈ្មោះអង់គ្លេស'].includes(
          String(h).toLowerCase().trim()
        )) {
          obj['englishName'] = val;
        }

        // Handle IMAGE formula
        if (h === 'profileImgUrl') {
          const cellFormula = formulaRow ? formulaRow[i] : '';
          if (cellFormula && cellFormula.toString().toLowerCase().startsWith('=image(')) {
            const match = cellFormula.match(/=image\s*\(\s*["']([^"']+)["']\s*\)/i);
            if (match && match[1]) val = match[1];
          }
        }
        obj[h] = val;
      });
      return obj;
    });
  } catch (e) {
    return [];
  }
}

function getAllAttendanceRecords(studentId, dbConfig) {
  const spreadsheetId = dbConfig ? dbConfig.attendance : DB_ACADEMIC_MAP["1"]["default"].attendance;
  let records = [];
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheets = ss.getSheets();

    sheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return;

      const headers = data[0].map(h => String(h).toLowerCase().trim());
      const idIdx = headers.indexOf("studentid");
      const statusIdx = headers.indexOf("status");
      const semIdx = 1;
      const gradeIdx = 2;
      const subjectIdx = headers.indexOf("subject");
      const dateIdx = headers.indexOf("date");
      const finalSubjectIdx = subjectIdx !== -1 ? subjectIdx : headers.indexOf("course");

      // --- ថែមការស្វែងរក Column "reason" ឬ "note" ត្រង់នេះ ---
      const reasonIdx = headers.indexOf("reason") !== -1 ? headers.indexOf("reason") : headers.indexOf("note");

      const classIdx = headers.indexOf("class");
      const sectionIdx = headers.indexOf("section");
      const finalClassIdx = classIdx !== -1 ? classIdx : sectionIdx;

      const finalIdIdx = idIdx !== -1 ? idIdx : 0;
      if (statusIdx === -1) return;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (String(row[finalIdIdx]) === String(studentId) || String(row[0]) === String(studentId)) {
          records.push({
            semester: String(row[semIdx] || "1"),
            grade: String(row[gradeIdx] || ""),
            exactClass: finalClassIdx !== -1 ? String(row[finalClassIdx]) : "",
            course: finalSubjectIdx !== -1 ? row[finalSubjectIdx] : "General",
            
            // --- បញ្ជូន Reason មកកាន់ App ---
            reason: reasonIdx !== -1 ? row[reasonIdx] : "", 
            
            date: formatShortDate(dateIdx !== -1 ? row[dateIdx] : new Date()),
            status: row[statusIdx]
          });
        }
      }
    });
  } catch (e) {
    console.log("Error in attendance: " + e.toString());
  }
  return records;
}

function logLogin(id, status) {
  try {
    const ss = SpreadsheetApp.openById(DB_USERS_ID);
    let sheet = ss.getSheetByName("LoginHistory");
    if (!sheet) sheet = ss.insertSheet("LoginHistory");
    sheet.appendRow([new Date(), id, status, "Web App"]);
  } catch (e) { }
}

function sendAdminEmail(data, transId) {
  const profile = getStudentProfile(data.token) || {};
  const name = profile['englishName'] || data.token;
  const approveLink = `${WEB_APP_URL}?action=adminAction&id=${transId}&status=Approved`;
  const denyLink = `${WEB_APP_URL}?action=adminAction&id=${transId}&status=Rejected`;

  const htmlBody = `
    <h3>New Permission Request</h3>
    <p><b>Student:</b> ${name} (${data.token})</p>
    <p><b>Type:</b> ${data.statusType}</p>
    <p><b>Reason:</b> ${data.reason}</p>
    <br>
    <a href="${approveLink}">Approve</a> | <a href="${denyLink}">Reject</a>
  `;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `Permission Request: ${name}`,
    htmlBody: htmlBody
  });
}

function sendStudentNotification(studentId, status, transId) {
  const profile = getStudentProfile(studentId);
  if (profile && profile['email']) {
    MailApp.sendEmail({
      to: profile['email'],
      subject: `Permission Request ${status}`,
      body: `Your permission request (ID: ${transId}) has been ${status}.`
    });
  }
}

// HTML Response for Email Links
function handleAdminActionHTML(transId, status) {
  const result = handleAdminActionJSON(transId, status);
  const color = status === "Approved" ? "green" : "red";
  return ContentService.createTextOutput(`<h2 style="color:${color}; font-family:sans-serif;">Request ${status} Successfully</h2>`).setMimeType(ContentService.MimeType.HTML);
}

function getAllPermissionRequests(token) {
  // 1. Verify token to get the real Student ID
  const studentId = verifySession(token);
  if (!studentId) return { success: false, message: "Invalid Session" };

  // 2. Fetch from sheet using the real Student ID
  const data = getSheetData(DB_PERMS_ID, "All of Permissions");
  const requests = data.filter(r => String(r['studentId']) === String(studentId));

  return { success: true, data: requests.reverse() };
}

function getLatestPermissionRequest(token) {
  const res = getAllPermissionRequests(token);
  if (res.success && res.data && res.data.length > 0) return { success: true, data: res.data[0] };
  return { success: false };
}

function getLoginHistory(id) {
  const ss = SpreadsheetApp.openById(DB_USERS_ID);
  const sheet = ss.getSheetByName("LoginHistory");
  if (!sheet) return { success: true, data: [] };
  const raw = sheet.getDataRange().getValues();
  const history = raw.filter(r => String(r[1]) === String(id)).map(r => ({ Timestamp: r[0], Status: r[2] })).reverse().slice(0, 20);
  return { success: true, data: history };
}

function getFeedbackHistory(id) {
  const data = getSheetData(DB_USERS_ID, "Feedback");
  const history = data.filter(r => String(r['studentId']) === String(id)).reverse();
  return { success: true, data: history };
}

function updateProfileField(p) {
  try {
    // 1. Verify the session token to get the actual Student ID
    const studentId = verifySession(p.token);
    if (!studentId) return { success: false, message: "Invalid Session. Please login again." };

    const ss = SpreadsheetApp.openById(DB_USERS_ID);
    const sheet = ss.getSheetByName("Users");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const fieldIdx = headers.indexOf(p.field);
    const idIdx = headers.indexOf('studentId');

    if (fieldIdx === -1) return { success: false, message: "Field not found" };

    for (let i = 1; i < data.length; i++) {
      // 2. Compare with the verified studentId, NOT the token
      if (String(data[i][idIdx]) === String(studentId)) {
        sheet.getRange(i + 1, fieldIdx + 1).setValue(p.value);
        return { success: true };
      }
    }
    return { success: false, message: "User not found" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function uploadImage(p) {
  try {
    const studentId = verifySession(p.token);
    if (!studentId) return { success: false, message: "Invalid Session." };

    // 1. Decode base64 and create a blob
    const blob = Utilities.newBlob(
      Utilities.base64Decode(p.fileData),
      p.mimeType,
      p.fileName
    );

    // 2. Save to Drive root (no folder — avoids permission issues)
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const newImageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;

    // 3. Save the new URL to the Users sheet
    const ss = SpreadsheetApp.openById(DB_USERS_ID);
    const sheet = ss.getSheetByName("Users");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('studentId');
    const imgIdx = headers.indexOf('profileImgUrl');

    if (imgIdx === -1) return { success: false, message: "profileImgUrl column not found in Users sheet." };

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() === String(studentId).trim()) {
        sheet.getRange(i + 1, imgIdx + 1).setValue(newImageUrl);
        return { success: true, newImageUrl: newImageUrl };
      }
    }

    return { success: false, message: "User not found in sheet." };

  } catch (e) {
    return { success: false, message: "Upload failed: " + e.toString() };
  }
}

function changePassword(p) {
  try {
    // 1. Verify the session token to get the actual Student ID
    const studentId = verifySession(p.token);
    if (!studentId) return { success: false, message: "Invalid Session. Please login again." };

    const ss = SpreadsheetApp.openById(DB_USERS_ID);
    const sheet = ss.getSheetByName("Users");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const passIdx = headers.indexOf('password');
    const idIdx = headers.indexOf('studentId');

    for (let i = 1; i < data.length; i++) {
      // 2. Compare with the verified studentId, NOT the token
      if (String(data[i][idIdx]) === String(studentId)) {
        if (String(data[i][passIdx]) === String(p.currentPassword)) {
          sheet.getRange(i + 1, passIdx + 1).setValue(p.newPassword);
          return { success: true };
        } else {
          return { success: false, message: "Incorrect current password" };
        }
      }
    }
    return { success: false, message: "User not found" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function calculateGrade(score) {
  if (isNaN(score)) return score;
  const s = parseFloat(score);
  if (s >= 90) return 'A';
  if (s >= 80) return 'B';
  if (s >= 70) return 'C';
  if (s >= 60) return 'D';
  if (s >= 50) return 'E';
  return 'F';
}

function formatShortDate(date) {
  if (!date) return "";
  if (typeof date === 'string') return date;
  try {
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "yyyy-MM-dd");
  } catch (e) { return date; }
}

function withdrawPermissionRequest(p) {
  const LOCK = LockService.getScriptLock();
  // Wait up to 10 seconds to prevent conflicts
  if (!LOCK.tryLock(10000)) return { success: false, message: "System busy, please try again." };

  try {
    // 1. Verify token to get the real Student ID
    const studentId = verifySession(p.token);
    if (!studentId) return { success: false, message: "Invalid Session" };

    const ss = SpreadsheetApp.openById(DB_PERMS_ID);
    const sheet = ss.getSheetByName("All of Permissions");
    const data = sheet.getDataRange().getValues();

    const targetId = String(p.transactionId).trim();
    let foundIndex = -1;

    // 2. Find row by Transaction ID
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][7] || "").trim() === targetId) {
        // Security check: Make sure this row actually belongs to the student
        if (String(data[i][1] || "").trim() === String(studentId).trim()) {
          foundIndex = i;
          break;
        }
      }
    }

    if (foundIndex === -1) {
      return { success: false, message: "Transaction not found or unauthorized." };
    }

    const newStatus = "Withdrawn";

    // 3. UPDATE MASTER SHEET
    sheet.getRange(foundIndex + 1, 7).setValue(newStatus);

    // 4. COPY TO "Withdrawn" SHEET
    let targetSheet = ss.getSheetByName(newStatus);

    // If the sheet doesn't exist yet, create it and add headers
    if (!targetSheet) {
      targetSheet = ss.insertSheet(newStatus);
      targetSheet.appendRow(data[0]); // Copy headers
      targetSheet.getRange(1, 1, 1, data[0].length).setFontWeight("bold");
    }

    // Grab the data row, update its status, and append it
    let rowData = data[foundIndex];
    rowData[6] = newStatus; // Update status in array
    targetSheet.appendRow(rowData);

    return { success: true, message: "Request withdrawn successfully" };

  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  } finally {
    LOCK.releaseLock();
  }
}

function adminManageExam(payload) {
  const LOCK = LockService.getScriptLock();
  if (!LOCK.tryLock(10000)) return { success: false, message: "System busy, please try again." };

  try {
    const ss = SpreadsheetApp.openById(DB_USERS_ID);
    let sheet = ss.getSheetByName("Exams");

    if (!sheet) {
      sheet = ss.insertSheet("Exams");
      // Header order matches A, B, C, D, E, F, G
      sheet.appendRow(["Date", "Subject", "StartTime", "EndTime", "Grade", "Generation", "Type"]);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).toLowerCase().trim());

    // Map columns to match exact Google Sheet layout
    const dateIdx = headers.indexOf('date') !== -1 ? headers.indexOf('date') : 0;           // Col A
    const subjIdx = headers.indexOf('subject') !== -1 ? headers.indexOf('subject') : 1;     // Col B
    const startIdx = headers.indexOf('starttime') !== -1 ? headers.indexOf('starttime') : (headers.indexOf('start') !== -1 ? headers.indexOf('start') : 2); // Col C
    const endIdx = headers.indexOf('endtime') !== -1 ? headers.indexOf('endtime') : (headers.indexOf('end') !== -1 ? headers.indexOf('end') : 3);       // Col D
    const gradeIdx = headers.indexOf('grade') !== -1 ? headers.indexOf('grade') : (headers.indexOf('class') !== -1 ? headers.indexOf('class') : 4);     // Col E
    const genIdx = headers.indexOf('generation') !== -1 ? headers.indexOf('generation') : (headers.indexOf('gen') !== -1 ? headers.indexOf('gen') : 5); // Col F

    // Force "Type" to target Column G (Index 6)
    const typeIdx = headers.indexOf('type') !== -1 ? headers.indexOf('type') : (headers.indexOf('examtype') !== -1 ? headers.indexOf('examtype') : 6);  // Col G

    // --- ADD EXAM ---
    if (payload.manageType === 'add') {
      const newRow = new Array(headers.length > 7 ? headers.length : 7).fill('');
      if (dateIdx !== -1) newRow[dateIdx] = payload.date;
      if (subjIdx !== -1) newRow[subjIdx] = payload.subject;
      if (startIdx !== -1) newRow[startIdx] = payload.startTime;
      if (endIdx !== -1) newRow[endIdx] = payload.endTime;
      if (gradeIdx !== -1) newRow[gradeIdx] = payload.grade;
      if (genIdx !== -1) newRow[genIdx] = payload.generation; // Col F
      if (typeIdx !== -1) newRow[typeIdx] = payload.examType; // Col G

      sheet.appendRow(newRow);
      return { success: true, message: "Exam successfully added!" };
    }

    // --- FIND EXISTING ROW ---
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const sMatch = String(r[subjIdx]).trim() === String(payload.origSubject).trim();
      const gMatch = String(r[gradeIdx]).trim() === String(payload.origGrade).trim();

      const sheetDate = new Date(r[dateIdx]).toDateString();
      const payloadDate = new Date(payload.origDate).toDateString();
      const dMatch = sheetDate === payloadDate || String(r[dateIdx]) === String(payload.origDate);

      if (sMatch && gMatch && dMatch) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) return { success: false, message: "Could not locate the exact exam in the database." };

    // --- DELETE EXAM ---
    if (payload.manageType === 'delete') {
      sheet.deleteRow(rowIndex);
      return { success: true, message: "Exam successfully deleted!" };
    }

    // --- UPDATE EXAM ---
    if (payload.manageType === 'update') {
      if (dateIdx !== -1) sheet.getRange(rowIndex, dateIdx + 1).setValue(payload.date);
      if (subjIdx !== -1) sheet.getRange(rowIndex, subjIdx + 1).setValue(payload.subject);
      if (startIdx !== -1) sheet.getRange(rowIndex, startIdx + 1).setValue(payload.startTime);
      if (endIdx !== -1) sheet.getRange(rowIndex, endIdx + 1).setValue(payload.endTime);
      if (gradeIdx !== -1) sheet.getRange(rowIndex, gradeIdx + 1).setValue(payload.grade);
      if (genIdx !== -1) sheet.getRange(rowIndex, genIdx + 1).setValue(payload.generation); // Col F
      if (typeIdx !== -1) sheet.getRange(rowIndex, typeIdx + 1).setValue(payload.examType); // Col G
      return { success: true, message: "Exam successfully updated!" };
    }

    return { success: false, message: "Invalid action." };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  } finally {
    LOCK.releaseLock();
  }
}
// ==========================================
// --- NEW: SYNC PERMISSION TO ATTENDANCE ---
// ==========================================
function syncPermissionToAttendance(studentId, requestDate, reasonStr, generation) {
  try {
    const profile = getStudentProfile(studentId);
    if (!profile) return;

    const genKey = String(generation || profile.generation).trim();
    const gradeKey = String(profile.grade).trim();

    let dbId = "";
    if (DB_ACADEMIC_MAP[genKey]) {
      if (DB_ACADEMIC_MAP[genKey][gradeKey]) dbId = DB_ACADEMIC_MAP[genKey][gradeKey].attendance;
      else if (DB_ACADEMIC_MAP[genKey]["default"]) dbId = DB_ACADEMIC_MAP[genKey]["default"].attendance;
    }

    if (!dbId || dbId.includes("PASTE_")) return;

    const ss = SpreadsheetApp.openById(dbId);
    let sheet = ss.getSheetByName("All Attendance") || ss.getSheetByName("Sheet1") || ss.getSheets()[0];

    // បញ្ចូលទិន្នន័យ
    if (reasonStr && reasonStr !== "") {
      const headers = sheet.getDataRange().getValues()[0].map(h => String(h).toLowerCase().trim());
      let newRow = new Array(headers.length > 0 ? headers.length : 7).fill("");

      const idIdx = headers.indexOf("studentid");
      const nameIdx = headers.indexOf("name") !== -1 ? headers.indexOf("name") : headers.indexOf("studentname");
      const dateIdx = headers.indexOf("date");
      const subjIdx = headers.indexOf("subject") !== -1 ? headers.indexOf("subject") : headers.indexOf("course");
      const reasonIdx = headers.indexOf("reason") !== -1 ? headers.indexOf("reason") : headers.indexOf("note");
      const statusIdx = headers.indexOf("status");
      const gradeColIdx = headers.indexOf("grade");
      const classColIdx = headers.indexOf("class") !== -1 ? headers.indexOf("class") : headers.indexOf("section");
      const semIdx = headers.indexOf("semester");

      if (headers.length > 0) {
        if (idIdx !== -1) newRow[idIdx] = studentId;
        if (nameIdx !== -1) newRow[nameIdx] = profile.englishName || "";
        if (dateIdx !== -1) newRow[dateIdx] = requestDate;
        
        // បញ្ចូល "មូលហេតុ" ទៅក្នុង Column Reason ឬ Note. បើអត់មានទេ ដាក់ក្នុង Column Subject ជំនួស
        if (reasonIdx !== -1) {
            newRow[reasonIdx] = reasonStr;
            if (subjIdx !== -1) newRow[subjIdx] = "N/A";
        } else if (subjIdx !== -1) {
            newRow[subjIdx] = reasonStr; 
        }

        if (statusIdx !== -1) newRow[statusIdx] = "Permission"; 
        if (gradeColIdx !== -1) newRow[gradeColIdx] = profile.grade;
        if (classColIdx !== -1) newRow[classColIdx] = profile.class || "";
        if (semIdx !== -1) newRow[semIdx] = "1";
      } else {
        newRow = [studentId, "1", profile.grade, profile.class, reasonStr, requestDate, "Permission"];
      }

      sheet.appendRow(newRow); 
    }
  } catch (e) {
    console.log("Error syncing to attendance: " + e.toString());
  }
}