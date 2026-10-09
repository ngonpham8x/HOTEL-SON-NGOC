import React from 'react';

interface HotelLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'auto' | 'emblem' | 'full';
  showText?: boolean;
}

export const HotelLogo: React.FC<HotelLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'auto',
  showText = false,
}) => {
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9 sm:w-10 sm:h-10',
    md: 'w-11 h-11',
    lg: 'w-14 h-14 sm:w-16 sm:h-16',
    xl: 'w-20 h-20 sm:w-24 sm:h-24',
  };

  // Determine whether to show the emblem (mountains + diamond) or full logo (with text)
  const isEmblem =
    variant === 'emblem' || (variant === 'auto' && (size === 'xs' || size === 'sm'));

  const imgSrc = isEmblem ? '/logo-emblem.png' : '/logo-full.png';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Official Luxury Hotel Sơn Ngọc Emblem Badge */}
      <div
        className={`hotel-logo-badge ${sizeMap[size]} shrink-0 rounded-xl overflow-hidden shadow-xs ring-1 ring-amber-400/30 bg-white flex items-center justify-center p-0.5 transition-transform hover:scale-[1.02] print:bg-transparent print:ring-0 print:shadow-none print:p-0 print:rounded-none`}
        title="HOTEL SƠN NGỌC"
      >
        <img
          src={imgSrc}
          alt="HOTEL SƠN NGỌC"
          className="w-full h-full object-contain select-none print:object-contain"
          loading="eager"
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
