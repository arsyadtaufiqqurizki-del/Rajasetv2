import React, { useState } from 'react';
import { ChevronRight, Play, Download, Table2, CheckCircle2 } from 'lucide-react';
import { useAsset } from '../contexts/AssetContext';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { cn } from '../lib/utils';

export default function Reports() {
  const { assets, subsidiaries } = useAsset();
  const { records } = useMaintenance();

  const [reportType, setReportType] = useState('Asset Valuation Summary');
  const [subsidiary, setSubsidiary] = useState('All Divisions');
  const [dateStart, setDateStart] = useState('2023-01-01');
  const [dateEnd, setDateEnd] = useState('2023-12-31');

  const [previewData, setPreviewData] = useState<any>(null);
  const [recentReports, setRecentReports] = useState<any[]>([]);

  const generatePreview = () => {
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
        }
      };
    } else if (reportType === 'Depreciation Schedule') {
      const filteredAssets = assets.filter(filterBySubsidiary);
      
      const data = [
        { name: 'Q1', value: 0 },
        { name: 'Q2', value: 0 },
        { name: 'Q3', value: 0 },
        { name: 'Q4', value: 0 },
      ];
      
      filteredAssets.forEach(a => {
        const cost = parseFloat(a.assetCost.replace(/[^0-9.-]+/g,"")) || 0;
        const life = parseInt(a.lifeInMonths) || 60;
        const depPerQuarter = life > 0 ? (cost / life) * 3 : 0;
        // Simple mock to create a trend
        data[0].value += cost;
        data[1].value += Math.max(0, cost - depPerQuarter);
        data[2].value += Math.max(0, cost - depPerQuarter * 2);
        data[3].value += Math.max(0, cost - depPerQuarter * 3);
      });

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
        }
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

      generated = {
        type: 'composed',
        title: 'Estimated vs Actual Maintenance Costs',
        data: Object.values(grouped),
        yAxisFormatter: (val: number) => {
          if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
          if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
          return `$${val}`;
        }
      };
    }

    setPreviewData(generated);
    
    setRecentReports(prev => [
      {
        id: Math.random().toString(36).substr(2, 6),
        name: `${reportType} - ${subsidiary}`,
        createdBy: 'Current User',
        date: new Date().toLocaleDateString(),
        status: 'Generated'
      },
      ...prev
    ].slice(0, 5));
  };

  const handleExport = (type: string) => {
    alert(`Exporting as ${type} is not yet implemented.`);
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
                className="mt-2 bg-primary text-on-primary font-medium text-sm py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity w-full flex justify-center items-center gap-2"
              >
                <Play className="h-4 w-4 fill-current" /> Generate Preview
              </button>
            </form>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-on-surface mb-4">Export Options</h3>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleExport('PDF')} type="button" className="bg-[#0F172A] text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity w-full flex justify-center items-center gap-2 shadow-sm">
                <Download className="h-4 w-4" /> Download as PDF
              </button>
              <button onClick={() => handleExport('Excel')} type="button" className="bg-surface-container-lowest border border-outline text-primary font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-surface-container-low transition-colors w-full flex justify-center items-center gap-2">
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
            
            <div className="w-full h-[350px] relative rounded-lg overflow-hidden flex flex-col items-center justify-center">
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
              <button className="text-sm font-semibold text-primary hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-surface border-b border-outline-variant">
                  <tr>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Report Name</th>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Created By</th>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Date</th>
                    <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-outline-variant/40">
                  {recentReports.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-on-surface-variant">Belum ada report yang dibuat</td>
                    </tr>
                  ) : (
                    recentReports.map(report => (
                      <tr key={report.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                        <td className="py-3 px-5 font-medium text-on-surface">{report.name}</td>
                        <td className="py-3 px-5 text-on-surface-variant">{report.createdBy}</td>
                        <td className="py-3 px-5 text-on-surface-variant">{report.date}</td>
                        <td className="py-3 px-5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                            {report.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

