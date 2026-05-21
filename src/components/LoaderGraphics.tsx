import React, { useEffect, useState } from "react";
import { BrandLogo } from "./BrandLogo";

interface LoaderGraphicsProps {
  label: string;
  sublabel: string;
}

export const LoaderGraphics: React.FC<LoaderGraphicsProps> = ({ label, sublabel }) => {
  const [dots, setDots] = useState("");
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    "Establishing secure Handshake...",
    "Querying Google Sheets JSON API...",
    "Decrypting verified quiz entries...",
    "Synchronizing database schemas...",
    "Readying immersive interface..."
  ];

  // Dynamic status-step cycler
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 2200);

    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 450);

    return () => {
      clearInterval(stepInterval);
      clearInterval(dotInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full text-center relative" id="loader-graphics-container">
      {/* Visual background energy beam */}
      <div className="absolute w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse" />

      {/* Futuristic Orbit Ring Structure with the Kinettix Logo in the Center */}
      <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
        {/* Outer Counter-Clockwise Dotted Ring */}
        <div className="absolute inset-0 rounded-full border border-dashed border-slate-600/40 animate-[spin_15s_linear_infinite_reverse]" />

        {/* Middle Slow Clockwise Ring */}
        <div className="absolute inset-2 rounded-full border border-slate-500/20" />
        <div className="absolute inset-2 rounded-full border-t border-b border-indigo-400/50 animate-[spin_6s_linear_infinite]" />

        {/* Inner fast ring with pulse */}
        <div className="absolute inset-4 rounded-full border border-dashed border-indigo-500/35 animate-[spin_3s_linear_infinite]" />

        {/* Scanning horizontal glow line moving up and down */}
        <div className="absolute w-36 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent top-0 animate-[bounce_3s_infinite]" />

        {/* Inside ambient radial container */}
        <div className="w-20 h-20 bg-slate-900/90 rounded-full border border-slate-700/60 shadow-inner flex items-center justify-center p-4 relative overflow-hidden group">
          {/* Subtle spinning back face overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent animate-pulse" />
          
          {/* Kinettix Brand Logo with custom gentle floating and scale pulse */}
          <BrandLogo 
            className="w-12 h-12 relative z-10 animate-[bounce_4s_infinite]" 
            style={{ filter: "drop-shadow(0 4px 12px rgba(99, 102, 241, 0.45))" }}
          />
        </div>

        {/* Stroboscopic Orbit Node */}
        <div className="absolute top-0 left-12 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981] animate-ping" />
      </div>

      {/* Custom Bar Graph loading bar */}
      <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-6 relative border border-slate-700/30">
        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-emerald-400 w-2/3 rounded-full animate-[shimmer_1.8s_infinite] origin-left" style={{ animationName: "loadingProgress" }} />
      </div>

      {/* Styled label headings */}
      <h2 className="text-lg font-semibold text-white tracking-wide mb-1 flex items-center justify-center gap-1.5" id="loader-primary-heading">
        {label}
      </h2>
      <p className="text-xs text-slate-400 max-w-[250px] mx-auto leading-relaxed mb-4 min-h-[32px]" id="loader-secondary-heading">
        {sublabel}
      </p>

      {/* Dynamic Network / Connection Status Steps Panel */}
      <div className="px-4 py-2 bg-slate-950/60 rounded-xl border border-slate-800/80 max-w-[240px] w-full mt-2 flex items-center gap-2 justify-center shadow-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping flex-shrink-0" />
        <span className="text-[10px] uppercase tracking-wider font-mono text-indigo-300 font-semibold truncate">
          {steps[activeStep]}{dots}
        </span>
      </div>

      {/* Custom Keyframe Styles injected directly */}
      <style>{`
        @keyframes loadingProgress {
          0% {
            width: 0%;
            transform: translateX(0%);
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};
