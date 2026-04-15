import React from 'react';

interface StepCardProps {
  title: string;
  stepNumber: number;
  isActive: boolean;
  isCompleted: boolean;
  children: React.ReactNode;
}

export const StepCard: React.FC<StepCardProps> = ({ title, stepNumber, isActive, isCompleted, children }) => {
  return (
    <div className={`relative border rounded-xl p-6 transition-all duration-300 ${
      isActive 
        ? 'border-cyber-accent bg-cyber-800 shadow-neon-cyan' 
        : isCompleted 
          ? 'border-cyber-success bg-cyber-800/50 opacity-80' 
          : 'border-cyber-700 bg-cyber-900 opacity-50'
    }`}>
      <div className="flex items-center mb-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold mr-3 border ${
          isActive 
            ? 'bg-cyber-accent text-cyber-900 border-cyber-accent shadow-[0_0_10px_rgba(0,240,255,0.5)]' 
            : isCompleted
              ? 'bg-cyber-success text-cyber-900 border-cyber-success shadow-[0_0_10px_rgba(57,255,20,0.5)]'
              : 'bg-cyber-900 text-cyber-muted border-cyber-700'
        }`}>
          {isCompleted ? '✓' : stepNumber}
        </div>
        <h3 className={`text-xl font-bold tracking-wider uppercase ${isActive ? 'text-white' : isCompleted ? 'text-cyber-success' : 'text-cyber-muted'}`}>{title}</h3>
      </div>
      <div className={isActive ? 'block' : 'hidden'}>
        {children}
      </div>
    </div>
  );
};
