import React from 'react';
import logoImg from '../../assets/logo-transparent.png';

export const LogoIcon = ({ size = 'md', className = '', glow = true }) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
  };

  const imgSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl overflow-hidden shrink-0 transition-transform duration-200 group-hover:scale-105 ${imgSize} ${className}`}
    >
      {glow && (
        <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full pointer-events-none -z-10" />
      )}
      <img
        src={logoImg}
        alt="QuantEX Logo"
        className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,255,102,0.25)]"
        loading="eager"
      />
    </div>
  );
};

export const Logo = ({
  size = 'md',
  withText = true,
  subtitle = 'AI QUANT PLATFORM',
  className = '',
  textClassName = '',
}) => {
  const titleSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-2xl',
  };

  const titleSize = titleSizes[size] || titleSizes.md;

  return (
    <div className={`flex items-center gap-2.5 group select-none ${className}`}>
      <LogoIcon size={size} />
      {withText && (
        <div className={`flex flex-col ${textClassName}`}>
          <div className="flex items-center gap-1 leading-tight">
            <span className={`font-heading font-extrabold tracking-tight text-white ${titleSize}`}>
              Quant
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF66] via-emerald-400 to-cyan-400">
                EX
              </span>
            </span>
          </div>
          {subtitle && (
            <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
