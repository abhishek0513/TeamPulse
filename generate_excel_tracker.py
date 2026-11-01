"""
Generate Team Leave & Bandwidth Tracker (100 Members)
Creates both CSV and Excel-compatible XML Spreadsheet (SpreadsheetML)
Requires no third-party dependencies (works directly with standard Python).
"""

import os
import datetime

FIRST_NAMES = [
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
]

LAST_NAMES = [
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
]

PROJECTS = [
    "E-Commerce Core & Checkout",
    "Payment Gateway & Fraud Shield",
    "Mobile Banking App (iOS/Android)",
    "AI Recommendation Engine",
    "Cloud & DevOps Infrastructure",
    "Identity & Access Management (IAM)",
    "Data Warehouse & Analytics",
    "Customer Support Portal & CRM"
]

LEAVE_REASONS = [
    "Doctor & Health Checkup",
    "Family Function / Wedding",
    "Annual Vacation & Travel",
    "Personal Emergency",
    "Home Maintenance",
    "Parent-Teacher Conference",
    "Certification Exam",
    "Visa & Passport Appointment"
]

def generate_data():
    base_date = datetime.date(2026, 10, 24)
    dates = []
    for i in range(14):
        d = base_date + datetime.timedelta(days=i)
        dates.append({
            "key": d.strftime("%Y-%m-%d"),
            "label": d.strftime("%d-%b"),
            "day": d.strftime("%a"),
            "is_weekend": d.weekday() >= 5
        })

    members = []
    for i in range(100):
        name = f"{FIRST_NAMES[i % len(FIRST_NAMES)]} {LAST_NAMES[i % len(LAST_NAMES)]}"
        proj = PROJECTS[i % len(PROJECTS)]
        backup_name = f"{FIRST_NAMES[(i + 1) % len(FIRST_NAMES)]} {LAST_NAMES[(i + 1) % len(LAST_NAMES)]}"
        
        schedule = {}
        reasons = {}
        
        for date_idx, dt in enumerate(dates):
            is_critical = (dt["key"] == "2026-10-28")
            
            if dt["is_weekend"]:
                schedule[dt["key"]] = "Not Applicable"
            elif is_critical and i < 68: # ~32% bandwidth
                schedule[dt["key"]] = "Planned Leave"
                reasons[dt["key"]] = LEAVE_REASONS[i % len(LEAVE_REASONS)]
            else:
                rand_val = (i * 17 + date_idx * 23) % 100
                if rand_val < 82:
                    schedule[dt["key"]] = "Working"
                elif rand_val < 92:
                    schedule[dt["key"]] = "Planned Leave"
                    reasons[dt["key"]] = LEAVE_REASONS[(i + date_idx) % len(LEAVE_REASONS)]
                elif rand_val < 97:
                    schedule[dt["key"]] = "Half day"
                    reasons[dt["key"]] = "Half-day Doctor Appointment"
                else:
                    schedule[dt["key"]] = "Not Applicable"

        members.append({
            "id": f"MEM-{i+1:03d}",
            "name": name,
            "project": proj,
            "backup": backup_name,
            "default_reason": LEAVE_REASONS[i % len(LEAVE_REASONS)],
            "schedule": schedule,
            "reasons": reasons
        })
    
    return dates, members

def export_csv(dates, members, filepath):
    import csv
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        
        # Headers
        headers = ["ID", "Member Name", "Project Name", "Backup Person", "Reason for Leave"]
        for d in dates:
            headers.append(f"{d['label']} ({d['day']})")
        writer.writerow(headers)
        
        # Rows
        for m in members:
            row = [m["id"], m["name"], m["project"], m["backup"], m["default_reason"]]
            for d in dates:
                row.append(m["schedule"][d["key"]])
            writer.writerow(row)
            
        # Summary Row (Bandwidth)
        summary_row = ["SUMMARY", "BANDWIDTH %", "-", "-", "Alert if < 40%"]
        for d in dates:
            working = sum(1 for m in members if m["schedule"][d["key"]] == "Working")
            half = sum(1 for m in members if m["schedule"][d["key"]] == "Half day")
            leave = sum(1 for m in members if m["schedule"][d["key"]] == "Planned Leave")
            tot = working + half + leave
            pct = round(((working + 0.5 * half) / tot) * 100) if tot > 0 else 100
            alert_tag = " [ALERT <40%]" if pct < 40 else ""
            summary_row.append(f"{pct}%{alert_tag}")
        writer.writerow(summary_row)

def export_excel_xml(dates, members, filepath):
    """Generate Excel 2003 XML Spreadsheet (opens natively in Excel with styles, colors, and formulas)"""
    xml = []
    xml.append('<?xml version="1.0" encoding="UTF-8"?>')
    xml.append('<?mso-application progid="Excel.Sheet"?>')
    xml.append('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"')
    xml.append(' xmlns:o="urn:schemas-microsoft-com:office:office"')
    xml.append(' xmlns:x="urn:schemas-microsoft-com:office:excel"')
    xml.append(' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"')
    xml.append(' xmlns:html="http://www.w3.org/TR/REC-html40">')
    
    # Styles
    xml.append(' <Styles>')
    xml.append('  <Style ss:ID="Default" ss:Name="Normal">')
    xml.append('   <Alignment ss:Vertical="Center"/>')
    xml.append('   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>')
    xml.append('  </Style>')
    
    # Header Style
    xml.append('  <Style ss:ID="Header">')
    xml.append('   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>')
    xml.append('   <Borders>')
    xml.append('    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4B5563"/>')
    xml.append('   </Borders>')
    xml.append('   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>')
    xml.append('   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>')
    xml.append('  </Style>')
    
    # Title Style
    xml.append('  <Style ss:ID="Title">')
    xml.append('   <Font ss:FontName="Calibri" ss:Size="14" ss:Color="#1E293B" ss:Bold="1"/>')
    xml.append('  </Style>')

    # Status: Working (Green)
    xml.append('  <Style ss:ID="Working">')
    xml.append('   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>')
    xml.append('   <Font ss:FontName="Calibri" ss:Color="#065F46" ss:Bold="1"/>')
    xml.append('   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>')
    xml.append('  </Style>')

    # Status: Planned Leave (Red)
    xml.append('  <Style ss:ID="Leave">')
    xml.append('   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>')
    xml.append('   <Font ss:FontName="Calibri" ss:Color="#991B1B" ss:Bold="1"/>')
    xml.append('   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>')
    xml.append('  </Style>')

    # Status: Half Day (Yellow/Amber)
    xml.append('  <Style ss:ID="HalfDay">')
    xml.append('   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>')
    xml.append('   <Font ss:FontName="Calibri" ss:Color="#92400E" ss:Bold="1"/>')
    xml.append('   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>')
    xml.append('  </Style>')

    # Status: Not Applicable (Gray)
    xml.append('  <Style ss:ID="NA">')
    xml.append('   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>')
    xml.append('   <Font ss:FontName="Calibri" ss:Color="#6B7280"/>')
    xml.append('   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>')
    xml.append('  </Style>')

    # Bandwidth OK (Green bold)
    xml.append('  <Style ss:ID="BwOK">')
    xml.append('   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>')
    xml.append('   <Font ss:FontName="Calibri" ss:Color="#065F46" ss:Bold="1" ss:Size="11"/>')
    xml.append('   <Interior ss:Color="#A7F3D0" ss:Pattern="Solid"/>')
    xml.append('  </Style>')

    # Bandwidth Alert <40% (Red bold flashing alert)
    xml.append('  <Style ss:ID="BwAlert">')
    xml.append('   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>')
    xml.append('   <Font ss:FontName="Calibri" ss:Color="#FFFFFF" ss:Bold="1" ss:Size="11"/>')
    xml.append('   <Interior ss:Color="#DC2626" ss:Pattern="Solid"/>')
    xml.append('  </Style>')

    xml.append(' </Styles>')
    
    # Worksheet
    xml.append(' <Worksheet ss:Name="Team Leave &amp; Bandwidth">')
    xml.append('  <Table ss:DefaultRowHeight="20">')
    xml.append('   <Column ss:Width="65"/>')   # ID
    xml.append('   <Column ss:Width="140"/>')  # Name
    xml.append('   <Column ss:Width="190"/>')  # Project
    xml.append('   <Column ss:Width="140"/>')  # Backup
    xml.append('   <Column ss:Width="170"/>')  # Reason
    for _ in dates:
        xml.append('   <Column ss:Width="85"/>')

    # Title rows
    xml.append('   <Row ss:Height="26">')
    xml.append('    <Cell ss:StyleID="Title"><Data ss:Type="String">Team Leave &amp; Bandwidth Capacity Tracker (100 Members)</Data></Cell>')
    xml.append('   </Row>')
    xml.append('   <Row ss:Height="18">')
    xml.append('    <Cell><Data ss:Type="String">Automatic Escalation Rule: Any date where available bandwidth drops below 40% triggers alert to Manager (rawatabhinav@google.com - Abhinav Rawat)</Data></Cell>')
    xml.append('   </Row>')
    xml.append('   <Row ss:Height="10"/>')

    # Header Row
    xml.append('   <Row ss:Height="24">')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">Member ID</Data></Cell>')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">Team Member Name</Data></Cell>')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">Project Name</Data></Cell>')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">Backup Person</Data></Cell>')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">Leave Reason / Notes</Data></Cell>')
    for d in dates:
        xml.append(f'    <Cell ss:StyleID="Header"><Data ss:Type="String">{d["label"]}&#10;({d["day"]})</Data></Cell>')
    xml.append('   </Row>')

    # Data Rows
    start_row = 5
    for idx, m in enumerate(members):
        xml.append('   <Row>')
        xml.append(f'    <Cell><Data ss:Type="String">{m["id"]}</Data></Cell>')
        xml.append(f'    <Cell><Data ss:Type="String">{m["name"]}</Data></Cell>')
        xml.append(f'    <Cell><Data ss:Type="String">{m["project"]}</Data></Cell>')
        xml.append(f'    <Cell><Data ss:Type="String">{m["backup"]}</Data></Cell>')
        xml.append(f'    <Cell><Data ss:Type="String">{m["default_reason"]}</Data></Cell>')
        for d in dates:
            val = m["schedule"][d["key"]]
            style = "Working"
            if val == "Planned Leave": style = "Leave"
            elif val == "Half day": style = "HalfDay"
            elif val == "Not Applicable": style = "NA"
            xml.append(f'    <Cell ss:StyleID="{style}"><Data ss:Type="String">{val}</Data></Cell>')
        xml.append('   </Row>')
    
    end_row = start_row + len(members) - 1

    # Blank separator
    xml.append('   <Row ss:Height="12"/>')

    # Summary Row: Working Count
    xml.append('   <Row ss:Height="22">')
    xml.append('    <Cell><Data ss:Type="String">SUMMARY</Data></Cell>')
    xml.append('    <Cell><Data ss:Type="String">Full Working Count</Data></Cell>')
    xml.append('    <Cell/><Cell/><Cell/>')
    for d_idx, d in enumerate(dates):
        col_letter = chr(ord('F') + d_idx) if d_idx < 20 else 'Z'
        # Excel formula for countif working
        xml.append(f'    <Cell ss:Formula="=COUNTIF(R{start_row}C:R{end_row}C, &quot;Working&quot;)"><Data ss:Type="Number">0</Data></Cell>')
    xml.append('   </Row>')

    # Summary Row: Half Day Count
    xml.append('   <Row ss:Height="22">')
    xml.append('    <Cell><Data ss:Type="String">SUMMARY</Data></Cell>')
    xml.append('    <Cell><Data ss:Type="String">Half Day Count</Data></Cell>')
    xml.append('    <Cell/><Cell/><Cell/>')
    for d_idx, d in enumerate(dates):
        xml.append(f'    <Cell ss:Formula="=COUNTIF(R{start_row}C:R{end_row}C, &quot;Half day&quot;)"><Data ss:Type="Number">0</Data></Cell>')
    xml.append('   </Row>')

    # Summary Row: Planned Leave Count
    xml.append('   <Row ss:Height="22">')
    xml.append('    <Cell><Data ss:Type="String">SUMMARY</Data></Cell>')
    xml.append('    <Cell><Data ss:Type="String">Planned Leave (Absent)</Data></Cell>')
    xml.append('    <Cell/><Cell/><Cell/>')
    for d_idx, d in enumerate(dates):
        xml.append(f'    <Cell ss:Formula="=COUNTIF(R{start_row}C:R{end_row}C, &quot;Planned Leave&quot;)"><Data ss:Type="Number">0</Data></Cell>')
    xml.append('   </Row>')

    # Summary Row: BANDWIDTH % WITH <40% ALERT
    xml.append('   <Row ss:Height="26">')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">TRIGGER</Data></Cell>')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">BANDWIDTH % CAPACITY</Data></Cell>')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">Target &gt;= 40%</Data></Cell>')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">Auto Lead Alert</Data></Cell>')
    xml.append('    <Cell ss:StyleID="Header"><Data ss:Type="String">&lt; 40% = Escalate</Data></Cell>')
    for d in dates:
        working = sum(1 for m in members if m["schedule"][d["key"]] == "Working")
        half = sum(1 for m in members if m["schedule"][d["key"]] == "Half day")
        leave = sum(1 for m in members if m["schedule"][d["key"]] == "Planned Leave")
        tot = working + half + leave
        pct = round(((working + 0.5 * half) / tot) * 100) if tot > 0 else 100
        style = "BwAlert" if pct < 40 else "BwOK"
        alert_str = " (🚨 ALERT <40%)" if pct < 40 else ""
        xml.append(f'    <Cell ss:StyleID="{style}"><Data ss:Type="String">{pct}%{alert_str}</Data></Cell>')
    xml.append('   </Row>')

    xml.append('  </Table>')
    xml.append(' </Worksheet>')
    xml.append('</Workbook>')

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(xml))

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dates, members = generate_data()
    
    csv_path = os.path.join(script_dir, "Team_Bandwidth_Tracker_100_Members.csv")
    xml_path = os.path.join(script_dir, "Team_Bandwidth_Tracker_100_Members.xls")
    
    export_csv(dates, members, csv_path)
    export_excel_xml(dates, members, xml_path)
    
    print(f"[SUCCESS] Generated CSV: {csv_path}")
    print(f"[SUCCESS] Generated Excel Spreadsheet: {xml_path}")
    print(f"   Total members: {len(members)}")
    print(f"   Dates generated: {len(dates)}")
