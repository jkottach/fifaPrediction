import React from 'react';
import { APP_LOGO_ALT, APP_LOGO_SRC, APP_NAME } from '../constants/branding';

interface AppLogoProps {
  showTitle?: boolean;
  logoClassName?: string;
  titleClassName?: string;
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({
  showTitle = true,
  logoClassName = 'h-10 w-auto object-contain',
  titleClassName = 'font-display text-base font-bold truncate',
  className = 'flex items-center gap-2 min-w-0',
}) => (
  <div className={className}>
    <img src={APP_LOGO_SRC} alt={APP_LOGO_ALT} className={logoClassName} />
    {showTitle && <span className={titleClassName}>{APP_NAME}</span>}
  </div>
);

export default AppLogo;
