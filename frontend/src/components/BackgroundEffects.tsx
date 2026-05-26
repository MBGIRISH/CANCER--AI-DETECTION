export default function BackgroundEffects() {
  return (
    <div className="fixed inset-0 -z-50 select-none overflow-hidden bg-[#000000]">
      {/* Soft Center-Top Spotlight Shading Layer */}
      <div className="spotlight-top" />
      
      {/* Dark Vignetting Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_40%,rgba(0,0,0,0.95)_100%)] pointer-events-none" />
    </div>
  );
}
