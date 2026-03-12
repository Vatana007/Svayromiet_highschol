/**
 * Student Information System Backend - Full Merged Version
 * Includes: Student App Logic + Prime Admin Panel Features
 */

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
      scores: "", // Gen 1, Grade 10 Scores
      attendance: "" // Gen 1, Grade 10 Attendance
    },
    "11": {
      scores: "1RxDilY1ZZW6wv153eUcz8FWx2M6ywJLlKs4xKY3IgXw", // Gen 1, Grade 10 Scores
      attendance: "1LeC-lV3mQJpD4v_sdsAy_B_ggpSRQvGMtpjWY8T08x8"
    },
    "12": {
      scores: "PASTE_GEN_1_GRADE_12_SCORES_ID",
      attendance: "PASTE_GEN_1_GRADE_12_ATTENDANCE_ID"
    },
    // Fallback for Gen 1 if grade is unknown
    "default": {
      scores: "1RxDilY1ZZW6wv153eUcz8FWx2M6ywJLlKs4xKY3IgXw",
      attendance: "1LeC-lV3mQJpD4v_sdsAy_B_ggpSRQvGMtpjWY8T08x8"
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
      case 'adminGetAnnouncements':
        result = adminGetAnnouncements();
        break;
      case 'adminGetAllFeedback':
        result = adminGetAllFeedback();
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
  // Wait up to 10 seconds for other users to finish writing
  if (!LOCK.tryLock(10000)) return { success: false, message: "System busy, please try again." };

  try {
    const ss = SpreadsheetApp.openById(DB_PERMS_ID);
    const sheet = ss.getSheetByName("All of Permissions");
    const data = sheet.getDataRange().getValues();

    const targetId = String(payload.id).trim();
    let foundIndex = -1;

    // 1. FIND ROW by Transaction ID (Column H / Index 7)
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][7] || "").trim() === targetId) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex === -1) {
      return { success: false, message: "Transaction ID not found in Sheet." };
    }

    const newStatus = payload.status; // "Approved" or "Rejected"

    // 2. UPDATE MASTER SHEET (Column G is 7th column)
    sheet.getRange(foundIndex + 1, 7).setValue(newStatus);

    // 3. COPY TO SEPARATE SHEET (Approved / Rejected)
    let targetSheet = ss.getSheetByName(newStatus);

    // If the sheet doesn't exist yet, create it and add headers
    if (!targetSheet) {
      targetSheet = ss.insertSheet(newStatus);
      targetSheet.appendRow(data[0]); // Copy headers from master sheet
      targetSheet.getRange(1, 1, 1, data[0].length).setFontWeight("bold");
    }

    // Grab the data row, update its status, and append it to the new sheet
    let rowData = data[foundIndex];
    rowData[6] = newStatus; // Update status in the array (Index 6)
    targetSheet.appendRow(rowData);

    // 4. RETURN SUCCESS
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

  // Find row by Transaction ID (Column 8 / Index 7)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][7]) === String(transId)) {
      // Update Status (Column 7 / Index 6)
      sheet.getRange(i + 1, 7).setValue(status);

      // If Approved, copy to Approved sheet
      if (status === "Approved") {
        let approvedSheet = ss.getSheetByName("Approved");
        if (!approvedSheet) approvedSheet = ss.insertSheet("Approved");
        let rowData = data[i];
        rowData[6] = "Approved"; // Ensure status is updated in copy
        approvedSheet.appendRow(rowData);
      }

      // Notify Student
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

function handleLogin(id, pass) {
  const data = getSheetData(DB_USERS_ID, "Users");
  const user = data.find(u => String(u['studentId']) === String(id) && String(u['password']) === String(pass));

  if (user) {
    logLogin(id, "Success");
    // Generate secure token
    const sessionToken = createSession(id);
    return { success: true, token: sessionToken };
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

  let allScores = [];
  try {
    const ss = SpreadsheetApp.openById(dbConfig.scores);
    const sheets = ss.getSheets();
    const METADATA_COLS = ['studentId', 'grade', 'semester', 'total', 'average', 'rank', 'index', 'class', 'section'];

    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return;

      const headers = data[0];
      const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
      const idIdx = lowerHeaders.indexOf('studentid');
      const gradeIdx = lowerHeaders.indexOf('grade');
      
      // PRIORITIZE CLASS OVER SECTION
      const classIdx = lowerHeaders.indexOf('class');
      const sectionIdx = lowerHeaders.indexOf('section');

      if (idIdx === -1) return;

      const studentRows = data.slice(1).filter(r => String(r[idIdx]) === String(studentId));

      studentRows.forEach(row => {
        let rowGrade = (gradeIdx !== -1 && row[gradeIdx]) ? row[gradeIdx] : profile.grade;
        
        // Grab the precise class (e.g. 10A)
        let exactClass = '';
        if (classIdx !== -1 && row[classIdx]) exactClass = String(row[classIdx]);
        else if (sectionIdx !== -1 && row[sectionIdx]) exactClass = String(row[sectionIdx]);

        headers.forEach((header, index) => {
          const headerLower = String(header).toLowerCase().trim();
          if (!METADATA_COLS.some(meta => meta.toLowerCase() === headerLower) && header !== "") {
            const score = row[index];
            if (score !== "" && score != null) {
              allScores.push({
                category: sheetName,
                course: header,
                totalScore: score,
                grade: String(rowGrade),
                exactClass: exactClass, // Pass exact class to frontend
                gradeLabel: calculateGrade(score)
              });
            }
          }
        });
      });
    });
  } catch (e) {
    console.log("Error fetching scores: " + e.toString());
  }

  const scoresByCategory = allScores.reduce((acc, curr) => {
    const key = String(curr.category);
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {});

  const mappedAttendance = getAllAttendanceRecords(studentId, dbConfig);
  try {
    const ssPerms = SpreadsheetApp.openById(DB_PERMS_ID);
    const permSheet = ssPerms.getSheetByName("All of Permissions");

    if (permSheet) {
      const permData = permSheet.getDataRange().getValues();
      const headers = permData[0].map(h => String(h).toLowerCase().trim());

      const idIdx = headers.indexOf("studentid") !== -1 ? headers.indexOf("studentid") : 1;
      const statusIdx = headers.indexOf("status") !== -1 ? headers.indexOf("status") : 6;
      const subjectsIdx = headers.indexOf("subjects") !== -1 ? headers.indexOf("subjects") : 10;
      const dateIdx = headers.indexOf("requestdate") !== -1 ? headers.indexOf("requestdate") : 3;

      for (let i = 1; i < permData.length; i++) {
        const row = permData[i];
        if (String(row[idIdx]) === String(studentId) && String(row[statusIdx]).toLowerCase() === 'approved') {
          const subjectsStr = row[subjectsIdx];

          if (subjectsStr && subjectsStr !== "No classes" && subjectsStr !== "N/A") {
            const splitSubjects = String(subjectsStr).split(',');
            splitSubjects.forEach(subText => {
              const cleanSubject = subText.trim();
              if (cleanSubject) {
                mappedAttendance.push({
                  semester: "1",
                  grade: profile.grade,
                  exactClass: profile.class || "", // Default exact class
                  course: cleanSubject,
                  date: formatShortDate(row[dateIdx]),
                  status: "Permission"
                });
              }
            });
          }
        }
      }
    }
  } catch (e) {
    console.log("Error injecting permissions to attendance: " + e.toString());
  }

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
      
      const classIdx = headers.indexOf("class");
      const sectionIdx = headers.indexOf("section");
      const finalClassIdx = classIdx !== -1 ? classIdx : sectionIdx; // Prefer class over section

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