import React from 'react';
import { APP_LOGO_ALT, APP_LOGO_SRC, APP_NAME } from '../constants/branding';

interface AppLogoProps {
  showTitle?: boolean;
  logoClassName?: string;
  titleClassName?: string;
  className?: string;
  /** Use on dark backgrounds — logo sits on a white card (no CSS invert). */
  variant?: 'default' | 'onDark';
}

const AppLogo: React.FC<AppLogoProps> = ({
  showTitle = true,
  logoClassName = 'h-10 w-auto object-contain',
  titleClassName = 'font-display text-base font-bold truncate',
  className = 'flex items-center gap-2 min-w-0',
  variant = 'default',
}) => {
  const logo = (
    <img src={APP_LOGO_SRC} alt={APP_LOGO_ALT} className={logoClassName} />
  );

  return (
    <div className={className}>
      {variant === 'onDark' ? (
        <div className="rounded-2xl bg-white px-5 py-3 shadow-lg shadow-black/20">{logo}</div>
      ) : (
        logo
      )}
      {showTitle && <span className={titleClassName}>{APP_NAME}</span>}
    </div>
  );
};

export default AppLogo;
