import openpyxl, json, os

path = r"c:\Users\Admin\OneDrive - Hanoi University of Science and Technology\Desktop\Web_Cost_Badminton\[Lighter] Costing Badminton.xlsx"
wb = openpyxl.load_workbook(path, data_only=True)

summaries = []

for sheetname in wb.sheetnames:
    if sheetname == "Note":
        continue
    ws = wb[sheetname]
    
    # 1. find members row (look for "Thành viên" or "N.o" in col G)
    members = []
    member_row = None
    for r in range(1, 15):
        val = str(ws.cell(r, 7).value or "")
        if "Thành viên" in val or "Th\u00e0nh vi\u00ean" in val:
            member_row = r
            break
    
    if not member_row:
        # fallback row 4 or row 8
        for r in (8, 4, 7):
            names = []
            for c in range(8, ws.max_column + 1):
                v = ws.cell(r, c).value
                if v and isinstance(v, str) and len(v.strip()) > 0 and not v.startswith("="):
                    names.append(v.strip())
            if len(names) >= 3:
                member_row = r
                members = names
                break
    else:
        for c in range(8, ws.max_column + 1):
            v = ws.cell(member_row, c).value
            if v and isinstance(v, str) and len(v.strip()) > 0:
                members.append(v.strip())
                
    # 2. find Dư nợ row
    debt_balances = {}
    total_debt = 0
    for r in range(1, 26):
        val = str(ws.cell(r, 7).value or "")
        if "Dư nợ" in val or "D\u01b0 n\u1ee3" in val or "Số tiền" in val:
            for idx, m in enumerate(members):
                raw = ws.cell(r, 8 + idx).value
                num = round(float(raw)) if isinstance(raw, (int, float)) else 0
                debt_balances[m] = num
                total_debt += num
            break

    # 3. find expenses
    expenses = []
    for r in range(11, ws.max_row + 1):
        amt_val = ws.cell(r, 3).value # C
        payer_val = ws.cell(r, 4).value # D
        title_val = ws.cell(r, 7).value # G
        if not title_val:
            title_val = ws.cell(r, 5).value # E
            
        if isinstance(amt_val, (int, float)) and amt_val > 0 and title_val and isinstance(title_val, str) and title_val.strip():
            shares = {}
            for idx, m in enumerate(members):
                s_val = ws.cell(r, 8 + idx).value
                if isinstance(s_val, (int, float)):
                    shares[m] = round(float(s_val))
            expenses.append({
                "title": title_val.strip(),
                "amount": round(float(amt_val)),
                "paidBy": str(payer_val or "").strip(),
                "shares": shares
            })

    summaries.append({
        "sheetName": sheetname,
        "members": members,
        "expenses": expenses,
        "debtBalances": debt_balances,
        "totalDebtSum": total_debt
    })

os.makedirs("lib", exist_ok=True)
with open("lib/legacyData.json", "w", encoding="utf-8") as f:
    json.dump(summaries, f, ensure_ascii=False, indent=2)

print(f"Successfully generated lib/legacyData.json with {len(summaries)} sheets.")
