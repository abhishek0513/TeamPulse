// TeamPulse Bandwidth & Leave Tracker - Core Application Logic

// Application State
const AppState = {
  team: [],
  dates: [],
  searchQuery: "",
  projectFilter: "ALL",
  directorySearchQuery: "",
  activeTab: "tracker",
  settings: {
    managerName: "Sarah Jenkins (Director of Engineering)",
    managerEmail: "sarah.lead@company.com",
    threshold: 40 // percent
  },
  alertLog: [],
  activeCellEdit: null // { memberId, dateKey }
};

// Initialize App
function initApp() {
  // Load dates (14-day sprint view starting from 2026-10-24)
  AppState.dates = generateDateRange("2026-10-24", 14);

  // Load saved state or generate fresh
  const savedTeam = localStorage.getItem("teampulse_team_data");
  const savedSettings = localStorage.getItem("teampulse_settings");
  const savedAlerts = localStorage.getItem("teampulse_alert_log");

  if (savedSettings) {
    try { AppState.settings = JSON.parse(savedSettings); } catch (e) {}
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

  // Update lead email in header / modals
  const leadEl = document.getElementById("alert-manager-email-display");
  if (leadEl) leadEl.textContent = AppState.settings.managerEmail;
}

// LocalStorage helpers
function saveTeamData() {
  localStorage.setItem("teampulse_team_data", JSON.stringify(AppState.team));
}

function saveAlertLog() {
  localStorage.setItem("teampulse_alert_log", JSON.stringify(AppState.alertLog));
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
    showToastNotification(`🚨 Automatic Trigger: Low Bandwidth (<${AppState.settings.threshold}%) detected! Escalation dispatched to ${AppState.settings.managerEmail}`);
  }

  renderAlertCenterBadge();
}

// Switch between Website Views / Tabs
function switchTab(tabId) {
  AppState.activeTab = tabId;

  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.classList.remove("active", "text-indigo-300", "bg-indigo-950/60");
    tab.classList.add("text-slate-400");
  });

  const activeTabBtn = document.getElementById(`tab-${tabId}`);
  if (activeTabBtn) {
    activeTabBtn.classList.add("active");
    activeTabBtn.classList.remove("text-slate-400");
  }

  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));

  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) targetView.classList.remove("hidden");

  if (tabId === "tracker") {
    renderTrackerTable();
  } else if (tabId === "analytics") {
    renderAnalyticsView();
  } else if (tabId === "alerts") {
    renderAlertsView();
  } else if (tabId === "directory") {
    renderDirectoryView();
  }
}

// Populate Project Filter Options
function populateProjectFilter() {
  const filterSelect = document.getElementById("project-filter");
  if (!filterSelect) return;

  const currentVal = filterSelect.value;
  filterSelect.innerHTML = `<option value="ALL">All Projects (100 Members)</option>`;
  
  PROJECTS.forEach(proj => {
    const count = AppState.team.filter(m => m.project === proj).length;
    filterSelect.innerHTML += `<option value="${proj}">${proj} (${count})</option>`;
  });

  if (currentVal) filterSelect.value = currentVal;
}

// Populate Self-Service Leave Modal Options
function populateLeaveModalOptions() {
  const memberSelect = document.getElementById("form-member-select");
  const projectSelect = document.getElementById("form-project-select");
  const dateSelect = document.getElementById("form-date-select");
  const backupSelect = document.getElementById("form-backup-select");

  if (!memberSelect || !projectSelect || !dateSelect || !backupSelect) return;

  memberSelect.innerHTML = `
    <option value="__NEW__">+ Add New Member Name</option>
    <optgroup label="Select Existing Member (${AppState.team.length})">
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

// Handle member select change in leave form
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

// Render Dashboard
function renderDashboard() {
  renderMetricCards();
  renderTrackerTable();
  if (AppState.activeTab === "analytics") renderAnalyticsView();
  if (AppState.activeTab === "alerts") renderAlertsView();
  if (AppState.activeTab === "directory") renderDirectoryView();
}

// Render Metric Cards
function renderMetricCards() {
  const totalMembers = AppState.team.length;
  const todayKey = AppState.dates[0].key;
  const todayMetrics = calculateDateBandwidth(todayKey);
  
  const criticalDatesCount = AppState.dates.filter(d => calculateDateBandwidth(d.key).isLowBandwidth).length;
  
  document.getElementById("stat-total-members").textContent = totalMembers;
  document.getElementById("stat-today-bandwidth").textContent = `${todayMetrics.percentage}%`;
  document.getElementById("stat-today-bandwidth").className = `text-3xl font-extrabold ${
    todayMetrics.percentage < AppState.settings.threshold ? 'text-red-400' : 'text-emerald-400'
  }`;
  
  document.getElementById("stat-today-leaves").textContent = todayMetrics.leaveCount + todayMetrics.halfDayCount;
  
  const alertCard = document.getElementById("stat-critical-card");
  const alertCountEl = document.getElementById("stat-critical-dates");
  alertCountEl.textContent = criticalDatesCount;

  if (criticalDatesCount > 0) {
    alertCard.classList.add("border-red-500", "bg-red-950/40");
    alertCard.classList.remove("border-slate-800", "bg-slate-900/80");
  } else {
    alertCard.classList.remove("border-red-500", "bg-red-950/40");
    alertCard.classList.add("border-slate-800", "bg-slate-900/80");
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

  document.getElementById("visible-count").textContent = `Showing ${filteredTeam.length} of ${AppState.team.length} members`;

  // 1. Table Header
  let headerHtml = `
    <tr>
      <th class="sticky-col-idx px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-11 text-center border-b border-slate-700">#</th>
      <th class="sticky-col-name px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 w-48 text-left border-b border-slate-700">Team Member Name</th>
      <th class="sticky-col-proj px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 w-44 text-left border-b border-slate-700">Project Name</th>
      <th class="sticky-col-backup px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 w-44 text-left border-b border-slate-700">Backup Person</th>
      <th class="sticky-col-reason px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 w-44 text-left border-b border-slate-700">Reason / Notes</th>
  `;

  AppState.dates.forEach(dt => {
    const metrics = calculateDateBandwidth(dt.key, filteredTeam);
    const isCritical = metrics.isLowBandwidth;

    headerHtml += `
      <th class="px-2 py-2 text-center min-w-[76px] border-b border-l border-slate-800 ${dt.isWeekend ? 'bg-slate-900/90' : 'bg-slate-900'} ${isCritical ? 'bg-red-950/60 border-red-500' : ''}">
        <div class="text-[11px] font-medium ${dt.isWeekend ? 'text-slate-500' : 'text-slate-400'}">${dt.dayName}</div>
        <div class="text-xs font-bold text-slate-200">${dt.label}</div>
        <div class="mt-1">
          <span class="inline-block px-1.5 py-0.5 text-[10px] rounded font-bold ${
            isCritical ? 'bg-red-600 text-white alert-pulse' : (metrics.percentage < 70 ? 'bg-amber-600/80 text-amber-100' : 'bg-emerald-600/80 text-emerald-100')
          }">
            ${isCritical ? '🚨 ' : ''}${metrics.percentage}%
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
        <td colspan="${5 + AppState.dates.length}" class="py-12 text-center text-slate-400">
          <div class="text-base font-medium text-slate-300">No team members match your criteria</div>
          <p class="text-xs text-slate-500 mt-1">Try clearing your search query or selecting "All Projects".</p>
        </td>
      </tr>
    `;
  } else {
    let bodyHtml = "";
    filteredTeam.forEach((member, index) => {
      const displayReason = member.defaultReason || "General Availability";
      const displayBackup = member.defaultBackup || "Not Assigned";

      bodyHtml += `
        <tr class="border-b border-slate-800/80 hover:bg-slate-800/50 transition-colors">
          <td class="sticky-col-idx px-3 py-2 text-xs text-slate-400 text-center font-mono">${index + 1}</td>
          
          <td class="sticky-col-name px-4 py-2 text-sm text-slate-100 font-medium">
            <div class="flex items-center space-x-2">
              <span class="w-6 h-6 rounded-full bg-indigo-600/60 text-indigo-200 text-xs flex items-center justify-center font-bold">
                ${member.name.charAt(0)}
              </span>
              <button onclick="openCellEditModal('${member.id}', '${AppState.dates[0].key}')" class="hover:text-indigo-300 text-left truncate max-w-[140px] font-semibold">
                ${member.name}
              </button>
            </div>
          </td>

          <td class="sticky-col-proj px-4 py-2 text-xs text-slate-300 truncate max-w-[170px]" title="${member.project}">
            <span class="inline-block px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700/60 truncate max-w-full">
              ${member.project}
            </span>
          </td>

          <td class="sticky-col-backup px-4 py-2 text-xs text-slate-300 truncate max-w-[170px]" title="Backup: ${displayBackup}">
            <span class="text-indigo-300 font-medium flex items-center">
              <svg class="w-3.5 h-3.5 mr-1 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              <span class="truncate">${displayBackup}</span>
            </span>
          </td>

          <td class="sticky-col-reason px-4 py-2 text-xs text-slate-400 truncate max-w-[170px]" title="${displayReason}">
            <span class="truncate block text-slate-400 italic">${displayReason}</span>
          </td>
      `;

      AppState.dates.forEach(dt => {
        const status = member.schedule[dt.key] || "Working";
        const dateReason = member.leaveReasons[dt.key] || member.defaultReason || "";
        const dateBackup = member.dateBackups[dt.key] || member.defaultBackup || "";
        
        let pillClass = "status-working";
        let statusAbbr = "W";
        if (status === "Planned Leave") {
          pillClass = "status-leave";
          statusAbbr = "PL";
        } else if (status === "Half day") {
          pillClass = "status-halfday";
          statusAbbr = "HD";
        } else if (status === "Not Applicable") {
          pillClass = "status-na";
          statusAbbr = "NA";
        }

        const tooltip = `${member.name} | ${dt.label}\nStatus: ${status}${status !== 'Working' ? `\nBackup: ${dateBackup}\nReason: ${dateReason}` : ''}`;

        bodyHtml += `
          <td class="px-1.5 py-1.5 text-center border-l border-slate-800/80 ${dt.isWeekend ? 'bg-slate-900/40' : ''}">
            <button 
              type="button"
              onclick="openCellEditModal('${member.id}', '${dt.key}')"
              class="status-pill ${pillClass}" 
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

  // 3. Table Footer
  let footerHtml = `
    <tr class="border-t-2 border-slate-700 bg-slate-900/95 font-semibold text-xs">
      <td class="sticky-col-idx px-3 py-2 text-center text-emerald-400">📊</td>
      <td class="sticky-col-name px-4 py-2 text-slate-200">Full Working Count</td>
      <td class="sticky-col-proj px-4 py-2 text-slate-400">-</td>
      <td class="sticky-col-backup px-4 py-2 text-slate-400">-</td>
      <td class="sticky-col-reason px-4 py-2 text-slate-400 text-xs">100% staff</td>
  `;

  AppState.dates.forEach(dt => {
    const m = calculateDateBandwidth(dt.key, filteredTeam);
    footerHtml += `
      <td class="px-2 py-2 text-center border-l border-slate-700 text-emerald-400 font-bold">
        ${m.workingCount}
      </td>
    `;
  });
  footerHtml += `</tr>`;

  footerHtml += `
    <tr class="border-t border-slate-800 bg-slate-900/95 font-medium text-xs">
      <td class="sticky-col-idx px-3 py-1.5 text-center text-amber-400">⏱️</td>
      <td class="sticky-col-name px-4 py-1.5 text-slate-300">Half Day Count</td>
      <td class="sticky-col-proj px-4 py-1.5 text-slate-400">-</td>
      <td class="sticky-col-backup px-4 py-1.5 text-slate-400">-</td>
      <td class="sticky-col-reason px-4 py-1.5 text-slate-400 text-xs">0.5x capacity</td>
  `;
  AppState.dates.forEach(dt => {
    const m = calculateDateBandwidth(dt.key, filteredTeam);
    footerHtml += `
      <td class="px-2 py-1.5 text-center border-l border-slate-700 text-amber-400 font-bold">
        ${m.halfDayCount}
      </td>
    `;
  });
  footerHtml += `</tr>`;

  footerHtml += `
    <tr class="border-t border-slate-800 bg-slate-900/95 font-medium text-xs">
      <td class="sticky-col-idx px-3 py-1.5 text-center text-red-400">🏖️</td>
      <td class="sticky-col-name px-4 py-1.5 text-slate-300">Planned Leaves (Absent)</td>
      <td class="sticky-col-proj px-4 py-1.5 text-slate-400">-</td>
      <td class="sticky-col-backup px-4 py-1.5 text-slate-400">-</td>
      <td class="sticky-col-reason px-4 py-1.5 text-slate-400 text-xs">0% capacity</td>
  `;
  AppState.dates.forEach(dt => {
    const m = calculateDateBandwidth(dt.key, filteredTeam);
    footerHtml += `
      <td class="px-2 py-1.5 text-center border-l border-slate-700 text-red-400 font-bold">
        ${m.leaveCount}
      </td>
    `;
  });
  footerHtml += `</tr>`;

  // BANDWIDTH ROW
  footerHtml += `
    <tr class="border-t-2 border-indigo-500 bg-slate-950 font-bold text-sm shadow-xl">
      <td class="sticky-col-idx px-3 py-3 text-center text-indigo-400">⚡</td>
      <td class="sticky-col-name px-4 py-3 text-white font-black flex items-center">
        <span>BANDWIDTH %</span>
        <span class="ml-2 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] rounded uppercase">Target &ge; 40%</span>
      </td>
      <td class="sticky-col-proj px-4 py-3 text-xs text-indigo-200">Capacity Ratio</td>
      <td class="sticky-col-backup px-4 py-3 text-xs text-indigo-200">Auto Lead Alert</td>
      <td class="sticky-col-reason px-4 py-3 text-xs text-slate-300">
        <span class="text-red-400 font-bold">&lt; 40% = Escalate</span>
      </td>
  `;

  AppState.dates.forEach(dt => {
    const m = calculateDateBandwidth(dt.key, filteredTeam);
    const isCritical = m.isLowBandwidth;

    footerHtml += `
      <td class="px-2 py-3 text-center border-l border-slate-700 ${isCritical ? 'bg-red-950/90 text-red-300 border-red-500' : 'text-slate-100'}">
        <div class="text-sm font-extrabold ${isCritical ? 'text-red-400 alert-pulse' : (m.percentage < 70 ? 'text-amber-400' : 'text-emerald-400')}">
          ${m.percentage}%
        </div>
        <div class="text-[10px] text-slate-400 font-normal mt-0.5">
          ${m.effectiveWorking}/${m.totalRelevant}
        </div>
        ${isCritical ? `
          <button onclick="switchTab('alerts')" class="mt-1 px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] rounded font-bold shadow uppercase block w-full">
            🚨 ALERT
          </button>
        ` : ''}
      </td>
    `;
  });
  footerHtml += `</tr>`;

  tfoot.innerHTML = footerHtml;
}

// Render Tab 2: Capacity Analytics View
function renderAnalyticsView() {
  const chartContainer = document.getElementById("analytics-chart-container");
  const projectCardsContainer = document.getElementById("project-breakdown-cards");
  if (!chartContainer || !projectCardsContainer) return;

  let chartHtml = "";
  AppState.dates.forEach(dt => {
    const m = calculateDateBandwidth(dt.key);
    const isCritical = m.isLowBandwidth;
    const heightPct = Math.max(m.percentage, 10);
    
    let barColor = "bg-emerald-500";
    if (isCritical) barColor = "bg-red-600 alert-pulse";
    else if (m.percentage < 70) barColor = "bg-amber-500";

    chartHtml += `
      <div class="flex flex-col items-center group cursor-pointer" onclick="openCellEditModal('${AppState.team[0].id}', '${dt.key}')">
        <span class="text-[11px] font-bold ${isCritical ? 'text-red-400' : 'text-slate-300'} mb-1">
          ${isCritical ? '🚨 ' : ''}${m.percentage}%
        </span>
        <div class="w-full bg-slate-950 rounded-t-lg h-44 flex items-end p-1 border border-slate-800">
          <div class="w-full ${barColor} rounded-t transition-all duration-300 group-hover:brightness-125" style="height: ${heightPct}%"></div>
        </div>
        <div class="mt-2 text-center">
          <div class="text-[11px] font-semibold text-white">${dt.label}</div>
          <div class="text-[10px] text-slate-500">${dt.dayName}</div>
        </div>
      </div>
    `;
  });
  chartContainer.innerHTML = chartHtml;

  let projHtml = "";
  PROJECTS.forEach(p => {
    const membersInProj = AppState.team.filter(m => m.project === p);
    let totalBw = 0;
    AppState.dates.forEach(d => {
      totalBw += calculateDateBandwidth(d.key, membersInProj).percentage;
    });
    const avgBw = Math.round(totalBw / AppState.dates.length);

    projHtml += `
      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
        <div class="text-xs font-semibold text-slate-400 truncate" title="${p}">${p}</div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-2xl font-bold ${avgBw < AppState.settings.threshold ? 'text-red-400' : 'text-emerald-400'}">${avgBw}% Avg</span>
          <span class="text-xs text-slate-400">${membersInProj.length} members</span>
        </div>
        <div class="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
          <div class="h-1.5 ${avgBw < AppState.settings.threshold ? 'bg-red-500' : 'bg-emerald-500'}" style="width: ${avgBw}%"></div>
        </div>
      </div>
    `;
  });
  projectCardsContainer.innerHTML = projHtml;
}

// Render Tab 3: Alerts View (Manager Escalation Feed)
function renderAlertsView() {
  const alertsFeed = document.getElementById("alerts-tab-feed");
  if (!alertsFeed) return;

  const criticalDates = AppState.dates.filter(d => calculateDateBandwidth(d.key).isLowBandwidth);

  if (criticalDates.length === 0) {
    alertsFeed.innerHTML = `
      <div class="py-12 text-center">
        <div class="w-16 h-16 bg-emerald-950/60 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/40">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h3 class="text-lg font-bold text-slate-100">Optimal Bandwidth across All Dates (&ge; ${AppState.settings.threshold}%)</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">No critical shortages detected. Sufficient coverage is maintained across all teams.</p>
      </div>
    `;
    return;
  }

  let html = "";
  criticalDates.forEach(dt => {
    const metrics = calculateDateBandwidth(dt.key);
    const absentMembers = AppState.team.filter(m => m.schedule[dt.key] === "Planned Leave" || m.schedule[dt.key] === "Half day");

    html += `
      <div class="bg-slate-950 border border-red-500/60 rounded-2xl p-5 shadow-lg">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div>
            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-bold alert-pulse">
                🚨 CRITICAL CAPACITY SHORTAGE (&lt; ${AppState.settings.threshold}%)
              </span>
              <span class="text-xs text-slate-400">Trigger Sent to: <strong class="text-indigo-300">${AppState.settings.managerEmail}</strong></span>
            </div>
            <h4 class="text-lg font-black text-white mt-2">${dt.dayName}, ${dt.fullDate}</h4>
          </div>

          <div class="text-right">
            <div class="text-3xl font-black text-red-400">${metrics.percentage}% Bandwidth</div>
            <div class="text-xs text-slate-400">Available: ${metrics.effectiveWorking} / ${metrics.totalRelevant} members</div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
            <div class="text-xs text-slate-400">Working Staff</div>
            <div class="text-lg font-bold text-emerald-400">${metrics.workingCount} Full + ${metrics.halfDayCount} Half</div>
          </div>
          <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
            <div class="text-xs text-slate-400">Absent on Leave</div>
            <div class="text-lg font-bold text-red-400">${absentMembers.length} Members</div>
          </div>
          <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
            <div class="text-xs text-slate-400">Escalation Recipient</div>
            <div class="text-xs font-semibold text-indigo-300 truncate mt-1" title="${AppState.settings.managerEmail}">
              ${AppState.settings.managerEmail}
            </div>
          </div>
        </div>

        <!-- Absent Roster & Designated Backups -->
        <div class="mt-4">
          <h5 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Absent Members &amp; Designated Backup Coverage:</h5>
          <div class="max-h-52 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-950 sticky top-0 text-slate-400">
                <tr>
                  <th class="py-2.5 px-3">Member Name</th>
                  <th class="py-2.5 px-3">Project</th>
                  <th class="py-2.5 px-3">Status</th>
                  <th class="py-2.5 px-3">Reason for Leave</th>
                  <th class="py-2.5 px-3">Backup Assigned</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 text-slate-300">
                ${absentMembers.map(m => {
                  const st = m.schedule[dt.key];
                  const r = m.leaveReasons[dt.key] || m.defaultReason || "Not specified";
                  const b = m.dateBackups[dt.key] || m.defaultBackup || "None";
                  
                  const backupObj = AppState.team.find(t => t.name === b);
                  const backupAlsoAbsent = backupObj && (backupObj.schedule[dt.key] === "Planned Leave" || backupObj.schedule[dt.key] === "Half day");

                  return `
                    <tr class="hover:bg-slate-800/50">
                      <td class="py-2 px-3 font-semibold text-white">${m.name}</td>
                      <td class="py-2 px-3 text-slate-400">${m.project}</td>
                      <td class="py-2 px-3">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${st === 'Half day' ? 'bg-amber-900/80 text-amber-300' : 'bg-red-900/80 text-red-300'}">
                          ${st}
                        </span>
                      </td>
                      <td class="py-2 px-3 italic text-slate-400">${r}</td>
                      <td class="py-2 px-3">
                        <span class="font-medium ${backupAlsoAbsent ? 'text-red-400 font-bold' : 'text-indigo-300'}">
                          ${b} ${backupAlsoAbsent ? '⚠️ (Also Absent!)' : '✅'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
          <span class="text-xs text-slate-400">
            Escalation Status: <span class="text-emerald-400 font-bold">AUTOMATIC TRIGGER SENT TO LEAD</span>
          </span>
          <button onclick="sendManagerEmailAlert('${dt.key}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center shadow transition-colors">
            <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            Copy / Dispatch Escalation Email to Manager
          </button>
        </div>
      </div>
    `;
  });

  alertsFeed.innerHTML = html;
}

// Render Tab 4: Team Directory (100 Member Cards)
function renderDirectoryView() {
  const grid = document.getElementById("directory-grid");
  if (!grid) return;

  const query = (AppState.directorySearchQuery || "").toLowerCase();
  const filtered = AppState.team.filter(m => 
    m.name.toLowerCase().includes(query) ||
    m.project.toLowerCase().includes(query) ||
    (m.defaultBackup && m.defaultBackup.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400">No members match "${query}"</div>`;
    return;
  }

  const todayKey = AppState.dates[0].key;

  let html = "";
  filtered.forEach(m => {
    const todayStatus = m.schedule[todayKey] || "Working";
    let statusBadge = "bg-emerald-950 text-emerald-400 border-emerald-500/40";
    if (todayStatus === "Planned Leave") statusBadge = "bg-red-950 text-red-400 border-red-500/40";
    else if (todayStatus === "Half day") statusBadge = "bg-amber-950 text-amber-400 border-amber-500/40";
    else if (todayStatus === "Not Applicable") statusBadge = "bg-slate-800 text-slate-400 border-slate-700";

    html += `
      <div class="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-all hover:-translate-y-0.5">
        <div>
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-bold flex items-center justify-center text-sm shadow">
                ${m.name.charAt(0)}
              </div>
              <div>
                <h4 class="text-sm font-bold text-white truncate max-w-[140px]">${m.name}</h4>
                <span class="text-[11px] text-slate-400 font-mono">${m.id}</span>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}">
              ${todayStatus}
            </span>
          </div>

          <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between text-slate-400">
              <span>Project:</span>
              <span class="text-slate-200 font-medium truncate max-w-[140px]" title="${m.project}">${m.project}</span>
            </div>
            <div class="flex items-center justify-between text-slate-400">
              <span>Backup Colleague:</span>
              <span class="text-indigo-300 font-medium truncate max-w-[140px]" title="${m.defaultBackup || 'None'}">
                ${m.defaultBackup || 'None'}
              </span>
            </div>
            <div class="flex items-center justify-between text-slate-400">
              <span>Default Note:</span>
              <span class="text-slate-400 italic truncate max-w-[140px]" title="${m.defaultReason}">${m.defaultReason}</span>
            </div>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end">
          <button onclick="openCellEditModal('${m.id}', '${todayKey}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors">
            Update Attendance
          </button>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

// Render Badge on Header Alert Button
function renderAlertCenterBadge() {
  const alertCountBtn = document.getElementById("open-alert-center-btn");
  const tabAlertBadge = document.getElementById("tab-alert-badge");
  const alertBtnLabel = document.getElementById("nav-alert-btn-label");

  const criticalDates = AppState.dates.filter(d => calculateDateBandwidth(d.key).isLowBandwidth);
  const count = criticalDates.length;

  if (tabAlertBadge) tabAlertBadge.textContent = count;

  if (!alertCountBtn || !alertBtnLabel) return;

  if (count > 0) {
    alertBtnLabel.textContent = `Manager Alerts (${count})`;
    alertCountBtn.className = "px-3.5 py-2 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/50 text-xs font-semibold flex items-center transition-all alert-pulse";
  } else {
    alertBtnLabel.textContent = "Optimal (0 Alerts)";
    alertCountBtn.className = "px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center transition-all";
  }
}

// ==========================================
// AI FEATURES IMPLEMENTATION
// ==========================================

// 1. Toggle AI Copilot Drawer
function toggleAICopilot() {
  const drawer = document.getElementById("ai-copilot-drawer");
  if (!drawer) return;
  drawer.classList.toggle("hidden");
  if (!drawer.classList.contains("hidden")) {
    document.getElementById("ai-chat-input").focus();
  }
}

// 2. Click a prompt suggestion
function askAIPrompt(promptText) {
  const input = document.getElementById("ai-chat-input");
  if (input) {
    input.value = promptText;
    handleAIChatSubmit(new Event("submit"));
  }
}

// 3. Handle AI Copilot Chat Form Submission
async function handleAIChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("ai-chat-input");
  const question = input.value.trim();
  if (!question) return;

  const messagesContainer = document.getElementById("ai-chat-messages");
  
  // Append User message
  messagesContainer.innerHTML += `
    <div class="flex justify-end">
      <div class="ai-chat-bubble-user p-3 max-w-[85%] font-medium">
        ${escapeHtml(question)}
      </div>
    </div>
  `;
  input.value = "";
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Append Thinking Indicator
  const thinkingId = `ai-thinking-${Date.now()}`;
  messagesContainer.innerHTML += `
    <div id="${thinkingId}" class="flex items-center space-x-2 text-indigo-400 text-xs py-1">
      <svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
      <span>PulseAI analyzing 100 members &amp; bandwidth patterns...</span>
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Ask PulseAI Engine
  const answer = await PulseAI.askCopilot(question, AppState.team, AppState.dates, AppState.settings);

  // Remove thinking indicator
  const thinkingEl = document.getElementById(thinkingId);
  if (thinkingEl) thinkingEl.remove();

  // Format response into HTML
  const formattedAnswer = formatMarkdownToHtml(answer);

  messagesContainer.innerHTML += `
    <div class="ai-chat-bubble-bot p-3 text-xs leading-relaxed max-w-[95%]">
      ${formattedAnswer}
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 4. Open and Render AI Capacity & Risk Audit Modal
function openAIAuditModal() {
  const audit = PulseAI.runCapacityAudit(AppState.team, AppState.dates, AppState.settings.threshold);
  const container = document.getElementById("ai-audit-content");
  if (!container) return;

  let html = `
    <!-- Top Risk Gauge Card -->
    <div class="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Sprint Risk Assessment</span>
        <div class="flex items-center space-x-3 mt-1.5">
          <span class="text-3xl font-black text-white">${audit.riskScore}<span class="text-lg text-slate-500 font-normal">/100</span></span>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${audit.riskBadgeColor}">
            ${audit.riskLevel}
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">Evaluated across 100 engineering staff &amp; 14 sprint dates.</p>
      </div>

      <div class="grid grid-cols-2 gap-3 text-center w-full sm:w-auto">
        <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <div class="text-[10px] text-slate-400 font-semibold uppercase">Breach Dates (&lt;${AppState.settings.threshold}%)</div>
          <div class="text-xl font-bold text-red-400">${audit.criticalDates.length}</div>
        </div>
        <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <div class="text-[10px] text-slate-400 font-semibold uppercase">Backup Collisions</div>
          <div class="text-xl font-bold ${audit.backupCollisions.length > 0 ? 'text-amber-400' : 'text-emerald-400'}">${audit.backupCollisions.length}</div>
        </div>
      </div>
    </div>

    <!-- Identified Hazards -->
    <div>
      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Identified Vulnerabilities &amp; Conflicts:</h4>
      <div class="space-y-2">
  `;

  if (audit.criticalDates.length > 0) {
    audit.criticalDates.forEach(cd => {
      html += `
        <div class="bg-red-950/30 border border-red-500/40 rounded-xl p-3 flex items-start justify-between">
          <div class="flex items-start space-x-2">
            <span class="text-red-400 text-sm mt-0.5">🚨</span>
            <div>
              <div class="text-xs font-bold text-red-200">${cd.label}: Severe Capacity Drop (${cd.bandwidth}%)</div>
              <div class="text-[11px] text-slate-400 mt-0.5">${cd.absent} members on leave, leaving only ${cd.working} active staff.</div>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">Trigger Sent</span>
        </div>
      `;
    });
  }

  if (audit.backupCollisions.length > 0) {
    audit.backupCollisions.forEach(col => {
      html += `
        <div class="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 flex items-start space-x-2">
          <span class="text-amber-400 text-sm mt-0.5">⚠️</span>
          <div>
            <div class="text-xs font-bold text-amber-200">Double-Outage Hazard: ${col.member} &amp; ${col.backup} on ${col.date}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Designated backup is also absent (${col.backupStatus}). Project '${col.project}' has no primary coverage.</div>
          </div>
        </div>
      `;
    });
  }

  html += `
      </div>
    </div>

    <!-- AI Strategic Recommendations -->
    <div>
      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">PulseAI Recommended Mitigation Actions:</h4>
      <div class="space-y-2.5">
  `;

  audit.recommendations.forEach(rec => {
    html += `
      <div class="bg-slate-950 border border-indigo-500/30 rounded-xl p-3.5">
        <div class="text-xs font-bold text-indigo-300">${rec.title}</div>
        <p class="text-xs text-slate-300 mt-1 leading-relaxed">${rec.detail}</p>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
  document.getElementById("ai-audit-modal").classList.remove("hidden");
}

// 5. Smart AI Backup Auto-Recommendation in Leave Form
function applyAISmartBackupInForm() {
  const memberSelectVal = document.getElementById("form-member-select").value;
  const dateKey = document.getElementById("form-date-select").value;
  const backupSelect = document.getElementById("form-backup-select");
  const hintEl = document.getElementById("ai-backup-hint");

  let targetId = memberSelectVal;
  if (targetId === "__NEW__") {
    targetId = AppState.team[0].id; // fallback
  }

  const rec = PulseAI.recommendSmartBackup(targetId, dateKey, AppState.team);
  if (!rec) {
    showToastNotification("No available peer found for that date.");
    return;
  }

  backupSelect.value = rec.name;
  if (hintEl) {
    hintEl.innerHTML = `✨ <strong>AI Match:</strong> Selected <strong>${rec.name}</strong> &bull; ${rec.reason}`;
    hintEl.classList.remove("hidden");
  }

  showToastNotification(`✨ AI suggested ${rec.name} (${rec.project})`);
}

// 6. Smart AI Backup in Cell Modal
function applyAISmartBackupInCellModal() {
  if (!AppState.activeCellEdit) return;
  const { memberId, dateKey } = AppState.activeCellEdit;
  const backupSelect = document.getElementById("edit-cell-backup");

  const rec = PulseAI.recommendSmartBackup(memberId, dateKey, AppState.team);
  if (!rec) return;

  backupSelect.value = rec.name;
  showToastNotification(`✨ AI assigned optimal backup: ${rec.name}`);
}

// Helper: Escape HTML & format markdown bold / bullets
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

// ==========================================
// MODAL CONTROLS & EVENT HANDLERS
// ==========================================

function openCellEditModal(memberId, dateKey) {
  const member = AppState.team.find(m => m.id === memberId);
  const dateObj = AppState.dates.find(d => d.key === dateKey);
  if (!member || !dateObj) return;

  AppState.activeCellEdit = { memberId, dateKey };
  
  const currentStatus = member.schedule[dateKey] || "Working";
  const currentReason = member.leaveReasons[dateKey] || member.defaultReason || "";
  const currentBackup = member.dateBackups[dateKey] || member.defaultBackup || "";

  document.getElementById("edit-cell-member-name").textContent = member.name;
  document.getElementById("edit-cell-project").textContent = member.project;
  document.getElementById("edit-cell-date").textContent = `${dateObj.dayName}, ${dateObj.fullDate}`;
  
  document.getElementById("edit-cell-status").value = currentStatus;
  document.getElementById("edit-cell-reason").value = currentReason;
  
  const backupSelect = document.getElementById("edit-cell-backup");
  backupSelect.innerHTML = `<option value="">Select backup colleague...</option>`;
  AppState.team.forEach(m => {
    if (m.id !== member.id) {
      backupSelect.innerHTML += `<option value="${m.name}" ${m.name === currentBackup ? 'selected' : ''}>${m.name} (${m.project})</option>`;
    }
  });

  document.getElementById("cell-edit-modal").classList.remove("hidden");
}

function saveCellEdit() {
  if (!AppState.activeCellEdit) return;
  const { memberId, dateKey } = AppState.activeCellEdit;
  const member = AppState.team.find(m => m.id === memberId);
  if (!member) return;

  const newStatus = document.getElementById("edit-cell-status").value;
  const newReason = document.getElementById("edit-cell-reason").value;
  const newBackup = document.getElementById("edit-cell-backup").value;
  const applyAllWeek = document.getElementById("edit-cell-apply-all").checked;

  if (applyAllWeek) {
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
  closeModal("cell-edit-modal");
  
  scanAndTriggerBandwidthAlerts(true);
  renderDashboard();
}

function openLeaveRequestModal() {
  populateLeaveModalOptions();
  const hintEl = document.getElementById("ai-backup-hint");
  if (hintEl) hintEl.classList.add("hidden");
  document.getElementById("leave-request-modal").classList.remove("hidden");
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
      alert("Please provide the full name of the new member.");
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
      defaultReason: reason || "Standard Work",
      email: `${newNameInput.toLowerCase().replace(/\s+/g, '.')}@company.com`,
      schedule: schedule,
      leaveReasons: leaveReasons,
      dateBackups: dateBackups
    };

    AppState.team.push(targetMember);
    showToastNotification(`✅ Registered new member: ${newNameInput}`);
  } else {
    targetMember = AppState.team.find(m => m.id === memberSelectVal);
    if (!targetMember) return;

    targetMember.schedule[dateKey] = status;
    targetMember.leaveReasons[dateKey] = reason;
    targetMember.dateBackups[dateKey] = backup;
    targetMember.project = project;
    if (backup) targetMember.defaultBackup = backup;
    if (reason) targetMember.defaultReason = reason;

    showToastNotification(`✅ Updated leave for ${targetMember.name} on ${dateKey}`);
  }

  saveTeamData();
  populateProjectFilter();
  closeModal("leave-request-modal");

  scanAndTriggerBandwidthAlerts(true);
  renderDashboard();
}

function sendManagerEmailAlert(dateKey) {
  const dt = AppState.dates.find(d => d.key === dateKey);
  const metrics = calculateDateBandwidth(dateKey);
  const absent = AppState.team.filter(m => m.schedule[dateKey] === "Planned Leave" || m.schedule[dateKey] === "Half day");

  const subject = `[URGENT INCIDENT] Low Bandwidth Alert (${metrics.percentage}%) on ${dt.fullDate} - Action Required`;
  
  let body = `Dear ${AppState.settings.managerName},\n\n`;
  body += `This is an automated bandwidth alert from TeamPulse Tracker Web Portal.\n`;
  body += `The active team capacity for ${dt.dayName}, ${dt.fullDate} has dropped below the threshold of ${AppState.settings.threshold}%.\n\n`;
  body += `SUMMARY METRICS:\n`;
  body += `--------------------------------------------------\n`;
  body += `• Available Bandwidth : ${metrics.percentage}%\n`;
  body += `• Active Working Staff: ${metrics.effectiveWorking} headcount\n`;
  body += `• Absent Members      : ${absent.length} members\n`;
  body += `• Total Scheduled     : ${metrics.totalRelevant} members\n\n`;
  body += `ABSENT MEMBERS & ASSIGNED BACKUPS:\n`;
  body += `--------------------------------------------------\n`;

  absent.forEach((m, idx) => {
    const backup = m.dateBackups[dateKey] || m.defaultBackup || "None";
    const reason = m.leaveReasons[dateKey] || m.defaultReason || "Not specified";
    body += `${idx + 1}. ${m.name} [${m.project}]\n`;
    body += `   Status: ${m.schedule[dateKey]} | Reason: ${reason}\n`;
    body += `   Designated Backup: ${backup}\n\n`;
  });

  body += `Please review project deliverables and arrange emergency cross-team coverage.\n\n`;
  body += `TeamPulse Web Portal - Automated Escalation Engine`;

  navigator.clipboard.writeText(body).then(() => {
    showToastNotification(`📋 Escalation email copied to clipboard! (Lead: ${AppState.settings.managerEmail})`);
  }).catch(() => {
    showToastNotification(`🚨 Email notification prepared for ${AppState.settings.managerEmail}`);
  });

  const mailtoUrl = `mailto:${encodeURIComponent(AppState.settings.managerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl, '_blank');
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

  localStorage.setItem("teampulse_settings", JSON.stringify(AppState.settings));
  closeModal("settings-modal");
  
  const leadEl = document.getElementById("alert-manager-email-display");
  if (leadEl) leadEl.textContent = AppState.settings.managerEmail;

  scanAndTriggerBandwidthAlerts(true);
  renderDashboard();
  showToastNotification(`⚙️ Settings saved. Alert threshold set to < ${AppState.settings.threshold}%`);
}

function resetDemoData() {
  if (confirm("Reset to default 100 members with initial sample data? Any manual entries will be restored to default.")) {
    localStorage.removeItem("teampulse_team_data");
    localStorage.removeItem("teampulse_alert_log");
    AppState.team = generateInitialTeam(AppState.dates);
    AppState.alertLog = [];
    saveTeamData();
    populateProjectFilter();
    scanAndTriggerBandwidthAlerts(true);
    renderDashboard();
    showToastNotification("🔄 Restored sample 100 team members.");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
  AppState.activeCellEdit = null;
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
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 4500);
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      AppState.searchQuery = e.target.value;
      renderTrackerTable();
    });
  }

  const dirSearch = document.getElementById("directory-search-input");
  if (dirSearch) {
    dirSearch.addEventListener("input", (e) => {
      AppState.directorySearchQuery = e.target.value;
      renderDirectoryView();
    });
  }

  const projectFilter = document.getElementById("project-filter");
  if (projectFilter) {
    projectFilter.addEventListener("change", (e) => {
      AppState.projectFilter = e.target.value;
      renderTrackerTable();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal("cell-edit-modal");
      closeModal("leave-request-modal");
      closeModal("settings-modal");
      closeModal("ai-audit-modal");
      const drawer = document.getElementById("ai-copilot-drawer");
      if (drawer && !drawer.classList.contains("hidden")) drawer.classList.add("hidden");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
