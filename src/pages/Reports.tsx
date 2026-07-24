import React, { useState, useRef } from 'react';
import { ChevronRight, ChevronLeft, Play, Download, Table2, CheckCircle2, Trash2 } from 'lucide-react';
import { useAsset } from '../contexts/AssetContext';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useReport } from '../contexts/ReportContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { cn, monthsBetween, getQuartersInRange } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { logActivity } from '../lib/activityLogger';

export default function Reports() {
  const { assets, subsidiaries } = useAsset();
  const { records } = useMaintenance();
  const { reportHistory, page, totalPages, totalCount, setPage, saveReport, deleteReport } = useReport();
  const chartRef = useRef<HTMLDivElement>(null);

  const [reportType, setReportType] = useState('Asset Valuation Summary');
  const [subsidiary, setSubsidiary] = useState('All Divisions');
  const [dateStart, setDateStart] = useState('2023-01-01');
  const [dateEnd, setDateEnd] = useState('2023-12-31');

  const [previewData, setPreviewData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const generatePreview = async () => {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);

    const filterBySubsidiary = (item: any) => 
      subsidiary === 'All Divisions' ? true : item.subsidiary === subsidiary;

    let generated: any = null;

    if (reportType === 'Asset Valuation Summary') {
      const filteredAssets = assets.filter(filterBySubsidiary).filter(a => {
        if (!a.datePlaceInService) return true;
        const d = new Date(a.datePlaceInService);
        return d >= start && d <= end;
      });

      const grouped = filteredAssets.reduce((acc: any, asset) => {
        const cat = asset.categorySegment1 || 'Uncategorized';
        const cost = parseFloat(asset.assetCost.replace(/[^0-9.-]+/g,"")) || 0;
        acc[cat] = (acc[cat] || 0) + cost;
        return acc;
      }, {});

      const totalValue = Object.values(grouped).reduce((sum: number, v: any) => sum + v, 0);

      generated = {
        type: 'bar',
        title: 'Asset Valuation by Category',
        data: Object.keys(grouped).map(k => ({ name: k, value: grouped[k] })),
        dataKey: 'value',
        color: '#3b82f6',
        yAxisFormatter: (val: number) => {
          if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
          if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
          return `$${val}`;
        },
        summary: [
          { label: 'Total Asset Value', value: formatCurrency(totalValue) },
          { label: 'Total Assets', value: filteredAssets.length.toLocaleString() },
          { label: 'Categories', value: Object.keys(grouped).length.toLocaleString() },
          { label: 'Avg Value / Asset', value: formatCurrency(filteredAssets.length ? totalValue / filteredAssets.length : 0) },
        ],
        detailColumns: [
          { key: 'assetNumber', label: 'Asset Number' },
          { key: 'description', label: 'Description' },
          { key: 'category', label: 'Category' },
          { key: 'subsidiary', label: 'Subsidiary' },
          { key: 'acquisitionDate', label: 'Acquisition Date' },
          { key: 'cost', label: 'Cost', currency: true },
        ],
        detailData: filteredAssets.map(a => ({
          assetNumber: a.assetNumber,
          description: a.assetDescription,
          category: a.categorySegment1 || 'Uncategorized',
          subsidiary: a.subsidiary,
          acquisitionDate: a.datePlaceInService || '-',
          cost: parseFloat(a.assetCost.replace(/[^0-9.-]+/g,"")) || 0,
        })),
      };
    } else if (reportType === 'Depreciation Schedule') {
      const filteredAssets = assets.filter(filterBySubsidiary);

      const quarters = getQuartersInRange(start, end);

      const data = quarters.map(q => {
        const totalValue = filteredAssets.reduce((sum, a) => {
          const cost = parseFloat(a.assetCost.replace(/[^0-9.-]+/g,"")) || 0;
          const life = parseInt(a.lifeInMonths) || 60;
          const placedInService = a.datePlaceInService ? new Date(a.datePlaceInService) : null;
          if (!placedInService) return sum + cost;
          const ageMonths = monthsBetween(placedInService, q.endDate);
          const remaining = life > 0 ? Math.max(0, cost * (1 - Math.min(ageMonths, life) / life)) : 0;
          return sum + remaining;
        }, 0);
        return { name: q.label, value: totalValue };
      });

      const totalOriginalCost = filteredAssets.reduce((sum, a) => sum + (parseFloat(a.assetCost.replace(/[^0-9.-]+/g,"")) || 0), 0);
      const netBookValue = data.length ? data[data.length - 1].value : totalOriginalCost;

      generated = {
        type: 'line',
        title: 'Depreciated Value Over Year',
        data: data,
        dataKey: 'value',
        color: '#8b5cf6',
        yAxisFormatter: (val: number) => {
          if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
          if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
          return `$${val}`;
        },
        summary: [
          { label: 'Total Original Cost', value: formatCurrency(totalOriginalCost) },
          { label: `Net Book Value (${quarters[quarters.length - 1]?.label ?? 'End'})`, value: formatCurrency(netBookValue) },
          { label: 'Total Depreciation', value: formatCurrency(totalOriginalCost - netBookValue) },
          { label: 'Total Assets', value: filteredAssets.length.toLocaleString() },
        ],
        detailColumns: [
          { key: 'assetNumber', label: 'Asset Number' },
          { key: 'description', label: 'Description' },
          { key: 'cost', label: 'Cost', currency: true },
          { key: 'accumulatedDepreciation', label: 'Accumulated Depreciation', currency: true },
          { key: 'netBookValue', label: 'Net Book Value', currency: true },
          { key: 'remainingLifeMonths', label: 'Remaining Life (Months)' },
        ],
        detailData: filteredAssets.map(a => {
          const cost = parseFloat(a.assetCost.replace(/[^0-9.-]+/g,"")) || 0;
          const life = parseInt(a.lifeInMonths) || 60;
          const placedInService = a.datePlaceInService ? new Date(a.datePlaceInService) : null;
          const ageMonths = placedInService ? monthsBetween(placedInService, end) : 0;
          const netBookValueAtEnd = placedInService ? Math.max(0, cost * (1 - Math.min(ageMonths, life) / life)) : cost;
          return {
            assetNumber: a.assetNumber,
            description: a.assetDescription,
            cost,
            accumulatedDepreciation: cost - netBookValueAtEnd,
            netBookValue: netBookValueAtEnd,
            remainingLifeMonths: Math.max(0, life - Math.min(ageMonths, life)),
          };
        }),
      };
    } else if (reportType === 'Maintenance Cost Analysis') {
      const filteredRecords = records.filter(filterBySubsidiary).filter(r => {
        if (!r.scheduledDate) return true;
        const d = new Date(r.scheduledDate);
        return d >= start && d <= end;
      });

      const grouped = filteredRecords.reduce((acc: any, record) => {
        const type = record.serviceType || 'General';
        const est = parseFloat(record.estimateCost.replace(/[^0-9.-]+/g,"")) || 0;
        const act = parseFloat(record.actualCost.replace(/[^0-9.-]+/g,"")) || 0;
        
        if (!acc[type]) acc[type] = { name: type, estimated: 0, actual: 0 };
        acc[type].estimated += est;
        acc[type].actual += act;
        return acc;
      }, {});

      const totals = Object.values(grouped).reduce((acc: any, g: any) => {
        acc.estimated += g.estimated;
        acc.actual += g.actual;
        return acc;
      }, { estimated: 0, actual: 0 });

      generated = {
        type: 'composed',
        title: 'Estimated vs Actual Maintenance Costs',
        data: Object.values(grouped),
        yAxisFormatter: (val: number) => {
          if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
          if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
          return `$${val}`;
        },
        summary: [
          { label: 'Total Estimated', value: formatCurrency(totals.estimated) },
          { label: 'Total Actual', value: formatCurrency(totals.actual) },
          { label: 'Variance', value: formatCurrency(totals.actual - totals.estimated) },
          { label: 'Records', value: filteredRecords.length.toLocaleString() },
        ],
        detailColumns: [
          { key: 'assetNumber', label: 'Asset Number' },
          { key: 'description', label: 'Description' },
          { key: 'serviceType', label: 'Service Type' },
          { key: 'scheduledDate', label: 'Scheduled Date' },
          { key: 'estimated', label: 'Estimated Cost', currency: true },
          { key: 'actual', label: 'Actual Cost', currency: true },
          { key: 'variance', label: 'Variance', currency: true },
        ],
        detailData: filteredRecords.map(r => {
          const estimated = parseFloat(r.estimateCost.replace(/[^0-9.-]+/g,"")) || 0;
          const actual = parseFloat(r.actualCost.replace(/[^0-9.-]+/g,"")) || 0;
          return {
            assetNumber: r.assetNumber,
            description: r.assetDescription,
            serviceType: r.serviceType || 'General',
            scheduledDate: r.scheduledDate || '-',
            estimated,
            actual,
            variance: actual - estimated,
          };
        }),
      };
    }

    setPreviewData(generated);

    if (generated) {
      setGenerating(true);
      await saveReport({ reportType, subsidiary, dateStart, dateEnd, reportData: generated });
      setGenerating(false);
    }
  };

  const handleDeleteReport = (id: string) => {
    if (window.confirm('Are you sure you want to delete this report?')) {
      deleteReport(id);
    }
  };

  const exportFileName = () => `${reportType.replace(/\s+/g, '_')}_${dateStart}_to_${dateEnd}`;

  const sanitizeForSpreadsheet = (value: unknown): unknown => {
    if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
      return `'${value}`;
    }
    return value;
  };

  const handleExportPDF = async () => {
    if (!previewData || !previewData.data.length) return;

    const headers = Object.keys(previewData.data[0]);
    const numericHeaders = headers.filter(h => typeof previewData.data[0][h] === 'number');

    const formatCell = (header: string, value: unknown) => {
      const sanitized = sanitizeForSpreadsheet(value);
      return numericHeaders.includes(header) && typeof sanitized === 'number'
        ? formatCurrency(sanitized)
        : sanitized;
    };

    const totalsRow = headers.map((header, idx) => {
      if (idx === 0) return 'Total';
      if (!numericHeaders.includes(header)) return '';
      const sum = previewData.data.reduce((s: number, row: any) => s + (Number(row[header]) || 0), 0);
      return formatCurrency(sum);
    });

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(previewData.title, 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${subsidiary} | ${dateStart} - ${dateEnd}`, 14, 23);
    const generatedBy = reportHistory[0]?.userName ?? 'Unknown User';
    doc.text(`Generated by ${generatedBy} on ${new Date().toLocaleString()}`, 14, 28);

    const summary: { label: string; value: string }[] = previewData.summary ?? [];
    let cursorY = 34;
    if (summary.length) {
      const boxWidth = 45;
      const boxGap = 3;
      const summaryY = 40;
      summary.forEach((item, idx) => {
        const x = 14 + idx * (boxWidth + boxGap);
        doc.setFontSize(7.5);
        doc.setTextColor(120);
        doc.text(item.label, x, summaryY);
        doc.setFontSize(11);
        doc.setTextColor(30);
        doc.text(item.value, x, summaryY + 6);
      });
      cursorY = 54;
    }

    setExportingPdf(true);
    try {
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
        const imgWidth = 180;
        const imgHeight = (canvas.height / canvas.width) * imgWidth;
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 14, cursorY, imgWidth, imgHeight);
        cursorY += imgHeight + 10;
      }
    } finally {
      setExportingPdf(false);
    }

    autoTable(doc, {
      startY: cursorY,
      head: [headers],
      body: previewData.data.map((row: any) => headers.map(h => formatCell(h, row[h]))),
      foot: [totalsRow],
      footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
    });

    const detailColumns: { key: string; label: string; currency?: boolean }[] = previewData.detailColumns ?? [];
    const detailData: Record<string, unknown>[] = previewData.detailData ?? [];
    if (detailColumns.length && detailData.length) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setTextColor(30);
      doc.text('Detail Records', 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`${detailData.length} record(s)`, 14, 22);

      const varianceColIndex = detailColumns.findIndex(c => c.key === 'variance');

      autoTable(doc, {
        startY: 28,
        head: [detailColumns.map(c => c.label)],
        body: detailData.map(row =>
          detailColumns.map(c => {
            const value = row[c.key];
            return c.currency && typeof value === 'number' ? formatCurrency(value) : String(value ?? '');
          })
        ),
        styles: { fontSize: 8 },
        didParseCell: (data) => {
          if (varianceColIndex === -1 || data.section !== 'body' || data.column.index !== varianceColIndex) return;
          const variance = detailData[data.row.index]?.variance;
          if (typeof variance === 'number' && variance > 0) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
    }

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const approvalBlockHeight = 40;
    let approvalY = ((doc as any).lastAutoTable?.finalY ?? cursorY) + 20;
    if (approvalY + approvalBlockHeight > pageHeight - 15) {
      doc.addPage();
      approvalY = 20;
    }

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('Sign-off', 14, approvalY - 8);

    const marginX = 14;
    const colWidth = (pageWidth - marginX * 2) / 3;
    (['Prepared by', 'Reviewed by', 'Approved by'] as const).forEach((label, idx) => {
      const x = marginX + idx * colWidth;
      doc.setFontSize(9);
      doc.setTextColor(30);
      doc.setFont('helvetica', 'bold');
      doc.text(label, x, approvalY);
      doc.setFont('helvetica', 'normal');

      doc.setDrawColor(150);
      doc.line(x, approvalY + 14, x + colWidth - 12, approvalY + 14);

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('Name: _______________________', x, approvalY + 20);
      doc.text('Date: _______________________', x, approvalY + 26);
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 30,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save(`${exportFileName()}.pdf`);
    logActivity({ actionType: 'EXPORT_REPORT', entityType: 'system', details: { reportType, subsidiary, format: 'PDF' } });
  };

  const handleExportExcel = () => {
    if (!previewData || !previewData.data.length) return;

    const sanitizedData = previewData.data.map((row: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sanitizeForSpreadsheet(value)]))
    );

    const ws = XLSX.utils.json_to_sheet(sanitizedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType.slice(0, 31));
    XLSX.writeFile(wb, `${exportFileName()}.xlsx`);
    logActivity({ actionType: 'EXPORT_REPORT', entityType: 'system', details: { reportType, subsidiary, format: 'Excel' } });
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-on-surface mb-1">Advanced Reporting & Analytics</h2>
        <p className="text-base text-on-surface-variant max-w-2xl">Configure, preview, and export high-fidelity data extracts regarding asset valuation, maintenance cycles, and compliance status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-on-surface border-b border-outline-variant pb-3 mb-5">Report Configuration</h3>
            <form className="flex flex-col gap-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Report Type</label>
                <div className="relative">
                  <select 
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg py-2.5 px-3 appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                  >
                    <option>Asset Valuation Summary</option>
                    <option>Depreciation Schedule</option>
                    <option>Maintenance Cost Analysis</option>
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant rotate-90 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Subsidiary / Division</label>
                <div className="relative">
                  <select 
                    value={subsidiary}
                    onChange={(e) => setSubsidiary(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg py-2.5 px-3 appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                  >
                    <option>All Divisions</option>
                    {subsidiaries.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant rotate-90 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Date Range</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg py-2 px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                  />
                  <span className="text-on-surface-variant">-</span>
                  <input 
                    type="date" 
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg py-2 px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={generatePreview}
                disabled={generating}
                className="mt-2 bg-primary text-on-primary font-medium text-sm py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed w-full flex justify-center items-center gap-2"
              >
                <Play className="h-4 w-4 fill-current" /> {generating ? 'Generating...' : 'Generate Preview'}
              </button>
            </form>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-on-surface mb-4">Export Options</h3>
            <div className="flex flex-col gap-3">
              <button onClick={handleExportPDF} type="button" disabled={!previewData || exportingPdf} className="bg-[#0F172A] text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed w-full flex justify-center items-center gap-2 shadow-sm">
                <Download className="h-4 w-4" /> {exportingPdf ? 'Rendering chart...' : 'Download as PDF'}
              </button>
              <button onClick={handleExportExcel} type="button" disabled={!previewData} className="bg-surface-container-lowest border border-outline text-primary font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full flex justify-center items-center gap-2">
                <Table2 className="h-4 w-4" /> Export to Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>

        {/* Right Side Results */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col items-center">
            <div className="w-full flex justify-between items-center border-b border-outline-variant pb-3 mb-6">
              <h3 className="text-lg font-semibold text-on-surface">
                {previewData ? `Live Preview: ${previewData.title}` : 'Live Preview: Asset Valuation Summary'}
              </h3>
              {previewData && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Sync Complete
                </div>
              )}
            </div>
            
            <div ref={chartRef} className="w-full h-[350px] relative rounded-lg overflow-hidden flex flex-col items-center justify-center bg-white">
               {!previewData ? (
                 <div className="absolute inset-0 bg-surface border border-outline-variant/50 rounded-lg flex flex-col items-center justify-center p-6">
                   <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "16px 16px" }}></div>
                   <span className="text-on-surface-variant text-sm font-medium z-10 bg-surface-container-lowest px-4 py-2 rounded-full border border-outline-variant shadow-sm">Belum ada data untuk ditampilkan</span>
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    {previewData.type === 'bar' ? (
                      <BarChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{fill: '#6b7280', fontSize: 12}} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={previewData.yAxisFormatter} tick={{fill: '#6b7280', fontSize: 12}} tickLine={false} axisLine={false} />
                        <Tooltip 
                          formatter={(value: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
                          cursor={{fill: '#f3f4f6'}}
                          contentStyle={{borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                        />
                        <Bar dataKey={previewData.dataKey} fill={previewData.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : previewData.type === 'line' ? (
                      <LineChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{fill: '#6b7280', fontSize: 12}} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={previewData.yAxisFormatter} tick={{fill: '#6b7280', fontSize: 12}} tickLine={false} axisLine={false} />
                        <Tooltip 
                          formatter={(value: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
                          contentStyle={{borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                        />
                        <Line type="monotone" dataKey={previewData.dataKey} stroke={previewData.color} strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                      </LineChart>
                    ) : (
                      <BarChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{fill: '#6b7280', fontSize: 12}} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={previewData.yAxisFormatter} tick={{fill: '#6b7280', fontSize: 12}} tickLine={false} axisLine={false} />
                        <Tooltip 
                          formatter={(value: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
                          cursor={{fill: '#f3f4f6'}}
                          contentStyle={{borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                        />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                        <Bar dataKey="estimated" name="Estimated Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name="Actual Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                 </ResponsiveContainer>
               )}
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
              <h3 className="text-lg font-semibold text-on-surface">Recent Reports</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-surface border-b border-outline-variant">
                  <tr>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Report Name</th>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Created By</th>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Date</th>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Status</th>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-outline-variant/40">
                  {reportHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-on-surface-variant">Belum ada report yang dibuat</td>
                    </tr>
                  ) : (
                    reportHistory.map(report => (
                      <tr key={report.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                        <td className="py-3 px-5 font-medium text-on-surface">{report.reportType} - {report.subsidiary}</td>
                        <td className="py-3 px-5 text-on-surface-variant">{report.userName}</td>
                        <td className="py-3 px-5 text-on-surface-variant">{new Date(report.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                            {report.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right">
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-1.5 rounded text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Report"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-outline-variant bg-surface-container flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Showing {reportHistory.length} of {totalCount} reports</span>
              <div className="flex items-center gap-1 text-sm font-medium">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="px-3 py-1 rounded bg-surface-container-high text-on-surface font-semibold text-xs">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

