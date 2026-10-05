import React from 'react';

interface HotelLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const HotelLogo: React.FC<HotelLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
}) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Luxury Crest Emblem */}
      <div
        className={`${sizeMap[size]} shrink-0 rounded-xl overflow-hidden shadow-sm border border-amber-300/40 bg-[#041a1f] flex items-center justify-center p-0.5`}
      >
        <img
          src="/icon.svg"
          alt="HOTEL SƠN NGỌC"
          className="w-full h-full object-contain filter drop-shadow-xs"
        />
      </div>

      {showText && (
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-extrabold tracking-tight text-white">
              HOTEL SƠN NGỌC
            </h1>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
          </div>
          <p className="text-[10px] text-amber-300 font-semibold tracking-wider uppercase">
            Khách Sạn &amp; Massage Thư Giãn
          </p>
        </div>
      )}
    </div>
  );
};
