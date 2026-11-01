# Google Staffing & Bandwidth Planner (Internal Engineering Tool)

A high-density capacity and leave planning tool built for Google engineering squads (100 staff), featuring automated manager escalation triggers when daily team capacity falls below critical thresholds (< 40%).

---

## 👤 Profiles & Ownership
* **User Profile**: abc - AI / Software Engineer (Member #1)
* **Engineering Lead / Manager**: xyz@yourcompany.com - Manager receiving automated capacity alerts
---

## 🌟 Key Highlights & New Features

### 1. 🌙 Google Dark Mode
- Seamless one-click toggle in the top app bar (`#theme-toggle-btn`).
- Faithful implementation of Google's dark surface palette (`#202124` background, `#292a2d` cards, `#303134` borders, `#8ab4f8` Google Blue accents).
- Automatically persists your theme choice across reloads via `localStorage` and honors system OS dark mode preferences.

### 2. 🎙️ Gemini Live Voice Commander (Unique Multimodal Speech Feature)
- Tap the **"Live Voice"** button in the header (or speak directly with microphone integration).
- Real-time speech recognition (Web Speech API) + synthesized Google voice audio feedback (`window.speechSynthesis`).
- Supports voice commands:
  - *"What is our bandwidth on Oct 28?"* -> Returns real-time capacity and absentee breakdown.
  - *"Who has a backup conflict?"* -> Pinpoints double-outage collisions where both engineer and backup are away.
  - *"Auto-heal the schedule for Oct 28"* -> Executes autonomous rebalancing hands-free!
  - *"Mark ABC on leave on Wednesday"* -> Updates status via natural voice.
  - *"Switch to dark mode"* -> Instantly themes the workspace.

### 3. 🤖 Autonomous Schedule Auto-Healer (Surprise Innovation)
- Available in the **Alerts & Capacity Drawers** and via Voice.
- On critical days where capacity drops below 40% (e.g. Oct 28 at 32% bandwidth):
  - Automatically identifies non-critical floating leaves.
  - Rebalances / staggers 14 leaves to high-capacity days (e.g., Thursday Oct 29 with 85% bandwidth).
  - Resolves double-outage backup collisions by finding available peer engineers in the same project domain.
  - Instantly lifts capacity to **46%** (safely above the 40% escalation limit) with an animated highlight flash.

### 4. 🗂️ Clean Google Internal Engineering Aesthetic
- High-density table with sticky identity columns, sticky date headers, and sticky bandwidth telemetry footer.
- Zero visual clutter: auxiliary details open on-demand in smooth slide-over side drawers:
  - **Attendance & Handover Inspector** (click any cell to inspect backup handover and leave reason)
  - **Gemini Intelligence Side Panel** (chat assistant with Layer 1 deterministic statistics + Layer 2 LLM synthesis)
  - **Manager Alert Dispatcher** (direct Gmail compose link & trigger history )