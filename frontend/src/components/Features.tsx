import React from 'react';
import { motion } from 'framer-motion';
import { Image, Brain, FileText, LayoutDashboard, Clock } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  glowColor: 'blue' | 'purple';
  index: number;
}

function FeatureCard({ icon, title, description, glowColor, index }: FeatureCardProps) {
  const borderClass = glowColor === 'blue' ? 'neon-border-blue' : 'neon-border-purple';
  const glowText = glowColor === 'blue' ? 'text-[#00d2ff]' : 'text-[#b500ff]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ 
        scale: 1.03, 
        y: -5,
        boxShadow: glowColor === 'blue' 
          ? '0 10px 30px -10px rgba(0, 210, 255, 0.2)' 
          : '0 10px 30px -10px rgba(181, 0, 255, 0.2)'
      }}
      className={`glass-panel p-6 rounded-2xl relative overflow-hidden transition-all duration-300 ${borderClass}`}
    >
      {/* Decorative gradient corners */}
      <div className={`absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl ${
        glowColor === 'blue' ? 'from-[#00d2ff]/10' : 'from-[#b500ff]/10'
      } to-transparent blur-md`} />

      {/* Floating icon */}
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/10 ${glowText} transition-all duration-300`}>
        {icon}
      </div>

      {/* Title */}
      <h3 className="font-futuristic text-base font-semibold tracking-wider text-white mb-2 uppercase">
        {title}
      </h3>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed">
        {description}
      </p>

      {/* Interactive Bottom Cyber Bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-[2px] w-0 bg-gradient-to-r ${
        glowColor === 'blue' ? 'from-[#00d2ff]' : 'from-[#b500ff]'
      } to-transparent group-hover:w-full transition-all duration-500`} />
    </motion.div>
  );
}

export default function Features() {
  const items = [
    {
      icon: <Image className="h-6 w-6" />,
      title: 'Medical Image Upload',
      description: 'Support for high-resolution DICOM, JPG, and PNG files. Integrated dropzones with instant thumbnail preview and scan analysis compatibility.',
      glowColor: 'blue' as const,
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: 'AI Cancer Scoring',
      description: 'Advanced convolutional neural network diagnostics predicting probability scores, risk distributions, and tumor bounds within 3–5 seconds.',
      glowColor: 'purple' as const,
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: 'Diagnostic Reports',
      description: 'Automated synthesis of diagnostic findings, scan timelines, and doctor directives formatted in a downloadable premium medical report.',
      glowColor: 'blue' as const,
    },
    {
      icon: <LayoutDashboard className="h-6 w-6" />,
      title: 'Doctor Dashboard',
      description: 'Real-time operations center tracking scan volumes, high-risk flags, average diagnosis confidence, and live clinical activity widgets.',
      glowColor: 'purple' as const,
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: 'Patient History',
      description: 'Secure records portal housing longitudinal scanner history logs, timeline graphs of prior diagnoses, and historical records indices.',
      glowColor: 'blue' as const,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 relative">
      <div className="text-center mb-16">
        <motion.h2 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-futuristic text-2xl font-bold uppercase tracking-widest text-[#00d2ff] mb-2"
        >
          SYSTEM CAPABILITIES
        </motion.h2>
        <div className="h-[1px] w-24 mx-auto bg-gradient-to-r from-transparent via-[#00d2ff] to-transparent" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <div key={index} className={index === 4 ? 'sm:col-span-2 lg:col-span-1 mx-auto w-full' : ''}>
            <FeatureCard
              icon={item.icon}
              title={item.title}
              description={item.description}
              glowColor={item.glowColor}
              index={index}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
