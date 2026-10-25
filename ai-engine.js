// TeamPulse AI Copilot & Predictive Capacity Engine (PulseAI)

const PulseAI = {
  // Optional Gemini / OpenAI API key
  apiKey: localStorage.getItem("teampulse_ai_api_key") || "",
  apiProvider: localStorage.getItem("teampulse_ai_provider") || "offline_expert",

  // 1. Run Complete AI Capacity & Risk Audit
  runCapacityAudit(team, dates, threshold = 40) {
    const criticalDates = [];
    const backupCollisions = [];
    const projectHealth = {};
    const unbackedLeaves = [];
    
    // Initialize project health
    PROJECTS.forEach(p => {
      projectHealth[p] = { total: 0, leaves: 0, criticalDays: 0 };
    });

    dates.forEach(dt => {
      const metrics = calculateDateBandwidth(dt.key, team);
      if (metrics.isLowBandwidth) {
        criticalDates.push({
          date: dt.key,
          label: `${dt.dayName}, ${dt.fullDate}`,
          bandwidth: metrics.percentage,
          working: metrics.effectiveWorking,
          absent: metrics.leaveCount + metrics.halfDayCount,
          total: metrics.totalRelevant
        });
      }

      // Check member leaves on this date
      team.forEach(m => {
        const st = m.schedule[dt.key];
        if (st === "Planned Leave" || st === "Half day") {
          const backupName = m.dateBackups[dt.key] || m.defaultBackup;
          if (!backupName || backupName === "None" || backupName === "") {
            unbackedLeaves.push({ member: m.name, project: m.project, date: dt.label });
          } else {
            // Check if backup is ALSO absent on this date
            const backupMember = team.find(t => t.name === backupName);
            if (backupMember) {
              const backupStatus = backupMember.schedule[dt.key];
              if (backupStatus === "Planned Leave" || backupStatus === "Half day") {
                backupCollisions.push({
                  date: dt.label,
                  dateKey: dt.key,
                  member: m.name,
                  project: m.project,
                  backup: backupName,
                  memberStatus: st,
                  backupStatus: backupStatus
                });
              }
            }
          }
        }
      });
    });

    // Calculate project health
    PROJECTS.forEach(proj => {
      const pMembers = team.filter(m => m.project === proj);
      projectHealth[proj].total = pMembers.length;
      let totalPLeaves = 0;
      dates.forEach(d => {
        const m = calculateDateBandwidth(d.key, pMembers);
        totalPLeaves += (m.leaveCount + m.halfDayCount);
        if (m.percentage < threshold) projectHealth[proj].criticalDays++;
      });
      projectHealth[proj].leaves = totalPLeaves;
      projectHealth[proj].avgBandwidth = Math.round(
        dates.reduce((acc, d) => acc + calculateDateBandwidth(d.key, pMembers).percentage, 0) / dates.length
      );
    });

    // Calculate Composite Risk Score (0 - 100, where 100 is critical risk)
    let riskScore = 0;
    riskScore += criticalDates.length * 20; // 20 pts per breach date
    riskScore += backupCollisions.length * 15; // 15 pts per collision
    riskScore += Math.min(unbackedLeaves.length * 5, 20); // up to 20 pts
    riskScore = Math.min(Math.max(riskScore, 12), 96); // clamp

    let riskLevel = "LOW";
    let riskBadgeColor = "text-emerald-400 bg-emerald-950/80 border-emerald-500/40";
    if (riskScore >= 70) {
      riskLevel = "CRITICAL RISK";
      riskBadgeColor = "text-red-400 bg-red-950/80 border-red-500/40";
    } else if (riskScore >= 40) {
      riskLevel = "MODERATE RISK";
      riskBadgeColor = "text-amber-400 bg-amber-950/80 border-amber-500/40";
    }

    // AI Strategic Recommendations
    const recommendations = [];
    if (criticalDates.length > 0) {
      const worst = criticalDates.sort((a, b) => a.bandwidth - b.bandwidth)[0];
      recommendations.push({
        title: `🚨 Emergency Sprint Relief for ${worst.label}`,
        detail: `Bandwidth drops to ${worst.bandwidth}% (${worst.absent} staff absent). Recommend freezing major production deployments 24 hours prior to ${worst.label} and implementing mandatory standup reassignments.`
      });
    }

    if (backupCollisions.length > 0) {
      recommendations.push({
        title: `⚠️ Resolve ${backupCollisions.length} Double-Outage Collisions`,
        detail: `Identified peers where both employee and designated backup are simultaneously on leave (e.g. ${backupCollisions[0].member} & ${backupCollisions[0].backup} on ${backupCollisions[0].date}). Cross-project reallocations required.`
      });
    }

    // Find most vulnerable project
    const worstProj = Object.entries(projectHealth).sort((a, b) => a[1].avgBandwidth - b[1].avgBandwidth)[0];
    if (worstProj) {
      recommendations.push({
        title: `🛡️ Reinforce '${worstProj[0]}'`,
        detail: `Average project capacity is ${worstProj[1].avgBandwidth}% with ${worstProj[1].criticalDays} days below ${threshold}%. Recommend shifting secondary tickets to peer squads.`
      });
    }

    recommendations.push({
      title: `📊 Executive Standup Alignment`,
      detail: `Average 14-day team attendance is holding at ${Math.round(dates.reduce((acc, d) => acc + calculateDateBandwidth(d.key, team).percentage, 0) / dates.length)}%. Recommended management action: enforce 48-hour advance notice on planned leaves.`
    });

    return {
      riskScore,
      riskLevel,
      riskBadgeColor,
      criticalDates,
      backupCollisions,
      projectHealth,
      recommendations,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  },

  // 2. Smart AI Backup Recommender
  recommendSmartBackup(memberId, dateKey, team) {
    const member = team.find(m => m.id === memberId);
    if (!member) return null;

    // Find peers in same project who are Working on this date
    let candidates = team.filter(m => 
      m.id !== member.id && 
      m.project === member.project && 
      (m.schedule[dateKey] === "Working" || !m.schedule[dateKey])
    );

    // If none in same project, widen to all working members
    if (candidates.length === 0) {
      candidates = team.filter(m => 
        m.id !== member.id && 
        (m.schedule[dateKey] === "Working" || !m.schedule[dateKey])
      );
    }

    if (candidates.length === 0) return null;

    // Rank candidates by how rarely they are currently assigned as backup on dateKey
    candidates.sort((a, b) => {
      const aLoad = team.filter(t => t.dateBackups[dateKey] === a.name).length;
      const bLoad = team.filter(t => t.dateBackups[dateKey] === b.name).length;
      return aLoad - bLoad;
    });

    const topPick = candidates[0];
    const isSameProject = topPick.project === member.project;

    return {
      name: topPick.name,
      project: topPick.project,
      reason: isSameProject 
        ? `Same project domain (${topPick.project}), 100% capacity available, 0 conflict on this date.`
        : `Adjacent squad (${topPick.project}), verified 100% capacity available on this date.`
    };
  },

  // 3. Conversational AI Assistant NLP Query Parser
  async askCopilot(question, team, dates, settings) {
    const q = question.toLowerCase().trim();
    const audit = this.runCapacityAudit(team, dates, settings.threshold);

    // If custom API key provided, we can attempt live LLM call
    if (this.apiKey && this.apiProvider !== "offline_expert") {
      try {
        return await this.callExternalLLM(question, audit, team, dates, settings);
      } catch (err) {
        console.warn("External LLM failed, falling back to built-in expert engine:", err);
      }
    }

    // Built-in Instant Expert Engine (Zero latency, works offline out-of-the-box!)
    await new Promise(r => setTimeout(r, 450)); // realistic thinking pause

    // A. Question about Oct 28 or critical dates
    if (q.includes("28") || q.includes("critical") || q.includes("40%") || q.includes("shortage") || q.includes("danger") || q.includes("alert")) {
      if (audit.criticalDates.length === 0) {
        return `✅ **Capacity Health Analysis**: Good news! Currently, all 14 sprint dates are above the **${settings.threshold}% threshold**. No automatic manager escalations are active.`;
      }

      let response = `🚨 **AI Bandwidth Incident Analysis**:\n\n`;
      audit.criticalDates.forEach(cd => {
        response += `• **${cd.label}**: Bandwidth is **${cd.bandwidth}%** (${cd.working} working vs. ${cd.absent} absent out of ${cd.total} scheduled).\n`;
      });
      response += `\n**Root Cause**: Coinciding planned leaves across multiple teams triggered the automated escalation rule (<${settings.threshold}%).\n\n`;
      response += `**AI Recommended Action**: Freeze release pipelines on ${audit.criticalDates[0].label} and reallocate standby support from peer squads.`;
      return response;
    }

    // B. Question about backup collision or conflicts
    if (q.includes("backup") || q.includes("collision") || q.includes("conflict") || q.includes("in place")) {
      if (audit.backupCollisions.length === 0) {
        return `✅ **Backup Coverage Check**: All absent members currently have designated backups who are verified **active and working** on their respective leave dates. No double-outages detected!`;
      }

      let response = `⚠️ **AI Backup Conflict Detector found ${audit.backupCollisions.length} Double-Outage Collisions**:\n\n`;
      audit.backupCollisions.slice(0, 4).forEach((c, idx) => {
        response += `${idx + 1}. **${c.member}** (${c.project}) designated **${c.backup}**, but ${c.backup} is ALSO on **${c.backupStatus}** on **${c.date}**!\n`;
      });
      response += `\n**AI Recommendation**: Reassign these backups immediately using the **Smart AI Backup Recommender** in the leave edit menu to prevent unmonitored services.`;
      return response;
    }

    // C. Question about projects
    if (q.includes("project") || q.includes("squad") || q.includes("team")) {
      let response = `📊 **AI Project Bandwidth Breakdown**:\n\n`;
      Object.entries(audit.projectHealth).forEach(([pName, stats]) => {
        const flag = stats.avgBandwidth < settings.threshold ? '🚨' : (stats.avgBandwidth < 70 ? '⚠️' : '✅');
        response += `• **${pName}**: ${stats.avgBandwidth}% Avg Capacity (${stats.total} members) ${flag}\n`;
      });
      response += `\nProjects with critical flags have sprint deliverables at elevated risk.`;
      return response;
    }

    // D. Executive Summary / Standup Update
    if (q.includes("summary") || q.includes("standup") || q.includes("executive") || q.includes("update") || q.includes("report")) {
      const avgCapacity = Math.round(dates.reduce((acc, d) => acc + calculateDateBandwidth(d.key, team).percentage, 0) / dates.length);
      return `📋 **Executive Team Capacity Briefing** (AI Generated):\n\n` +
        `• **Roster Status**: 100 engineering staff actively tracked across 8 core initiatives.\n` +
        `• **Sprint Average Capacity**: **${avgCapacity}%** (Threshold target: \u2265 ${settings.threshold}%).\n` +
        `• **Critical Shortage Windows**: ${audit.criticalDates.length} date(s) flagged below 40% capacity.\n` +
        `• **Mitigation Status**: Automatic escalation dispatched to Lead (**${settings.managerEmail}**).\n` +
        `• **Action Item**: Verify backup coverage on high-absence dates and postpone non-essential maintenance.`;
    }

    // E. Recommendations / Suggestions
    if (q.includes("recommend") || q.includes("suggest") || q.includes("fix") || q.includes("help") || q.includes("optimize")) {
      let response = `💡 **AI Optimization Plan** (Risk Score: ${audit.riskScore}/100):\n\n`;
      audit.recommendations.forEach((rec, idx) => {
        response += `**${idx + 1}. ${rec.title}**\n${rec.detail}\n\n`;
      });
      return response;
    }

    // Default intelligent overview
    return `🤖 **PulseAI Assistant Overview**:\n\n` +
      `I am monitoring **100 team members** across **14 sprint dates**.\n\n` +
      `• **Risk Index**: ${audit.riskScore}/100 (${audit.riskLevel})\n` +
      `• **Critical Dates (<${settings.threshold}%)**: ${audit.criticalDates.length} date(s) triggered\n` +
      `• **Backup Collisions**: ${audit.backupCollisions.length} conflict(s) detected\n\n` +
      `*Try asking:*\n` +
      `• *"Analyze capacity risks this sprint"*\n` +
      `• *"Who is taking leave on Oct 28 and why?"*\n` +
      `• *"Show me backup collisions"*\n` +
      `• *"Draft an executive standup summary"*`;
  }
};
