import { join } from 'node:path';
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
import { countAttendanceDaysByPerson } from '@/lib/attendance-days';

const reportLogoPath = join(process.cwd(), 'public', 'sparklab-logo.png');
const brandName = 'SPARKLAB CREATIVITY AND INNOVATION HUB';

export async function GET(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const format = new URL(request.url).searchParams.get('format') || 'xlsx';
  const records = await prisma.attendance.findMany({ include: { person: true, session: true }, orderBy: { checkedAt: 'desc' }, take: 10000 });
  const personIds = [...new Set(records.map(record => record.personId))];
  const checkins = personIds.length
    ? await prisma.attendance.findMany({ where: { personId: { in: personIds } }, select: { personId: true, checkedAt: true } })
    : [];
  const daysByPerson = countAttendanceDaysByPerson(checkins);
  const rows = records.map(r => ({ Name: r.person.fullName, Username: r.person.username ?? '', Category: r.person.category, Department: r.person.department, 'Days Attended': daysByPerson.get(r.personId) ?? 0, Date: r.checkedAt.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }), Time: r.checkedAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }), Status: 'Present', Session: r.session.title }));
  if (format === 'pdf') {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 }); const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));
    doc.image(reportLogoPath, 30, 18, { fit: [130, 88] });
    doc.fillColor('#005088').font('Helvetica-Bold').fontSize(13).text(brandName, 175, 34, { width: 630 });
    doc.fillColor('#7A4C00').fontSize(11).text('Attendance report', 175, 56);
    doc.moveTo(30, 92).lineTo(811, 92).lineWidth(2).strokeColor('#F8B040').stroke();
    doc.fillColor('#003F68').fontSize(8).text('Name | Username | Category | Department | Days Attended | Date | Time | Status | Session', 30, 104);
    doc.moveDown(0.5).fillColor('#17364B').font('Helvetica').fontSize(8);
    rows.forEach(r => doc.text(`${r.Name} | ${r.Username} | ${r.Category} | ${r.Department} | ${r['Days Attended']} | ${r.Date} | ${r.Time} | ${r.Status} | ${r.Session}`, { width: 770 }));
    doc.end(); const buffer = await done;
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="sparklab-attendance.pdf"' } });
  }
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Attendance');
  workbook.creator = brandName;
  const headers = Object.keys(rows[0] || { Name: '', Username: '', Category: '', Department: '', 'Days Attended': 0, Date: '', Time: '', Status: '', Session: '' });
  sheet.columns = headers.map(key => ({ key, width: key === 'Department' ? 24 : 18 }));
  sheet.mergeCells(1, 3, 1, headers.length);
  sheet.getCell(1, 3).value = brandName;
  sheet.mergeCells(2, 3, 2, headers.length);
  sheet.getCell(2, 3).value = 'Attendance report';
  sheet.addRow([]);
  sheet.addRow(headers);
  sheet.addRows(rows);
  const logoId = workbook.addImage({ filename: reportLogoPath, extension: 'png' });
  sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 128, height: 94 } });
  sheet.getRow(1).height = 36;
  sheet.getRow(2).height = 30;
  sheet.getRow(3).height = 24;
  sheet.getRow(1).getCell(3).font = { bold: true, size: 15, color: { argb: 'FF005088' } };
  sheet.getRow(2).getCell(3).font = { bold: true, size: 12, color: { argb: 'FF7A4C00' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D8' } };
  sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D8' } };
  sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005088' } };
  sheet.getRow(4).border = { bottom: { style: 'medium', color: { argb: 'FFF8B040' } } };
  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="sparklab-attendance.xlsx"' } });
}
