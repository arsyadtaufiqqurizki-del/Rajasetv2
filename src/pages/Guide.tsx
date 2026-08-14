import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, BookOpen, Wrench, Archive, Sparkles, LayoutDashboard, ClipboardCheck, Database, BarChart2, Settings } from "lucide-react";
import { cn } from "../lib/utils";

const GUIDE_CONTENT = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: LayoutDashboard,
    content: [
      {
        question: "What is Perusahaan Raja Asset Management?",
        answer: "It's a comprehensive platform to track, manage, and maintain your company's physical assets efficiently. You can monitor lifecycle, schedule maintenance, and generate insightful reports."
      },
      {
        question: "How do I navigate the dashboard?",
        answer: "The dashboard provides a high-level overview of total assets, asset cost, and broken assets, plus charts for subsidiary valuation, category breakdown, and annual purchase trends. Use the sidebar on the left to access every section: Dashboard, Asset Inventory, Maintenance, Reclassification, Master Data, Reports, AI Assistant, and Settings."
      },
      {
        question: "What does the 'Terakhir diperbarui' (last updated) timestamp on the Dashboard mean?",
        answer: "It shows when asset data was last fetched or changed — including every add, edit, delete, or bulk delete you or your teammates perform. It updates automatically after each successful change, so you always know how fresh the numbers are."
      }
    ]
  },
  {
    id: "asset-management",
    title: "Asset Management",
    icon: Archive,
    content: [
      {
        question: "How do I add a new asset?",
        answer: "Click the 'Add New Asset' button in the sidebar or directly from the Inventory page. Fill in the required asset details such as name, category, location, status, and purchase information in the modal."
      },
      {
        question: "How do I update an asset's status?",
        answer: "Navigate to the Asset Inventory page, find the asset you want to update, click the edit icon (pencil), and change its status in the form (e.g., Active, In Maintenance, Retired)."
      },
      {
        question: "Can I search for specific assets?",
        answer: "Yes, use the global search bar at the top of the screen or the specific search input on the Inventory page to find assets by name, serial number, or category."
      },
      {
        question: "How do I import assets from a CSV file?",
        answer: "On the Asset Inventory page, click the 'Import CSV' button located at the top right. Select your CSV file to bulk upload assets. Ensure your CSV file has headers matching the system format (Asset Book, Subsidiary, Asset Number, Asset Description, etc.). Maximum 5000 rows are supported per file."
      },
      {
        question: "How do I export my asset data?",
        answer: "On the Asset Inventory page, apply any desired filters, then click the 'Export CSV' button at the top right. This will download the currently visible assets into a CSV file, which you can use for offline reporting or as a template for future imports. Any cell value that starts with a formula character (=, +, -, @) is automatically sanitized so the file can't be used to inject formulas when opened in Excel."
      }
    ]
  },
  {
    id: "maintenance",
    title: "Maintenance",
    icon: Wrench,
    content: [
      {
        question: "How do I schedule maintenance?",
        answer: "Go to the Maintenance page, click 'Schedule Maintenance', select the corresponding asset from the dropdown, and set the upcoming maintenance date, type, and description."
      },
      {
        question: "How do I track maintenance history?",
        answer: "Each asset maintains a detailed history of all its past maintenance records. You can view this by checking the comprehensive Maintenance list or looking up specific asset details."
      }
    ]
  },
  {
    id: "reclassification",
    title: "Reclassification",
    icon: ClipboardCheck,
    content: [
      {
        question: "What is the Reclassification page for?",
        answer: "It's where you audit assets against Asset Inventory. Click \"Tambah Item\" and pick an existing asset from Inventory by searching its asset number or description — you don't type in its details, those are pulled live from Inventory. You just set the audit classification (Asset, Needs Review, Inventory, or a custom category) and optional remarks."
      },
      {
        question: "Why can't I edit the asset description, category, location, or ownership here?",
        answer: "For items linked to Asset Inventory (shown with a \"Linked\" badge), those fields always mirror the live data from Inventory, so they're read-only here — update the asset itself on the Inventory page instead. Only the classification and remarks belong to the reclassification record. A handful of older rows created before this change are unlinked, shown with a \"Manual\" badge, and remain fully editable."
      },
      {
        question: "How do I verify a reclassification item?",
        answer: "Click the Verified/Unverified badge on a row to open the verification dialog. Confirming it stamps the item with the verification date and the name of the verifying user."
      },
      {
        question: "What does \"Sync from Assets\" do?",
        answer: "It's meant to bulk-link every Inventory asset that doesn't have a reclassification row yet, so you don't have to add them one by one. It's currently marked under maintenance — clicking it just shows a notice instead of running."
      },
      {
        question: "Can I import or export reclassification data?",
        answer: "You can export the current (filtered) list to CSV. CSV import and the downloadable template were removed, since every new item now has to be linked to an existing asset rather than bulk-created from free text."
      },
      {
        question: "How do I delete multiple items at once?",
        answer: "Select the items with the checkboxes, click Bulk Delete, and type \"DELETE\" to confirm. A progress modal shows the deletion status."
      },
      {
        question: "What filters are available?",
        answer: "You can filter by category, verification status, and ownership, or use the search box, alongside stat cards showing Total, Verified, Unverified, and Needs Review counts."
      }
    ]
  },
  {
    id: "master-data",
    title: "Master Data",
    icon: Database,
    content: [
      {
        question: "What is Master Data used for?",
        answer: "It manages the dropdown lists used throughout the app — Subsidiaries, Category Segment 1, and Category Segment 2 — so asset, maintenance, and reclassification forms stay consistent."
      },
      {
        question: "How do I add or remove an entry?",
        answer: "Use the add form above each list to create a new entry. To remove one, hover over an existing entry and click the trash icon that appears."
      }
    ]
  },
  {
    id: "reports",
    title: "Reports",
    icon: BarChart2,
    content: [
      {
        question: "What report types are available?",
        answer: "Asset Valuation Summary, Depreciation Schedule (true straight-line, quarter-aware), and Maintenance Cost Analysis (estimated vs. actual cost)."
      },
      {
        question: "How do I generate a report?",
        answer: "Set your filters (subsidiary/division and date range), then click 'Generate Preview'. This renders a live chart and automatically saves the report to your report history."
      },
      {
        question: "What export formats does Reports support?",
        answer: "PDF and Excel (.xlsx). The PDF includes the chart as an embedded image, a summary and main data table with totals, a separate detail-records page per asset with over-budget or variance rows highlighted in red, page numbers, and a signature block (Prepared by / Reviewed by / Approved by)."
      },
      {
        question: "Are exported files safe from formula injection?",
        answer: "Yes, any cell value starting with =, +, -, or @ is automatically sanitized in both the PDF and Excel exports."
      },
      {
        question: "Can I revisit or delete past reports?",
        answer: "Yes, the Recent Reports table lists your report history with pagination, and each row can be deleted individually."
      }
    ]
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    icon: Sparkles,
    content: [
      {
        question: "How can the AI Assistant help me?",
        answer: "Ask it questions about your asset and maintenance data in natural language through the chat interface. Quick-suggestion chips are provided for common questions to get you started."
      },
      {
        question: "Does the AI Assistant remember our conversation?",
        answer: "Chat history is saved in your browser (up to 21 messages) and the last 10 exchanges are used as context for follow-up questions. Click 'Hapus Chat' to clear the conversation."
      },
      {
        question: "Is my data secure with the AI?",
        answer: "Yes, all data processed by the AI Assistant is handled securely and is only utilized within the context of your company's asset management workspace."
      }
    ]
  },
  {
    id: "settings",
    title: "Settings & Notifications",
    icon: Settings,
    content: [
      {
        question: "What can I change in Settings?",
        answer: "The Profile tab lets you update your name and email (email changes require confirmation). The Security tab lets you change your password by re-entering your current one; Two-Factor Authentication is shown but marked 'Coming soon'. System Configuration (language, timezone, currency, rows per page) and Notifications (alert toggles) are visible but not yet saved permanently — treat them as preview features for now."
      },
      {
        question: "What does the bell icon in the header show?",
        answer: "It combines System Alerts with recent Activity Log entries — CSV imports, asset additions/edits/deletions, bulk deletes, and maintenance updates — with an unread count badge that clears when you open the dropdown."
      }
    ]
  }
];

export default function Guide() {
  const [activeTab, setActiveTab] = useState(GUIDE_CONTENT[0].id);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

  // Auto-open first accordion in the active tab when tab changes
  useEffect(() => {
    setOpenAccordions({
      [`${activeTab}-0`]: true
    });
  }, [activeTab]);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">User Guide</h1>
        <p className="text-on-surface-variant">Learn how to use the asset management system effectively with our comprehensive guide.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Table of Contents (Sidebar) */}
        <div className="w-full md:w-64 shrink-0">
          <div className="sticky top-24 bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
            <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Table of Contents
            </h3>
            <nav className="flex flex-col gap-1">
              {GUIDE_CONTENT.map((section) => {
                const isActive = activeTab === section.id;
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveTab(section.id)}
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {section.title}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
            
            {/* Horizontal Tabs */}
            <div className="flex overflow-x-auto border-b border-outline-variant [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {GUIDE_CONTENT.map((section) => {
                const isActive = activeTab === section.id;
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveTab(section.id)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                      isActive
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {section.title}
                  </button>
                );
              })}
            </div>

            {/* Accordion Content */}
            <div className="p-4 md:p-6 bg-surface-container-lowest">
              {GUIDE_CONTENT.map((section) => (
                <div 
                  key={section.id} 
                  className={cn(
                    "space-y-4 animate-in fade-in duration-300",
                    activeTab === section.id ? "block" : "hidden"
                  )}
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
                      <section.icon className="w-5 h-5 text-primary" />
                      {section.title} FAQ
                    </h2>
                    <p className="text-sm text-on-surface-variant mt-1">
                      Frequently asked questions and guides about {section.title.toLowerCase()}.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {section.content.map((item, index) => {
                      const accordionId = `${section.id}-${index}`;
                      const isOpen = openAccordions[accordionId];
                      
                      return (
                        <div 
                          key={index}
                          className={cn(
                            "border rounded-lg overflow-hidden transition-colors duration-200",
                            isOpen ? "border-primary/30 shadow-sm" : "border-outline-variant"
                          )}
                        >
                          <button
                            onClick={() => toggleAccordion(accordionId)}
                            className={cn(
                              "w-full flex items-center justify-between p-4 text-left transition-colors focus:outline-none",
                              isOpen ? "bg-primary/5" : "bg-surface-container-lowest hover:bg-surface-container-low"
                            )}
                          >
                            <span className={cn(
                              "font-medium",
                              isOpen ? "text-primary" : "text-on-surface"
                            )}>
                              {item.question}
                            </span>
                            {isOpen ? (
                              <ChevronUp className="w-5 h-5 text-primary shrink-0 transition-transform" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-on-surface-variant shrink-0 transition-transform" />
                            )}
                          </button>
                          
                          <div 
                            className={cn(
                              "overflow-hidden transition-all duration-300 ease-in-out",
                              isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                            )}
                          >
                            <div className="p-4 border-t border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant text-sm leading-relaxed">
                              {item.answer}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
