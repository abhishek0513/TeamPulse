// Google Internal Staffing & Bandwidth Planner - Core Application Logic

// Application State
const AppState = {
  team: [],
  dates: [],
  searchQuery: "",
  projectFilter: "ALL",
  settings: {
    managerName: "Abhinav Rawat (Engineering Lead)",
    managerEmail: "rawatabhinav@google.com",
    threshold: 40 // percent
  },
  alertLog: [],
  activeInspect: null // { memberId, dateKey }
};

// Initialize App
function initApp() {
  // Load dates (14-day sprint view starting from 2026-10-24)
  AppState.dates = generateDateRange("2026-10-24", 14);

  // Load saved state or generate fresh
  const savedTeam = localStorage.getItem("google_staffing_team_data");
  const savedSettings = localStorage.getItem("google_staffing_settings");
  const savedAlerts = localStorage.getItem("google_staffing_alert_log");

  if (savedSettings) {
    try { AppState.settings = JSON.parse(savedSettings); } catch (e) {}
  }

  // Ensure default manager is Abhinav Rawat
  if (!AppState.settings.managerEmail || AppState.settings.managerEmail.includes("sarah") || AppState.settings.managerEmail.includes("company")) {
    AppState.settings.managerName = "Abhinav Rawat (Engineering Lead)";
    AppState.settings.managerEmail = "rawatabhinav@google.com";
    localStorage.setItem("google_staffing_settings", JSON.stringify(AppState.settings));
  }

  if (savedTeam) {
    try {
      AppState.team = JSON.parse(savedTeam);
    } catch (e) {
      AppState.team = generateInitialTeam(AppState.dates);
    }
  } else {
    AppState.team = generateInitialTeam(AppState.dates);
    saveTeamData();
  }

  // Ensure Member #1 is Abhishek Mishra
  if (AppState.team.length > 0 && (AppState.team[0].name !== "Abhishek Mishra" || AppState.team[0].email !== "abhishmishra@google.com")) {
    AppState.team[0].name = "Abhishek Mishra";
    AppState.team[0].email = "abhishmishra@google.com";
    AppState.team[0].project = "AI Recommendation Engine";
    saveTeamData();
  }

  if (savedAlerts) {
    try { AppState.alertLog = JSON.parse(savedAlerts); } catch (e) {}
  }

  // Populate filters and forms
  populateProjectFilter();
  populateLeaveModalOptions();

  // Initial Bandwidth Scan & Alert generation
  scanAndTriggerBandwidthAlerts(false);

  // Render Dashboard
  renderDashboard();
  renderAlertCenterBadge();
  setupEventListeners();

  // Set lead email display in alerts drawer
  const leadEl = document.getElementById("alert-lead-email");
  if (leadEl) leadEl.textContent = AppState.settings.managerEmail;
}

// LocalStorage helpers
function saveTeamData() {
  localStorage.setItem("google_staffing_team_data", JSON.stringify(AppState.team));
}

function saveAlertLog() {
  localStorage.setItem("google_staffing_alert_log", JSON.stringify(AppState.alertLog));
}

// Calculate Bandwidth Metrics for a specific date
function calculateDateBandwidth(dateKey, membersList = null) {
  const members = membersList || AppState.team;
  let workingCount = 0;
  let halfDayCount = 0;
  let leaveCount = 0;
  let naCount = 0;

  members.forEach(member => {
    const status = member.schedule[dateKey] || "Working";
    if (status === "Working") workingCount++;
    else if (status === "Half day") halfDayCount++;
    else if (status === "Planned Leave") leaveCount++;
    else if (status === "Not Applicable") naCount++;
  });

  const effectiveWorking = workingCount + (halfDayCount * 0.5);
  const totalRelevant = workingCount + halfDayCount + leaveCount;
  
  // Bandwidth percentage (if all NA e.g. weekend, capacity is considered 100%)
  const percentage = totalRelevant > 0 
    ? Math.round((effectiveWorking / totalRelevant) * 100) 
    : 100;

  return {
    dateKey,
    workingCount,
    halfDayCount,
    leaveCount,
    naCount,
    effectiveWorking,
    totalRelevant,
    percentage,
    isLowBandwidth: totalRelevant > 0 && percentage < AppState.settings.threshold
  };
}

// Automatic Bandwidth Scan & Lead/Manager Trigger Dispatcher
function scanAndTriggerBandwidthAlerts(showNotification = true) {
  let newTriggers = 0;

  AppState.dates.forEach(dt => {
    const metrics = calculateDateBandwidth(dt.key);
    
    // Check if below threshold (< 40%)
    if (metrics.isLowBandwidth) {
      const existingAlert = AppState.alertLog.find(a => a.dateKey === dt.key);
      
      const absentMembers = AppState.team
        .filter(m => (m.schedule[dt.key] === "Planned Leave" || m.schedule[dt.key] === "Half day"))
        .map(m => ({
          name: m.name,
          project: m.project,
          status: m.schedule[dt.key],
          reason: m.leaveReasons[dt.key] || m.defaultReason || "Not specified",
          backup: m.dateBackups[dt.key] || m.defaultBackup || "None assigned"
        }));

      if (!existingAlert) {
        const newAlert = {
          id: `ALT-${Date.now()}-${dt.key}`,
          dateKey: dt.key,
          fullDate: dt.fullDate,
          dayName: dt.dayName,
          percentage: metrics.percentage,
          effectiveWorking: metrics.effectiveWorking,
          totalRelevant: metrics.totalRelevant,
          absentCount: metrics.leaveCount + metrics.halfDayCount,
          absentMembers: absentMembers,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
          status: "TRIGGERED_TO_MANAGER",
          managerEmail: AppState.settings.managerEmail
        };

        AppState.alertLog.unshift(newAlert);
        newTriggers++;
      } else {
        existingAlert.percentage = metrics.percentage;
        existingAlert.effectiveWorking = metrics.effectiveWorking;
        existingAlert.totalRelevant = metrics.totalRelevant;
        existingAlert.absentCount = metrics.leaveCount + metrics.halfDayCount;
        existingAlert.absentMembers = absentMembers;
      }
    }
  });

  saveAlertLog();

  if (newTriggers > 0 && showNotification) {
    showToastNotification(`Automatic Trigger: Low Bandwidth (<${AppState.settings.threshold}%) detected. Escalated to ${AppState.settings.managerEmail}`);
  }

  renderAlertCenterBadge();
}

// Populate Project Filter Options
function populateProjectFilter() {
  const filterSelect = document.getElementById("project-filter");
  if (!filterSelect) return;

  const currentVal = filterSelect.value;
  filterSelect.innerHTML = `<option value="ALL">All Squads (100 Members)</option>`;
  
  PROJECTS.forEach(proj => {
    const count = AppState.team.filter(m => m.project === proj).length;
    filterSelect.innerHTML += `<option value="${proj}">${proj} (${count})</option>`;
  });

  if (currentVal) filterSelect.value = currentVal;
}

// Populate Leave Modal Dropdowns
function populateLeaveModalOptions() {
  const memberSelect = document.getElementById("form-member-select");
  const projectSelect = document.getElementById("form-project-select");
  const dateSelect = document.getElementById("form-date-select");
  const backupSelect = document.getElementById("form-backup-select");

  if (!memberSelect || !projectSelect || !dateSelect || !backupSelect) return;

  memberSelect.innerHTML = `
    <option value="__NEW__">+ Register New Member Name</option>
    <optgroup label="Select Existing Staff (${AppState.team.length})">
      ${AppState.team.map(m => `<option value="${m.id}">${m.name} (${m.project})</option>`).join('')}
    </optgroup>
  `;

  projectSelect.innerHTML = PROJECTS.map(p => `<option value="${p}">${p}</option>`).join('');
  dateSelect.innerHTML = AppState.dates.map(d => `<option value="${d.key}">${d.dayName}, ${d.fullDate}</option>`).join('');
  backupSelect.innerHTML = `
    <option value="">Select a backup colleague...</option>
    ${AppState.team.map(m => `<option value="${m.name}">${m.name} [${m.project}]</option>`).join('')}
  `;
}

function handleMemberSelectChange(selectEl) {
  const newNameInput = document.getElementById("form-new-name");
  const projectSelect = document.getElementById("form-project-select");
  const backupSelect = document.getElementById("form-backup-select");

  if (selectEl.value === "__NEW__") {
    newNameInput.classList.remove("hidden");
    newNameInput.required = true;
    newNameInput.value = "";
  } else {
    newNameInput.classList.add("hidden");
    newNameInput.required = false;
    const member = AppState.team.find(m => m.id === selectEl.value);
    if (member) {
      projectSelect.value = member.project;
      if (member.defaultBackup) backupSelect.value = member.defaultBackup;
    }
  }
}

// Render Dashboard (Metrics Bar & Table)
function renderDashboard() {
  renderMetricBar();
  renderTrackerTable();
}

// Render Compact Metric Bar (Google style)
function renderMetricBar() {
  const totalCountEl = document.getElementById("stat-total-count");
  const todayPctEl = document.getElementById("stat-today-pct");
  const criticalPillEl = document.getElementById("stat-critical-pill");

  if (!totalCountEl || !todayPctEl || !criticalPillEl) return;

  totalCountEl.textContent = `${AppState.team.length} staff`;

  const todayKey = AppState.dates[0].key;
  const todayMetrics = calculateDateBandwidth(todayKey);
  todayPctEl.textContent = `${todayMetrics.percentage}%`;
  todayPctEl.className = `font-semibold ${todayMetrics.percentage < AppState.settings.threshold ? 'text-[#c5221f]' : 'text-[#137333]'}`;

  // Find lowest bandwidth date in current sprint
  let lowestMetric = null;
  AppState.dates.forEach(d => {
    const m = calculateDateBandwidth(d.key);
    if (!lowestMetric || m.percentage < lowestMetric.percentage) {
      lowestMetric = { ...m, label: d.label };
    }
  });

  if (lowestMetric && lowestMetric.isLowBandwidth) {
    criticalPillEl.classList.remove("hidden");
    criticalPillEl.innerHTML = `
      <span>⚠️ ${lowestMetric.label} &lt; ${AppState.settings.threshold}% (${lowestMetric.percentage}%)</span>
      <span class="underline ml-1 font-semibold">Review Escalation</span>
    `;
    criticalPillEl.className = "inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] hover:bg-[#fad2cf] transition-colors cursor-pointer";
  } else {
    criticalPillEl.innerHTML = `
      <span>✅ Capacity Optimal (&ge; ${AppState.settings.threshold}%)</span>
    `;
    criticalPillEl.className = "inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#e6f4ea] text-[#137333] border border-[#ceead6]";
  }
}

// Render Main Attendance & Bandwidth Grid Table
function renderTrackerTable() {
  const thead = document.getElementById("table-head");
  const tbody = document.getElementById("table-body");
  const tfoot = document.getElementById("table-foot");

  if (!thead || !tbody || !tfoot) return;

  let filteredTeam = AppState.team.filter(member => {
    const matchesSearch = AppState.searchQuery === "" || 
      member.name.toLowerCase().includes(AppState.searchQuery.toLowerCase()) ||
      member.project.toLowerCase().includes(AppState.searchQuery.toLowerCase()) ||
      (member.defaultBackup && member.defaultBackup.toLowerCase().includes(AppState.searchQuery.toLowerCase()));

    const matchesProject = AppState.projectFilter === "ALL" || member.project === AppState.projectFilter;

    return matchesSearch && matchesProject;
  });

  // 1. Table Header
  let headerHtml = `
    <tr class="bg-[#f8fafd] border-b border-[#dadce0] text-[#5f6368] font-medium text-[11px]">
      <th class="sticky-col-idx px-2.5 py-2.5 w-10 text-center border-r border-[#dadce0]">#</th>
      <th class="sticky-col-name px-3 py-2.5 w-56 text-left border-r border-[#dadce0]">Team Member</th>
      <th class="sticky-col-backup px-3 py-2.5 w-44 text-left border-r border-[#dadce0]">Default Backup</th>
  `;

  AppState.dates.forEach(dt => {
    const metrics = calculateDateBandwidth(dt.key, filteredTeam);
    const isCritical = metrics.isLowBandwidth;

    headerHtml += `
      <th class="px-1.5 py-2 text-center min-w-[68px] border-r border-[#dadce0] ${dt.isWeekend ? 'bg-[#f1f3f4]/70' : 'bg-[#f8fafd]'} ${isCritical ? 'bg-[#fce8e6]/80 text-[#c5221f]' : ''}">
        <div class="text-[10px] uppercase tracking-wider ${dt.isWeekend ? 'text-[#80868b]' : (isCritical ? 'text-[#c5221f] font-semibold' : 'text-[#5f6368]')}">${dt.dayName}</div>
        <div class="text-xs font-semibold ${isCritical ? 'text-[#c5221f]' : 'text-[#202124]'}">${dt.label}</div>
        <div class="mt-1">
          <span class="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold ${
            isCritical ? 'bg-[#d93025] text-white shadow-xs' : (metrics.percentage < 70 ? 'bg-[#fef7e0] text-[#b06000] border border-[#feefc3]' : 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]')
          }">
            ${metrics.percentage}%
          </span>
        </div>
      </th>
    `;
  });

  headerHtml += `</tr>`;
  thead.innerHTML = headerHtml;

  // 2. Table Rows
  if (filteredTeam.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${3 + AppState.dates.length}" class="py-12 text-center text-[#5f6368]">
          <div class="text-sm font-medium text-[#202124]">No team members match your criteria</div>
          <p class="text-xs text-[#80868b] mt-1">Try clearing your search query or selecting "All Squads".</p>
        </td>
      </tr>
    `;
  } else {
    let bodyHtml = "";
    filteredTeam.forEach((member, index) => {
      const displayBackup = member.defaultBackup || "None assigned";

      bodyHtml += `
        <tr class="hover:bg-[#f8fafd] transition-colors border-b border-[#ebebeb]">
          <td class="sticky-col-idx px-2.5 py-2 text-[11px] text-[#80868b] text-center font-mono border-r border-[#ebebeb]">${index + 1}</td>
          
          <td class="sticky-col-name px-3 py-2 text-xs border-r border-[#ebebeb]">
            <div class="flex items-center space-x-2">
              <span class="w-6 h-6 rounded-full bg-[#e8f0fe] text-[#1a73e8] font-bold text-[11px] flex items-center justify-center shrink-0">
                ${member.name.charAt(0)}
              </span>
              <div class="truncate max-w-[170px]">
                <button onclick="openInspectorDrawer('${member.id}', '${AppState.dates[0].key}')" class="font-medium text-[#202124] hover:text-[#1a73e8] hover:underline truncate text-left block">
                  ${member.name}
                </button>
                <span class="text-[10px] text-[#5f6368] truncate block" title="${member.project}">
                  ${member.project}
                </span>
              </div>
            </div>
          </td>

          <td class="sticky-col-backup px-3 py-2 text-xs text-[#3c4043] border-r border-[#ebebeb]">
            <div class="flex items-center space-x-1.5 truncate max-w-[150px]" title="Backup: ${displayBackup}">
              <span class="truncate">${displayBackup}</span>
            </div>
          </td>
      `;

      // Date cells
      AppState.dates.forEach(dt => {
        const status = member.schedule[dt.key] || "Working";
        const dateReason = member.leaveReasons[dt.key] || member.defaultReason || "";
        const dateBackup = member.dateBackups[dt.key] || member.defaultBackup || "";
        
        let chipClass = "status-chip-working";
        let statusAbbr = "W";
        if (status === "Planned Leave") {
          chipClass = "status-chip-leave";
          statusAbbr = "PL";
        } else if (status === "Half day") {
          chipClass = "status-chip-halfday";
          statusAbbr = "HD";
        } else if (status === "Not Applicable") {
          chipClass = "status-chip-na";
          statusAbbr = "NA";
        }

        const tooltip = `${member.name} • ${dt.label}\nStatus: ${status}${status !== 'Working' ? `\nBackup: ${dateBackup}\nReason: ${dateReason}` : ''}`;

        bodyHtml += `
          <td class="px-1 py-1.5 text-center border-r border-[#ebebeb] ${dt.isWeekend ? 'bg-[#f8f9fa]/60' : ''}">
            <button 
              type="button"
              onclick="openInspectorDrawer('${member.id}', '${dt.key}')"
              class="status-chip ${chipClass}" 
              title="${tooltip}">
              ${statusAbbr}
            </button>
          </td>
        `;
      });

      bodyHtml += `</tr>`;
    });
    tbody.innerHTML = bodyHtml;
  }

  // 3. Table Footer (Clean Google Sheets Summary)
  let footerHtml = `
    <!-- Full Working Headcount -->
    <tr class="bg-[#f8fafd] font-medium text-xs border-b border-[#ebebeb]">
      <td class="sticky-col-idx px-2 py-2 text-center text-[#137333]">✓</td>
      <td class="sticky-col-name px-3 py-2 text-[#3c4043] font-semibold">Active Staff (100% capacity)</td>
      <td class="sticky-col-backup px-3 py-2 text-[#80868b]">-</td>
  `;
  AppState.dates.forEach(dt => {
    const m = calculateDateBandwidth(dt.key, filteredTeam);
    footerHtml += `
      <td class="px-1.5 py-2 text-center border-r border-[#ebebeb] text-[#137333] font-semibold">
        ${m.workingCount}
      </td>
    `;
  });
  footerHtml += `</tr>`;

  // Planned Leaves Count
  footerHtml += `
    <tr class="bg-[#f8fafd] font-medium text-xs border-b border-[#ebebeb]">
      <td class="sticky-col-idx px-2 py-1.5 text-center text-[#c5221f]">✕</td>
      <td class="sticky-col-name px-3 py-1.5 text-[#3c4043]">Leaves / Half-Day Absent</td>
      <td class="sticky-col-backup px-3 py-1.5 text-[#80868b]">-</td>
  `;
  AppState.dates.forEach(dt => {
    const m = calculateDateBandwidth(dt.key, filteredTeam);
    const totalAbsent = m.leaveCount + m.halfDayCount;
    footerHtml += `
      <td class="px-1.5 py-1.5 text-center border-r border-[#ebebeb] text-[#c5221f] font-semibold">
        ${totalAbsent}
      </td>
    `;
  });
  footerHtml += `</tr>`;

  // BANDWIDTH % CAPACITY ROW (AUTOMATIC <40% TRIGGER ESCALATION)
  footerHtml += `
    <tr class="bg-white font-semibold text-xs border-t-2 border-[#1a73e8]">
      <td class="sticky-col-idx px-2 py-2.5 text-center text-[#1a73e8]">⚡</td>
      <td class="sticky-col-name px-3 py-2.5 text-[#202124] font-bold flex items-center justify-between">
        <span>Capacity Bandwidth</span>
        <span class="text-[10px] text-[#5f6368] font-normal">Target &ge; ${AppState.settings.threshold}%</span>
      </td>
      <td class="sticky-col-backup px-3 py-2.5 text-[11px] text-[#5f6368]">
        Auto Lead Trigger
      </td>
  `;

  AppState.dates.forEach(dt => {
    const m = calculateDateBandwidth(dt.key, filteredTeam);
    const isCritical = m.isLowBandwidth;

    footerHtml += `
      <td class="px-1.5 py-2.5 text-center border-r border-[#ebebeb] ${isCritical ? 'bg-[#fce8e6]' : ''}">
        <div class="text-xs font-bold ${isCritical ? 'text-[#c5221f]' : (m.percentage < 70 ? 'text-[#b06000]' : 'text-[#137333]')}">
          ${m.percentage}%
        </div>
        <div class="text-[10px] text-[#80868b] font-normal">
          ${m.effectiveWorking}/${m.totalRelevant}
        </div>
        ${isCritical ? `
          <button onclick="toggleAlertsDrawer()" class="mt-1 px-1.5 py-0.5 bg-[#d93025] hover:bg-[#c5221f] text-white text-[9px] rounded font-semibold block w-full shadow-xs">
            Alert
          </button>
        ` : ''}
      </td>
    `;
  });
  footerHtml += `</tr>`;

  tfoot.innerHTML = footerHtml;
}

// Render Badge on Header Alert Bell
function renderAlertCenterBadge() {
  const bellBadge = document.getElementById("alert-bell-badge");
  if (!bellBadge) return;

  const criticalDates = AppState.dates.filter(d => calculateDateBandwidth(d.key).isLowBandwidth);
  const count = criticalDates.length;

  if (count > 0) {
    bellBadge.textContent = count;
    bellBadge.classList.remove("hidden");
  } else {
    bellBadge.classList.add("hidden");
  }
}

// ==========================================
// DRAWER 1: INSPECTOR SLIDE-OVER PANEL
// ==========================================

function openInspectorDrawer(memberId, dateKey) {
  const member = AppState.team.find(m => m.id === memberId);
  const dateObj = AppState.dates.find(d => d.key === dateKey);
  if (!member || !dateObj) return;

  AppState.activeInspect = { memberId, dateKey };

  const currentStatus = member.schedule[dateKey] || "Working";
  const currentReason = member.leaveReasons[dateKey] || member.defaultReason || "";
  const currentBackup = member.dateBackups[dateKey] || member.defaultBackup || "";

  document.getElementById("inspect-member-name").textContent = member.name;
  document.getElementById("inspect-member-squad").textContent = member.project;
  document.getElementById("inspect-date").textContent = `${dateObj.dayName}, ${dateObj.fullDate}`;
  
  document.getElementById("inspect-status").value = currentStatus;
  document.getElementById("inspect-reason").value = currentReason;
  
  const backupSelect = document.getElementById("inspect-backup");
  backupSelect.innerHTML = `<option value="">Select a backup colleague...</option>`;
  AppState.team.forEach(m => {
    if (m.id !== member.id) {
      backupSelect.innerHTML += `<option value="${m.name}" ${m.name === currentBackup ? 'selected' : ''}>${m.name} (${m.project})</option>`;
    }
  });

  const aiHint = document.getElementById("inspect-ai-hint");
  if (aiHint) aiHint.classList.add("hidden");

  document.getElementById("inspector-drawer").classList.remove("hidden");
}

function closeInspectorDrawer() {
  document.getElementById("inspector-drawer").classList.add("hidden");
  AppState.activeInspect = null;
}

function saveInspectorEdit() {
  if (!AppState.activeInspect) return;
  const { memberId, dateKey } = AppState.activeInspect;
  const member = AppState.team.find(m => m.id === memberId);
  if (!member) return;

  const newStatus = document.getElementById("inspect-status").value;
  const newReason = document.getElementById("inspect-reason").value.trim();
  const newBackup = document.getElementById("inspect-backup").value;
  const applyAll = document.getElementById("inspect-apply-all").checked;

  if (applyAll) {
    AppState.dates.forEach(d => {
      if (!d.isWeekend || newStatus === "Not Applicable") {
        member.schedule[d.key] = newStatus;
        if (newStatus !== "Working") {
          member.leaveReasons[d.key] = newReason;
          member.dateBackups[d.key] = newBackup;
        }
      }
    });
  } else {
    member.schedule[dateKey] = newStatus;
    if (newStatus !== "Working") {
      member.leaveReasons[dateKey] = newReason;
      member.dateBackups[dateKey] = newBackup;
    }
  }

  if (newBackup) member.defaultBackup = newBackup;
  if (newReason) member.defaultReason = newReason;

  saveTeamData();
  closeInspectorDrawer();
  
  scanAndTriggerBandwidthAlerts(true);
  renderDashboard();
}

function applyAISmartBackupInInspector() {
  if (!AppState.activeInspect) return;
  const { memberId, dateKey } = AppState.activeInspect;
  const backupSelect = document.getElementById("inspect-backup");
  const aiHint = document.getElementById("inspect-ai-hint");

  const rec = PulseAI.recommendSmartBackup(memberId, dateKey, AppState.team);
  if (!rec) {
    showToastNotification("No available peers found for this date.");
    return;
  }

  backupSelect.value = rec.name;
  if (aiHint) {
    aiHint.innerHTML = `✨ <strong>AI Recommendation:</strong> ${rec.name} (${rec.project}) &bull; ${rec.reason}`;
    aiHint.classList.remove("hidden");
  }
}

// ==========================================
// DRAWER 2: GEMINI WORKSPACE ASSISTANT
// ==========================================

function toggleGeminiDrawer() {
  const drawer = document.getElementById("gemini-drawer");
  if (!drawer) return;
  drawer.classList.toggle("hidden");
  if (!drawer.classList.contains("hidden")) {
    document.getElementById("gemini-input").focus();
  }
}

function askGeminiPrompt(promptText) {
  const input = document.getElementById("gemini-input");
  if (input) {
    input.value = promptText;
    handleGeminiSubmit(new Event("submit"));
  }
}

async function handleGeminiSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("gemini-input");
  const question = input.value.trim();
  if (!question) return;

  const messagesContainer = document.getElementById("gemini-messages");
  
  // Append User message
  messagesContainer.innerHTML += `
    <div class="flex justify-end">
      <div class="gemini-bubble-user p-3 max-w-[85%] font-medium">
        ${escapeHtml(question)}
      </div>
    </div>
  `;
  input.value = "";
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Thinking indicator
  const thinkingId = `gemini-thinking-${Date.now()}`;
  messagesContainer.innerHTML += `
    <div id="${thinkingId}" class="flex items-center space-x-2 text-[#1a73e8] text-xs py-1">
      <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      <span>Gemini analyzing 100 members &amp; bandwidth patterns...</span>
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Query PulseAI engine
  const answer = await PulseAI.askCopilot(question, AppState.team, AppState.dates, AppState.settings);

  const thinkingEl = document.getElementById(thinkingId);
  if (thinkingEl) thinkingEl.remove();

  const formattedAnswer = formatMarkdownToHtml(answer);

  messagesContainer.innerHTML += `
    <div class="gemini-bubble-ai p-3 text-xs leading-relaxed max-w-[95%]">
      ${formattedAnswer}
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ==========================================
// DRAWER 3: ESCALATIONS & ALERTS CENTER
// ==========================================

function toggleAlertsDrawer() {
  const drawer = document.getElementById("alerts-drawer");
  if (!drawer) return;
  drawer.classList.toggle("hidden");
  if (!drawer.classList.contains("hidden")) {
    renderAlertsDrawerFeed();
  }
}

function renderAlertsDrawerFeed() {
  const feed = document.getElementById("alerts-drawer-feed");
  if (!feed) return;

  const criticalDates = AppState.dates.filter(d => calculateDateBandwidth(d.key).isLowBandwidth);

  if (criticalDates.length === 0) {
    feed.innerHTML = `
      <div class="py-12 text-center text-[#5f6368]">
        <div class="w-12 h-12 bg-[#e6f4ea] text-[#137333] rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold">
          ✓
        </div>
        <h4 class="text-sm font-semibold text-[#202124]">All Dates Above Bandwidth Target (&ge; ${AppState.settings.threshold}%)</h4>
        <p class="text-xs text-[#80868b] mt-1">No automated escalations active across the team.</p>
      </div>
    `;
    return;
  }

  let html = "";
  criticalDates.forEach(dt => {
    const metrics = calculateDateBandwidth(dt.key);
    const absentMembers = AppState.team.filter(m => m.schedule[dt.key] === "Planned Leave" || m.schedule[dt.key] === "Half day");

    html += `
      <div class="bg-white border border-[#fad2cf] rounded-lg p-4 shadow-xs">
        <div class="flex items-start justify-between pb-2 border-b border-[#fad2cf]">
          <div>
            <span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#fce8e6] text-[#c5221f]">
              ⚠️ Automated Lead Trigger
            </span>
            <h4 class="text-sm font-bold text-[#202124] mt-1">${dt.dayName}, ${dt.fullDate}</h4>
          </div>
          <div class="text-right">
            <div class="text-xl font-bold text-[#c5221f]">${metrics.percentage}% Capacity</div>
            <div class="text-[10px] text-[#5f6368]">${metrics.effectiveWorking}/${metrics.totalRelevant} Available</div>
          </div>
        </div>

        <div class="mt-3">
          <div class="text-[11px] font-semibold text-[#3c4043] mb-1">Absent Staff &amp; Coverage (${absentMembers.length}):</div>
          <div class="max-h-36 overflow-y-auto border border-[#ebebeb] rounded">
            <table class="w-full text-left text-[11px]">
              <thead class="bg-[#f8fafd] text-[#5f6368] sticky top-0">
                <tr>
                  <th class="py-1 px-2">Member</th>
                  <th class="py-1 px-2">Status</th>
                  <th class="py-1 px-2">Backup</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#ebebeb] text-[#3c4043]">
                ${absentMembers.map(m => {
                  const b = m.dateBackups[dt.key] || m.defaultBackup || "None";
                  const bObj = AppState.team.find(t => t.name === b);
                  const isCollision = bObj && (bObj.schedule[dt.key] === "Planned Leave" || bObj.schedule[dt.key] === "Half day");

                  return `
                    <tr class="hover:bg-[#f8fafd]">
                      <td class="py-1 px-2 font-medium">${m.name}</td>
                      <td class="py-1 px-2 text-[#c5221f]">${m.schedule[dt.key]}</td>
                      <td class="py-1 px-2 ${isCollision ? 'text-[#c5221f] font-bold' : ''}">
                        ${b} ${isCollision ? '⚠️ (Collision!)' : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-3 pt-2 border-t border-[#ebebeb] flex items-center justify-between">
          <span class="text-[10px] text-[#5f6368]">Escalated to: <strong>${AppState.settings.managerEmail}</strong></span>
          <button onclick="sendManagerEmailAlert('${dt.key}')" class="px-3 py-1 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[11px] rounded font-medium shadow-xs">
            Draft Email to Lead
          </button>
        </div>
      </div>
    `;
  });

  feed.innerHTML = html;
}

// Send escalation email draft to lead/manager
function sendManagerEmailAlert(dateKey) {
  const dt = AppState.dates.find(d => d.key === dateKey);
  const metrics = calculateDateBandwidth(dateKey);
  const absent = AppState.team.filter(m => m.schedule[dateKey] === "Planned Leave" || m.schedule[dateKey] === "Half day");

  const subject = `[URGENT] Team Bandwidth Escalation (${metrics.percentage}%) on ${dt.fullDate}`;
  
  let body = `Hi ${AppState.settings.managerName},\n\n`;
  body += `This is an automated capacity escalation from the Google Staffing & Bandwidth Planner.\n`;
  body += `Active team capacity for ${dt.dayName}, ${dt.fullDate} has dropped below the ${AppState.settings.threshold}% threshold.\n\n`;
  body += `SUMMARY METRICS:\n`;
  body += `• Available Bandwidth : ${metrics.percentage}%\n`;
  body += `• Active Working Staff: ${metrics.effectiveWorking} headcount\n`;
  body += `• Absent Members      : ${absent.length} members\n`;
  body += `• Total Scheduled     : ${metrics.totalRelevant} members\n\n`;
  body += `ABSENT MEMBERS & ASSIGNED BACKUPS:\n`;

  absent.forEach((m, idx) => {
    const backup = m.dateBackups[dateKey] || m.defaultBackup || "None";
    const reason = m.leaveReasons[dateKey] || m.defaultReason || "Not specified";
    body += `${idx + 1}. ${m.name} [${m.project}] - Status: ${m.schedule[dateKey]} | Backup: ${backup} | Notes: ${reason}\n`;
  });

  body += `\nPlease review sprint deliverables and arrange secondary cross-squad coverage.\n\n`;
  body += `Google Engineering Staffing & Capacity Engine`;

  navigator.clipboard.writeText(body).then(() => {
    showToastNotification(`Escalation email draft copied to clipboard!`);
  }).catch(() => {
    showToastNotification(`Email drafted for ${AppState.settings.managerEmail}`);
  });

  const mailtoUrl = `mailto:${encodeURIComponent(AppState.settings.managerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl, '_blank');
}

// ==========================================
// MODALS: ADD ENTRY & SETTINGS
// ==========================================

function openAddEntryModal() {
  populateLeaveModalOptions();
  document.getElementById("add-member-modal").classList.remove("hidden");
}

function handleLeaveFormSubmit(e) {
  e.preventDefault();
  const memberSelectVal = document.getElementById("form-member-select").value;
  const newNameInput = document.getElementById("form-new-name").value.trim();
  const project = document.getElementById("form-project-select").value;
  const dateKey = document.getElementById("form-date-select").value;
  const status = document.getElementById("form-status-select").value;
  const backup = document.getElementById("form-backup-select").value;
  const reason = document.getElementById("form-reason-input").value.trim();

  let targetMember = null;

  if (memberSelectVal === "__NEW__") {
    if (!newNameInput) {
      alert("Please enter the full name.");
      return;
    }

    const newId = `MEM-${String(AppState.team.length + 1).padStart(3, '0')}`;
    const schedule = {};
    const leaveReasons = {};
    const dateBackups = {};

    AppState.dates.forEach(d => {
      schedule[d.key] = d.isWeekend ? "Not Applicable" : "Working";
    });

    schedule[dateKey] = status;
    if (status !== "Working") {
      leaveReasons[dateKey] = reason;
      dateBackups[dateKey] = backup;
    }

    targetMember = {
      id: newId,
      name: newNameInput,
      project: project,
      defaultBackup: backup || "None",
      defaultReason: reason || "Standard Schedule",
      email: `${newNameInput.toLowerCase().replace(/\s+/g, '.')}@google.com`,
      schedule: schedule,
      leaveReasons: leaveReasons,
      dateBackups: dateBackups
    };

    AppState.team.push(targetMember);
    showToastNotification(`Registered new member: ${newNameInput}`);
  } else {
    targetMember = AppState.team.find(m => m.id === memberSelectVal);
    if (!targetMember) return;

    targetMember.schedule[dateKey] = status;
    targetMember.leaveReasons[dateKey] = reason;
    targetMember.dateBackups[dateKey] = backup;
    targetMember.project = project;
    if (backup) targetMember.defaultBackup = backup;
    if (reason) targetMember.defaultReason = reason;

    showToastNotification(`Updated attendance for ${targetMember.name}`);
  }

  saveTeamData();
  populateProjectFilter();
  closeModal("add-member-modal");

  scanAndTriggerBandwidthAlerts(true);
  renderDashboard();
}

function applyAISmartBackupInForm() {
  const memberSelectVal = document.getElementById("form-member-select").value;
  const dateKey = document.getElementById("form-date-select").value;
  const backupSelect = document.getElementById("form-backup-select");
  const hintEl = document.getElementById("ai-backup-hint");

  let targetId = memberSelectVal;
  if (targetId === "__NEW__") targetId = AppState.team[0].id;

  const rec = PulseAI.recommendSmartBackup(targetId, dateKey, AppState.team);
  if (!rec) return;

  backupSelect.value = rec.name;
  if (hintEl) {
    hintEl.innerHTML = `✨ <strong>AI Suggestion:</strong> ${rec.name} (${rec.project}) &bull; ${rec.reason}`;
    hintEl.classList.remove("hidden");
  }
}

function openSettingsModal() {
  document.getElementById("settings-manager-name").value = AppState.settings.managerName;
  document.getElementById("settings-manager-email").value = AppState.settings.managerEmail;
  document.getElementById("settings-threshold").value = AppState.settings.threshold;
  document.getElementById("settings-modal").classList.remove("hidden");
}

function saveSettings(e) {
  e.preventDefault();
  AppState.settings.managerName = document.getElementById("settings-manager-name").value.trim();
  AppState.settings.managerEmail = document.getElementById("settings-manager-email").value.trim();
  AppState.settings.threshold = parseInt(document.getElementById("settings-threshold").value, 10) || 40;

  localStorage.setItem("google_staffing_settings", JSON.stringify(AppState.settings));
  closeModal("settings-modal");
  
  const leadEl = document.getElementById("alert-lead-email");
  if (leadEl) leadEl.textContent = AppState.settings.managerEmail;

  scanAndTriggerBandwidthAlerts(true);
  renderDashboard();
  showToastNotification(`Settings saved. Escalation threshold set to < ${AppState.settings.threshold}%`);
}

function resetDemoData() {
  if (confirm("Reset to default 100 staff with initial sample data?")) {
    localStorage.removeItem("google_staffing_team_data");
    localStorage.removeItem("google_staffing_alert_log");
    AppState.team = generateInitialTeam(AppState.dates);
    AppState.alertLog = [];
    saveTeamData();
    populateProjectFilter();
    scanAndTriggerBandwidthAlerts(true);
    renderDashboard();
    showToastNotification("Reset to default 100 members successfully.");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

function showToastNotification(message) {
  const toast = document.getElementById("toast-notification");
  const toastText = document.getElementById("toast-text");
  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.remove("hidden", "translate-y-8", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-8", "opacity-0");
    setTimeout(() => toast.classList.add("hidden"), 250);
  }, 4000);
}

// Helpers
function escapeHtml(text) {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}

function formatMarkdownToHtml(text) {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n• /g, '<br>&bull; ')
    .replace(/\n/g, '<br>');
  return html;
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      AppState.searchQuery = e.target.value;
      renderTrackerTable();
    });
  }

  const projectFilter = document.getElementById("project-filter");
  if (projectFilter) {
    projectFilter.addEventListener("change", (e) => {
      AppState.projectFilter = e.target.value;
      renderTrackerTable();
    });
  }

  // Keyboard shortcut '/' to focus search
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
    if (e.key === "Escape") {
      closeInspectorDrawer();
      const gemini = document.getElementById("gemini-drawer");
      if (gemini && !gemini.classList.contains("hidden")) gemini.classList.add("hidden");
      const alerts = document.getElementById("alerts-drawer");
      if (alerts && !alerts.classList.contains("hidden")) alerts.classList.add("hidden");
      closeModal("add-member-modal");
      closeModal("settings-modal");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
