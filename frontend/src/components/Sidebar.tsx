import { LayoutDashboard, Upload, Brain, FileText, Users, Sparkles, Server, Lock } from 'lucide-react';
import type { DoctorProfile } from '../App';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeDoctor: DoctorProfile | null;
}

export default function Sidebar({ activeTab, setActiveTab, activeDoctor }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'upload', label: 'Upload Scan', icon: <Upload className="h-4 w-4" /> },
    { id: 'predictions', label: 'AI Predictions', icon: <Brain className="h-4 w-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="h-4 w-4" /> },
    { id: 'patients', label: 'Patients', icon: <Users className="h-4 w-4" /> },
    { id: 'advanced', label: 'Advanced Features', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'nodes', label: 'Federated Nodes', icon: <Server className="h-4 w-4" /> },
  ];

  return (
    <aside className="fixed top-14 left-0 bottom-0 w-64 z-20 bg-[#07080b]/90 border-r border-white/[0.04] flex flex-col justify-between py-6 transition-all duration-300">
      {/* Menu Options */}
      <div className="space-y-1.5 px-4">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          const isLocked = !activeDoctor && item.id !== 'nodes';

          return (
            <button
              key={item.id}
              onClick={() => {
                if (!isLocked) {
                  setActiveTab(item.id);
                }
              }}
              disabled={isLocked}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded text-xs transition-all duration-200 focus:outline-none ${
                isLocked
                  ? 'text-gray-600 cursor-not-allowed opacity-40 hover:bg-transparent'
                  : isActive 
                    ? 'text-white font-semibold bg-white/[0.03] border-l border-clinicalCyan' 
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.01]'
              }`}
            >
              <span className={`transition-colors duration-200 ${
                isLocked 
                  ? 'text-gray-700' 
                  : isActive 
                    ? 'text-clinicalCyan' 
                    : 'text-gray-500'
              }`}>
                {item.icon}
              </span>
              <span className="tracking-wide flex-1 text-left">{item.label}</span>
              {isLocked && (
                <Lock className="h-3 w-3 text-gray-700 justify-self-end" />
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer */}
      <div className="px-6 border-t border-white/[0.04] pt-5 text-left">
        <span className="text-[9px] font-mono text-gray-600 block uppercase tracking-wider">ONCOSIGHT OS // v6.0</span>
      </div>
    </aside>
  );
}
