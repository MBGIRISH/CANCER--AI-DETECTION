import { motion } from 'framer-motion';
import { Upload, BarChart2 } from 'lucide-react';

interface HeroProps {
  setActiveTab: (tab: string) => void;
}

export default function Hero({ setActiveTab }: HeroProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-16 text-center overflow-hidden">
      {/* Background Holographic Glows */}
      <div className="absolute top-1/3 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-[#00d2ff] to-[#b500ff] opacity-15 blur-[80px]" />
      
      {/* AI Pulse Status Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00d2ff]/20 bg-[#00d2ff]/5 px-4 py-1.5 text-xs tracking-widest text-[#00d2ff] font-futuristic uppercase shadow-[0_0_15px_rgba(0,210,255,0.05)]"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00d2ff] opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00d2ff]"></span>
        </span>
        SYSTEM DIAGNOSTICS ACTIVE
      </motion.div>

      {/* Main Hero Header */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="font-futuristic max-w-4xl text-4xl font-black uppercase tracking-tight text-white sm:text-6xl lg:text-7xl"
      >
        AI-POWERED <br />
        <span className="bg-gradient-to-r from-[#00d2ff] via-white to-[#b500ff] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,210,255,0.2)]">
          EARLY CANCER DETECTION
        </span>
      </motion.h1>

      {/* Subtitle description */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base md:text-lg"
      >
        Advanced AI-assisted medical imaging platform for early cancer risk analysis using MRI, CT and X-ray scans. 
        Empowering doctors with intelligent diagnostics, automated reporting and faster clinical decision-making.
      </motion.p>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
      >
        {/* Upload Scan Button */}
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(0, 210, 255, 0.4)' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('upload')}
          className="group relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00d2ff] to-[#b500ff] p-[1.5px] font-futuristic text-xs uppercase tracking-wider text-white shadow-[0_0_15px_rgba(0,210,255,0.15)] transition-all duration-300"
        >
          <div className="flex items-center gap-2 rounded-[11px] bg-black px-6 py-4 transition-colors duration-300 group-hover:bg-transparent">
            <Upload className="h-4 w-4 text-[#00d2ff] group-hover:text-white" />
            <span>Upload Scan</span>
          </div>
        </motion.button>

        {/* View Dashboard Button */}
        <motion.button
          whileHover={{ scale: 1.05, border: '1px solid rgba(181, 0, 255, 0.5)', boxShadow: '0 0 20px rgba(181, 0, 255, 0.3)' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-4 font-futuristic text-xs uppercase tracking-wider text-white transition-all duration-300"
        >
          <BarChart2 className="h-4 w-4 text-[#b500ff]" />
          <span>View Dashboard</span>
        </motion.button>
      </motion.div>

      {/* Cybernetic HUD elements */}
      <div className="absolute bottom-10 left-10 hidden flex-col items-start gap-1 font-mono text-[10px] text-gray-500 md:flex">
        <div>CORE.SEC_PORT // 443</div>
        <div>SYS_LATENCY // 0.04ms</div>
        <div>ALGORITHM_REV // 4.9.1</div>
      </div>

      <div className="absolute bottom-10 right-10 hidden flex-col items-end gap-1 font-mono text-[10px] text-gray-500 md:flex">
        <div>COORDINATE_MAP // GRID_8</div>
        <div className="text-[#00d2ff]">NEURAL_SYNC // STABLE</div>
        <div>ENCRYPT_KEY // AES_256</div>
      </div>
    </div>
  );
}
