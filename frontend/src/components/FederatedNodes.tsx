import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, 
  Shield, 
  Key, 
  Wifi, 
  RefreshCw, 
  CheckCircle2, 
  LogOut, 
  Terminal, 
  Lock
} from 'lucide-react';
import type { DoctorProfile, ScanRecord } from '../App';

interface NodeData {
  id: string;
  name: string;
  location: string;
  doctorEmail: string;
  doctorName: string;
  ip: string;
  latency: string;
  accuracy: string;
  protocol: string;
}

const NODES_DATA: NodeData[] = [
  {
    id: '1',
    name: 'Hospital Node Alpha',
    location: 'Boston Medical Center',
    doctorEmail: 'carter@oncosight.ai',
    doctorName: 'Dr. Michael Carter',
    ip: '192.168.42.101',
    latency: '14ms',
    accuracy: '98.8%',
    protocol: 'gRPC / TLS 1.3'
  },
  {
    id: '2',
    name: 'Hospital Node Beta',
    location: 'Stanford Healthcare',
    doctorEmail: 'chen@oncosight.ai',
    doctorName: 'Dr. Sarah Chen',
    ip: '192.168.42.102',
    latency: '22ms',
    accuracy: '97.5%',
    protocol: 'gRPC / TLS 1.3'
  },
  {
    id: '3',
    name: 'Hospital Node Gamma',
    location: 'MD Anderson Cancer Center',
    doctorEmail: 'reynolds@oncosight.ai',
    doctorName: 'Dr. David Reynolds',
    ip: '192.168.42.103',
    latency: '18ms',
    accuracy: '96.9%',
    protocol: 'gRPC / TLS 1.3'
  },
  {
    id: '4',
    name: 'Hospital Node Delta',
    location: 'Mayo Clinic',
    doctorEmail: 'markovic@oncosight.ai',
    doctorName: 'Dr. Elena Markovic',
    ip: '192.168.42.104',
    latency: '29ms',
    accuracy: '98.2%',
    protocol: 'gRPC / TLS 1.3'
  }
];

interface FederatedNodesProps {
  activeDoctor: DoctorProfile | null;
  setActiveDoctor: (doctor: DoctorProfile | null) => void;
  scanHistory: ScanRecord[];
}

export default function FederatedNodes({ activeDoctor, setActiveDoctor, scanHistory }: FederatedNodesProps) {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connStatusStep, setConnStatusStep] = useState<string>('');
  
  // Terminal logs simulation
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  // Automatically select the active doctor's node if connected
  useEffect(() => {
    if (activeDoctor) {
      const activeNode = NODES_DATA.find(n => n.doctorName === activeDoctor.name);
      if (activeNode) {
        setSelectedNode(activeNode);
      }
    } else if (!selectedNode) {
      setSelectedNode(NODES_DATA[0]);
    }
  }, [activeDoctor]);

  const addLog = (msg: string) => {
    setTerminalLogs(prev => [...prev.slice(-15), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    
    setError(null);
    setConnecting(true);
    setTerminalLogs([]);
    
    const steps = [
      'Initializing secure handshake...',
      `Pinging peer node ${selectedNode.ip}...`,
      'Exchanging Diffie-Hellman parameters...',
      'Verifying node signature via HSM...',
      'Exchanging HMAC-SHA256 tokens...',
      'Unlocking secure local data storage...'
    ];

    // Simulate terminal logs during handshake
    for (let i = 0; i < steps.length; i++) {
      setConnStatusStep(steps[i]);
      addLog(steps[i]);
      await new Promise(r => setTimeout(r, 400));
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedNode.doctorEmail,
          password: password
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Authentication failed.');
      }

      const data = await response.json();
      localStorage.setItem('jwt_token', data.token);
      
      const doc: DoctorProfile = {
        id: data.doctor.id,
        name: data.doctor.name,
        role: data.doctor.role,
        department: data.doctor.department,
        avatarLetter: data.doctor.avatarLetter,
      };

      addLog(`Success! Connected to Node: ${selectedNode.name}`);
      addLog(`Session token generated: HS256 JWT`);
      addLog(`Doctor: ${doc.name} (${doc.role})`);
      
      // Delay slightly for visual effect
      await new Promise(r => setTimeout(r, 300));
      
      setActiveDoctor(doc);
      setPassword('');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Connection refused by node peer.';
      setError(errMsg);
      addLog(`ERROR: ${errMsg}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    addLog(`Closing connection to ${selectedNode?.name}...`);
    localStorage.removeItem('jwt_token');
    setActiveDoctor(null);
    setPassword('');
    setError(null);
    addLog('Disconnected safely. Session keys wiped.');
  };

  // Helper: check if a node is currently active
  const isNodeActive = (node: NodeData) => {
    return activeDoctor && activeDoctor.name === node.doctorName;
  };

  // Helper: count local cases for this node in scanHistory
  const getNodeCasesCount = (node: NodeData) => {
    return scanHistory.filter(s => s.reviewingDoctor === node.doctorName).length;
  };

  return (
    <div className="h-full w-full bg-black flex flex-col p-8 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-light tracking-wide text-white flex items-center gap-3">
            <Server className="text-clinicalCyan h-6 w-6" />
            Federated <span className="font-semibold text-clinicalCyan">Nodes</span>
          </h1>
          <p className="text-gray-400 text-xs tracking-wider mt-2 max-w-2xl">
            Secure peer-to-peer network nodes connecting attending physicians to decentralized patient registry and AI models.
          </p>
        </div>

        {activeDoctor && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-emerald-500 uppercase tracking-widest">
              SECURED CONNECTION
            </span>
          </div>
        )}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left Side: Hospital Nodes Grid */}
        <div className="xl:col-span-7 space-y-6">
          <h2 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider">
            Decentralized Node Infrastructure
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {NODES_DATA.map((node) => {
              const isActive = isNodeActive(node);
              const isSelected = selectedNode?.id === node.id;
              const casesCount = getNodeCasesCount(node);

              return (
                <motion.div
                  key={node.id}
                  whileHover={{ y: -2 }}
                  onClick={() => !connecting && setSelectedNode(node)}
                  className={`rounded-xl border p-5 cursor-pointer relative overflow-hidden transition-all duration-300 ${
                    isActive 
                      ? 'border-emerald-500/40 bg-emerald-950/5 shadow-emerald-950/20 shadow-lg' 
                      : isSelected
                        ? 'border-clinicalCyan/50 bg-[#0c0d10]' 
                        : 'border-white/5 bg-[#07080a] hover:border-white/15'
                  }`}
                >
                  {/* Status Indicator */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${isActive ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {isActive ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  {/* Icon & Details */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${
                      isActive 
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' 
                        : isSelected 
                          ? 'border-clinicalCyan/20 bg-clinicalCyan/5 text-clinicalCyan' 
                          : 'border-white/5 bg-white/[0.02] text-gray-400'
                    }`}>
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white tracking-wide">{node.name}</h3>
                      <p className="text-[9px] text-gray-500 font-mono tracking-wider mt-0.5">{node.location}</p>
                    </div>
                  </div>

                  {/* Metadata Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-3.5 border-t border-white/5">
                    <div>
                      <span className="text-[8px] text-gray-500 font-mono uppercase tracking-wider block">Peer Attending</span>
                      <span className="text-[10px] text-gray-300 font-semibold block truncate mt-0.5">{node.doctorName}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 font-mono uppercase tracking-wider block">Local Case Records</span>
                      <span className="text-[10px] text-clinicalCyan font-bold block mt-0.5">{casesCount} scans</span>
                    </div>
                  </div>

                  {/* Footer Stats */}
                  <div className="mt-4 flex items-center justify-between text-[9px] font-mono text-gray-600 border-t border-white/5 pt-3">
                    <span>IP: {node.ip}</span>
                    <span>LATENCY: {node.latency}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Connection Logs Panel */}
          <div className="bg-[#07080a] border border-white/5 rounded-xl p-5 relative overflow-hidden">
            <h3 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-clinicalCyan" />
              Node Connection Console
            </h3>
            <div className="bg-black/50 rounded border border-white/5 p-4 h-36 font-mono text-[9px] text-clinicalCyan/90 space-y-1 overflow-y-auto custom-scrollbar select-text">
              {terminalLogs.length === 0 ? (
                <div className="text-gray-600 italic">Console idle. Awaiting action...</div>
              ) : (
                terminalLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Glassmorphic Connection Form / Active Session Status */}
        <div className="xl:col-span-5">
          <AnimatePresence mode="wait">
            {selectedNode && (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="clinical-panel p-6 relative overflow-hidden"
              >
                {/* Visual Backdrop decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-clinicalCyan/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                {isNodeActive(selectedNode) ? (
                  /* Node is Connected and Active */
                  <div className="space-y-6">
                    <div className="text-center pb-6 border-b border-white/5">
                      <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                        <Wifi className="h-6 w-6 text-emerald-500" />
                      </div>
                      <h3 className="text-md font-bold text-white tracking-wide">
                        Secure Connection Active
                      </h3>
                      <p className="text-[10px] text-gray-400 font-mono tracking-wider mt-1">
                        NODE: {selectedNode.name.toUpperCase()}
                      </p>
                    </div>

                    <div className="space-y-3.5">
                      <h4 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">
                        Connection Security Protocol
                      </h4>
                      
                      {[
                        { label: 'Attending Doctor', value: selectedNode.doctorName },
                        { label: 'Tunnel Encryption', value: 'AES-GCM-256 (PFS)' },
                        { label: 'Verification Key', value: 'HMAC-SHA256 JWT Token', icon: <Key className="h-3 w-3 text-clinicalCyan" /> },
                        { label: 'Peer Protocol', value: selectedNode.protocol, icon: <Shield className="h-3 w-3 text-clinicalCyan" /> },
                        { label: 'Host Node IP', value: selectedNode.ip }
                      ].map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-black/40 border border-white/5 rounded px-3 py-2 text-xs">
                          <span className="text-gray-500 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5">
                            {item.icon}
                            {item.label}
                          </span>
                          <span className="text-white font-mono font-semibold text-[10px]">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <button
                        onClick={handleDisconnect}
                        className="w-full py-3.5 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-black transition-colors duration-200 text-red-500 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect Node
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Node is Disconnected - Connection Form */
                  <form onSubmit={handleConnect} className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                        <Lock className="text-clinicalCyan h-4 w-4" />
                        Connect to {selectedNode.name}
                      </h3>
                      <p className="text-[10px] text-gray-500 font-mono tracking-wider mt-1">
                        AUTHENTICATE SECURE CLINICAL ENDPOINT
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Email (Read-Only) */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                          Doctor ID Email
                        </label>
                        <input
                          type="email"
                          readOnly
                          value={selectedNode.doctorEmail}
                          className="w-full clinical-input bg-white/[0.01] text-gray-400 border-white/5 cursor-default focus:border-white/5"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                          Security Password
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full clinical-input"
                          disabled={connecting}
                        />
                      </div>

                      {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-mono">
                          CONNECTION ERROR: {error}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
                      <button
                        type="submit"
                        disabled={connecting || !password}
                        className={`w-full py-3.5 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 ${
                          connecting
                            ? 'bg-white/5 text-gray-500 border border-white/5 cursor-default'
                            : !password
                              ? 'bg-clinicalCyan/10 text-clinicalCyan/50 border border-clinicalCyan/10 cursor-not-allowed'
                              : 'bg-clinicalCyan hover:bg-[#00c0eb] text-black shadow-lg shadow-clinicalCyan/10'
                        }`}
                      >
                        {connecting ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin text-clinicalCyan" />
                            {connStatusStep}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Establish Connection
                          </>
                        )}
                      </button>

                      <div className="text-[8px] font-mono text-gray-500 text-center uppercase tracking-wider leading-relaxed">
                        Authorized medical staff only. All connection attempts, including IP log, are securely signed and audited.
                      </div>
                    </div>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
