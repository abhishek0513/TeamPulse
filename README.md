# Google Staffing & Bandwidth Planner (Internal Engineering Tool)

A lightweight, high-density capacity and leave planning tool built for Google engineering squads (100 staff), featuring automated manager escalation triggers when daily team capacity falls below critical thresholds (< 40%).

---

## 👤 Profiles & Ownership
* **User Profile**: **Abhishek Mishra** (`abhishmishra@google.com`) - Software / AI Engineer
* **Engineering Lead / Manager**: **Abhinav Rawat** (`rawatabhinav@google.com`) - Manager receiving automated capacity alerts

---

## 🌐 Live Access
The tool is currently running on your local server:
👉 **[http://localhost:5000](http://localhost:5000)**

*(Or double-click the standalone offline file [`TeamPulse_Standalone_Demo.html`](file:///C:/Users/Dell/.gemini/antigravity/scratch/team-bandwidth-tracker/TeamPulse_Standalone_Demo.html) in any browser with zero setup).*

---

## 🖥️ Architecture & Design Highlights
1. **Google Material 3 Workspace Theme**: Clean white canvas (`#ffffff`), subtle borders (`#dadce0`), Google Sans typography.
2. **On-Demand Right Drawers**: Zero clutter on screen. Clicking any cell opens the **Attendance & Handover Inspector**.
3. **Gemini Workspace Panel**: Integrated Gemini assistant for natural language capacity analysis, double-outage collision checks, and executive standup summaries.
4. **Automated Escalation Rule**: Any sprint date where available team bandwidth drops below **40%** automatically generates an escalation draft to **Abhinav Rawat** (`rawatabhinav@google.com`).
