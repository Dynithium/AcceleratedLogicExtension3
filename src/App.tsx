import React from "react";

export default function App() {
  return (
    <div className="w-full h-screen bg-[#0e1217] flex justify-center items-stretch overflow-hidden">
      <iframe
        src="/popup.html"
        title="AcceleratedLogic AI Extension"
        className="w-full h-full border-0 bg-[#0e1217]"
      />
    </div>
  );
}

