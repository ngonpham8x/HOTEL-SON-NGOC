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
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Luxury Crest Emblem */}
      <div
        className={`${sizeMap[size]} shrink-0 rounded-xl overflow-hidden shadow-md ring-1 ring-amber-300/50 flex items-center justify-center`}
      >
        <img
          src="/icon.svg"
          alt="HOTEL SƠN NGỌC"
          className="w-full h-full object-contain"
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
