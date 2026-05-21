import React from "react";

interface BrandLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className, style }) => {
  return (
    <svg
      viewBox="0 0 1000 1000"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      id="brand-logo-svg"
    >
      {/* Dynamic Blue Chevron (Left hand side) */}
      <path
        d="M 72 40 L 530 40 L 620 500 L 330 960 L 50 960 L 360 500 Z"
        fill="#26b5f5"
        id="logo-path-blue"
      />
      {/* Dynamic Lime Green shape (Top right hand side) */}
      <path
        d="M 640 40 L 928 40 L 666 450 L 550 250 Z"
        fill="#84da1c"
        id="logo-path-green"
      />
      {/* Dynamic Bright Orange shape (Bottom right hand side) */}
      <path
        d="M 550 750 L 666 550 L 928 960 L 640 960 Z"
        fill="#f69629"
        id="logo-path-orange"
      />
    </svg>
  );
};
