import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-4 py-2 rounded font-medium transition-all duration-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border";
  
  const variants = {
    primary: "bg-cyber-900 border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-900 hover:shadow-neon-cyan focus:shadow-neon-cyan",
    secondary: "bg-cyber-800 border-cyber-700 text-cyber-text hover:border-cyber-accent hover:text-cyber-accent focus:border-cyber-accent",
    danger: "bg-cyber-900 border-red-500 text-red-500 hover:bg-red-500 hover:text-white hover:shadow-[0_0_10px_rgba(239,68,68,0.5)] focus:shadow-[0_0_10px_rgba(239,68,68,0.5)]",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};
