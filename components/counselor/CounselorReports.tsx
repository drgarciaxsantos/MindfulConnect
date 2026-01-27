
import React, { useState, useEffect } from 'react';
import { User, Appointment, AppointmentStatus } from '../../types';
import { getAppointments } from '../../services/storageService';
import { Download, Users, CheckCircle, Clock, FileText, FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CounselorReportsProps {
  user: User;
}

const CounselorReports: React.FC<CounselorReportsProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const loadData = async () => {
    const all = await getAppointments();
    // Filter only this counselor's appointments
    const mine = all.filter(a => a.counselorId === user.id);
    // Sort by date descending
    mine.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAppointments(mine);
    setLoading(false);
  };

  const downloadCSV = () => {
    const headers = [
      'Appointment ID',
      'Student Name',
      'Student ID',
      'Section',
      'Parent Contact',
      'Date',
      'Time',
      'Reason',
      'Description',
      'Status',
      'Created At'
    ];

    const rows = appointments.map(appt => [
      appt.id,
      `"${appt.studentName}"`, // Quote strings to handle commas
      `"${appt.studentIdNumber || ''}"`,
      `"${appt.section || ''}"`,
      `"${appt.parentPhoneNumber || ''}"`,
      appt.date,
      appt.time,
      `"${appt.reason}"`,
      `"${appt.description.replace(/"/g, '""')}"`, // Escape quotes
      appt.status,
      appt.createdAt
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `counseling_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('MindfulConnect - Counseling Report', 14, 13);

    // Title & Meta info
    doc.setTextColor(51, 65, 85); // Slate 700
    doc.setFontSize(10);
    doc.text(`Counselor: ${user.name}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, 14, 35);
    doc.text(`Total Records: ${appointments.length}`, 14, 40);

    const tableColumn = ["Date", "Time", "Student", "ID", "Reason", "Status"];
    const tableRows: string[][] = [];

    appointments.forEach(appt => {
      const apptData = [
        format(parseISO(appt.date), 'MMM d, yyyy'),
        appt.time,
        appt.studentName,
        appt.studentIdNumber || '-',
        appt.reason,
        appt.status
      ];
      tableRows.push(apptData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { 
        fontSize: 8,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240]
      },
      headStyles: { 
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    doc.save(`counseling_logs_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const stats = {
    total: appointments.length,
    completed: appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length,
    pending: appointments.filter(a => a.status === AppointmentStatus.PENDING).length,
    cancelled: appointments.filter(a => a.status === AppointmentStatus.CANCELLED).length
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading reports...</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reports & Logs</h2>
          <p className="text-slate-500">Overview of your counseling activities and data export.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
          >
            <Download size={18} />
            Export CSV
          </button>
          <button
            onClick={downloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
          >
            <FileDown size={18} />
            Export PDF
          </button>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Students Accommodated</p>
            <p className="text-2xl font-bold text-slate-900">{stats.completed}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Requests</p>
            <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Interactions</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Recent Logs Preview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-semibold text-slate-800">Recent Completed Sessions</h3>
          <span className="text-xs text-slate-500">Showing latest completed logs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Student</th>
                <th className="px-6 py-3 font-medium">Section</th>
                <th className="px-6 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments
                .filter(a => a.status === AppointmentStatus.COMPLETED)
                .slice(0, 5) // Show only top 5 recent
                .map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {format(parseISO(appt.date), 'MMM d, yyyy')} <span className="text-slate-400">at {appt.time}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{appt.studentName}</td>
                    <td className="px-6 py-4 text-slate-500">{appt.section || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {appt.reason}
                      </span>
                    </td>
                  </tr>
                ))}
                {appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      No completed sessions recorded yet.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CounselorReports;
