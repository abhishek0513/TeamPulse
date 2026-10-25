// Seed data and team generator for TeamPulse Bandwidth Tracker (100 members)

const FIRST_NAMES = [
  "Aarav", "Priya", "Michael", "Sarah", "David", "Fatima", "Carlos", "Emily", "Rohan", "Ananya",
  "James", "Elena", "Liam", "Sophia", "Daniel", "Meera", "Alexander", "Zainab", "Lucas", "Olivia",
  "Vikram", "Chloe", "Benjamin", "Aaliyah", "William", "Jessica", "Noah", "Zara", "Ethan", "Nandini",
  "Henry", "Maya", "Sebastian", "Layla", "Matthew", "Tara", "Samuel", "Kavya", "Jackson", "Noor",
  "Aditya", "Amara", "Gabriel", "Sana", "Carter", "Ishaan", "Luke", "Simran", "Anthony", "Diya",
  "Arjun", "Neha", "Mason", "Grace", "Oliver", "Tanvi", "Elijah", "Riya", "Jack", "Pooja",
  "Aryan", "Sneha", "Leo", "Avani", "Theodore", "Mira", "Thomas", "Deepika", "Logan", "Shreya",
  "Harsh", "Shruti", "Julian", "Swati", "Jayden", "Bhavna", "Ryan", "Archana", "Nathan", "Geeta",
  "Varun", "Pallavi", "Caleb", "Meenakshi", "Christian", "Divya", "Hunter", "Kalyani", "Eli", "Radhika",
  "Karan", "Komal", "Landon", "Bhumika", "Connor", "Richa", "Jonathan", "Payal", "Aaron", "Sunita"
];

const LAST_NAMES = [
  "Sharma", "Patel", "Chen", "Jenkins", "Kim", "Zahra", "Rodriguez", "Watson", "Gupta", "Singh",
  "Johnson", "Petrova", "Smith", "Miller", "Taylor", "Verma", "Ivanov", "Khan", "Martin", "Brown",
  "Nair", "Anderson", "Davis", "Al-Mansoor", "Wilson", "Martinez", "Moore", "Siddiqui", "Taylor", "Iyer",
  "Thomas", "Rao", "Hernandez", "Malik", "Clark", "Deshmukh", "Lewis", "Chopra", "Robinson", "Qureshi",
  "Mishra", "Ali", "Walker", "Bano", "Hall", "Bose", "Allen", "Kaur", "Young", "Bhatt",
  "Reddy", "Ghosh", "Wright", "King", "Lopez", "Joshi", "Hill", "Mehta", "Scott", "Saxena",
  "Kapoor", "Banerjee", "Green", "Adams", "Baker", "Trivedi", "Gonzalez", "Agarwal", "Nelson", "Mukherjee",
  "Pandey", "Chatterjee", "Mitchell", "Pillai", "Perez", "Das", "Roberts", "Chawla", "Turner", "Menon",
  "Thakur", "Dutta", "Phillips", "Nambiar", "Campbell", "Mahajan", "Parker", "Garg", "Evans", "Shukla",
  "Malhotra", "Biswas", "Edwards", "Tandon", "Collins", "Lal", "Stewart", "Somani", "Sanchez", "Dube"
];

const PROJECTS = [
  "E-Commerce Core & Checkout",
  "Payment Gateway & Fraud Shield",
  "Mobile Banking App (iOS/Android)",
  "AI Recommendation Engine",
  "Cloud & DevOps Infrastructure",
  "Identity & Access Management (IAM)",
  "Data Warehouse & Analytics",
  "Customer Support Portal & CRM"
];

const LEAVE_REASONS = [
  "Doctor & Health Checkup",
  "Family Function / Wedding",
  "Annual Vacation & Travel",
  "Personal Emergency",
  "Home Relocation & Maintenance",
  "Parent-Teacher Conference",
  "Certification Exam",
  "Visa & Passport Appointment"
];

// Generate dates for current window (15 days starting from Oct 24, 2026)
function generateDateRange(startDateStr = "2026-10-24", daysCount = 14) {
  const dates = [];
  const start = new Date(startDateStr);
  
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateKey = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = d.getDate();
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    
    dates.push({
      key: dateKey,
      label: `${dayNumber} ${monthName}`,
      fullDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dayName: dayName,
      isWeekend: isWeekend
    });
  }
  return dates;
}

// Generate 100 realistic members
function generateInitialTeam(dates) {
  const team = [];
  const fullNames = [];
  
  for (let i = 0; i < 100; i++) {
    fullNames.push(`${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`);
  }

  for (let i = 0; i < 100; i++) {
    const id = `MEM-${String(i + 1).padStart(3, '0')}`;
    const name = fullNames[i];
    const project = PROJECTS[i % PROJECTS.length];
    // Assign a peer from same or adjacent project as default backup
    const backupIndex = (i + 1) % 100;
    const backupName = fullNames[backupIndex];
    
    // Status per date
    const schedule = {};
    const leaveReasons = {};
    const dateBackups = {};

    dates.forEach((dt, dateIdx) => {
      // Intentional low-bandwidth test dates: Oct 28 (dateIdx 4) and Oct 31 (dateIdx 7)
      // On Oct 28, ~68 members take leave (bringing bandwidth down to ~32%, below 40% threshold)
      const isCriticalDate1 = (dt.key === "2026-10-28"); // Wednesday
      const isCriticalDate2 = (dt.key === "2026-10-31"); // Saturday / Sprint end

      if (dt.isWeekend && !isCriticalDate2) {
        // Weekends default to Not Applicable
        schedule[dt.key] = "Not Applicable";
      } else if (isCriticalDate1 && i < 68) {
        // 68 people on leave on Oct 28
        schedule[dt.key] = "Planned Leave";
        leaveReasons[dt.key] = LEAVE_REASONS[i % LEAVE_REASONS.length];
        dateBackups[dt.key] = backupName;
      } else if (isCriticalDate2 && i < 62) {
        // 62 people on leave
        schedule[dt.key] = "Planned Leave";
        leaveReasons[dt.key] = "Team Offsite / Comp-Off";
        dateBackups[dt.key] = backupName;
      } else {
        // Normal distribution: ~85% Working, ~8% Planned Leave, ~5% Half day, ~2% NA
        const rand = (i * 17 + dateIdx * 23) % 100;
        if (rand < 82) {
          schedule[dt.key] = "Working";
        } else if (rand < 92) {
          schedule[dt.key] = "Planned Leave";
          leaveReasons[dt.key] = LEAVE_REASONS[(i + dateIdx) % LEAVE_REASONS.length];
          dateBackups[dt.key] = backupName;
        } else if (rand < 97) {
          schedule[dt.key] = "Half day";
          leaveReasons[dt.key] = "Half-day Doctor visit / Personal errand";
          dateBackups[dt.key] = backupName;
        } else {
          schedule[dt.key] = "Not Applicable";
        }
      }
    });

    team.push({
      id: id,
      name: name,
      project: project,
      defaultBackup: backupName,
      defaultReason: LEAVE_REASONS[i % LEAVE_REASONS.length],
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`,
      schedule: schedule,
      leaveReasons: leaveReasons,
      dateBackups: dateBackups
    });
  }

  return team;
}
