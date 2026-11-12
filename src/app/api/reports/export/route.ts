import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
import { countAttendanceDaysByPerson } from '@/lib/attendance-days';
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
    doc.fontSize(18).text('SPARKLAB Attendance Report'); doc.moveDown(); doc.fontSize(8);
    doc.text('Name | Username | Category | Department | Days Attended | Date | Time | Status | Session'); doc.moveDown(0.5);
    rows.forEach(r => doc.text(`${r.Name} | ${r.Username} | ${r.Category} | ${r.Department} | ${r['Days Attended']} | ${r.Date} | ${r.Time} | ${r.Status} | ${r.Session}`, { width: 770 }));
    doc.end(); const buffer = await done;
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="sparklab-attendance.pdf"' } });
  }
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Attendance');
  sheet.columns = Object.keys(rows[0] || { Name: '', Username: '', Category: '', Department: '', 'Days Attended': 0, Date: '', Time: '', Status: '', Session: '' }).map(key => ({ header: key, key, width: key === 'Department' ? 24 : 18 }));
  sheet.addRows(rows); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="sparklab-attendance.xlsx"' } });
}
