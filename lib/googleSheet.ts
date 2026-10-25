/**
 * Helper to sync session data to Google Sheet via Google Apps Script Webhook
 */

export interface GoogleSheetSyncPayload {
  date: string;
  sheetName?: string;
  title?: string;
  totalCost: number;
  totalShares: number;
  costPerShare: number;
  expenses: {
    title: string;
    amount: number;
    paidBy: string;
  }[];
  members: {
    name: string;
    weight: number;
    paid: number;
    share: number;
    net: number; // positive = receives, negative = pays
  }[];
  transfers: {
    from: string;
    to: string;
    amount: number;
    note: string;
  }[];
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// CODE GOOGLE APPS SCRIPT CHO GOOGLE SHEET CỦA BẠN
// Mở Google Sheet -> Vào "Tiện ích mở rộng" (Extensions) -> "Apps Script" -> Dán đoạn code này -> Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment) -> Loại: "Ứng dụng web" (Web App) -> Ai có quyền truy cập: "Bất kỳ ai" (Anyone) -> Copy link Webhook!

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Tên tab theo ngày (ví dụ: "Buoi_2510" hoặc "2510")
    var d = new Date(data.date);
    var day = ("0" + d.getDate()).slice(-2);
    var month = ("0" + (d.getMonth() + 1)).slice(-2);
    var sheetName = data.sheetName || (day + month);
    
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }
    
    // 1. TIÊU ĐỀ
    sheet.getRange("A1").setValue("🏸 BUỔI CẦU LÔNG NGÀY " + data.date + (data.title ? " (" + data.title + ")" : ""));
    sheet.getRange("A1:E1").merge().setFontWeight("bold").setFontSize(13).setBackground("#0f766e").setFontColor("#ffffff");
    
    // 2. TỔNG QUAN
    sheet.getRange("A3:B5").setValues([
      ["Tổng chi phí:", data.totalCost],
      ["Tổng số suất:", data.totalShares],
      ["Chi phí / 1 suất:", data.costPerShare]
    ]);
    sheet.getRange("A3:A5").setFontWeight("bold");
    sheet.getRange("B3").setNumberFormat("#,##0\" đ\"");
    sheet.getRange("B5").setNumberFormat("#,##0\" đ\"");
    
    // 3. CÁC KHOẢN CHI TIÊU
    sheet.getRange("A7:C7").setValues([["Khoản chi", "Số tiền", "Người ứng tiền"]]);
    sheet.getRange("A7:C7").setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
    
    var expRows = data.expenses.map(function(exp) {
      return [exp.title, exp.amount, exp.paidBy];
    });
    if (expRows.length > 0) {
      sheet.getRange(8, 1, expRows.length, 3).setValues(expRows);
      sheet.getRange(8, 2, expRows.length, 1).setNumberFormat("#,##0\" đ\"");
    }
    
    // 4. BẢNG PHÂN CHIA TỪNG NGƯỜI
    var startMemberRow = 8 + Math.max(expRows.length, 1) + 2;
    sheet.getRange(startMemberRow, 1, 1, 5).setValues([["Thành viên", "Số suất", "Đã ứng trước", "Phần chia", "Chênh lệch (Net)"]]);
    sheet.getRange(startMemberRow, 1, 1, 5).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    
    var memberRows = data.members.map(function(m) {
      return [m.name, m.weight, m.paid, m.share, m.net];
    });
    if (memberRows.length > 0) {
      sheet.getRange(startMemberRow + 1, 1, memberRows.length, 5).setValues(memberRows);
      sheet.getRange(startMemberRow + 1, 3, memberRows.length, 3).setNumberFormat("#,##0\" đ\"");
    }
    
    // 5. BẢNG AI CHUYỂN CHO AI (THANH TOÁN)
    var startTransferRow = startMemberRow + memberRows.length + 3;
    sheet.getRange(startTransferRow, 1, 1, 4).setValues([["Người chuyển", "Người nhận", "Số tiền cần chuyển", "Nội dung CK"]]);
    sheet.getRange(startTransferRow, 1, 1, 4).setFontWeight("bold").setBackground("#ca8a04").setFontColor("#ffffff");
    
    var transferRows = data.transfers.map(function(t) {
      return [t.from, t.to, t.amount, t.note];
    });
    if (transferRows.length > 0) {
      sheet.getRange(startTransferRow + 1, 1, transferRows.length, 4).setValues(transferRows);
      sheet.getRange(startTransferRow + 1, 3, transferRows.length, 1).setNumberFormat("#,##0\" đ\"");
    }
    
    sheet.autoResizeColumns(1, 6);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      sheetName: sheetName,
      message: "Đã cập nhật thành công tab " + sheetName
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export async function syncSessionToGoogleSheet(webhookUrl: string, payload: GoogleSheetSyncPayload) {
  const response = await fetch('/api/sync-sheet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhookUrl,
      data: payload,
    }),
  });

  const resJson = await response.json();
  if (!response.ok || !resJson.success) {
    throw new Error(resJson.error || 'Lỗi khi gửi dữ liệu sang Google Sheet');
  }

  return resJson.result;
}
