export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50">
      <div className="relative mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900">
          <span className="text-white font-black text-2xl">CB</span>
        </div>
        <div className="absolute -inset-2 rounded-2xl border-2 border-blue-500/30 animate-ping" />
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-blue-500"
            style={{ animation: `bounce 0.8s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)} }`}</style>
    </div>
  );
}
