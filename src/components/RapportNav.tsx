"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOIS } from "@/lib/format";

const idxToKey = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
const labelOf = (idx: number) => `${MOIS[idx % 12]} ${Math.floor(idx / 12)}`;

const STYLE = `
.rap-range{ -webkit-appearance:none; appearance:none; width:100%; height:18px; background:transparent; cursor:pointer; margin:0; }
.rap-range:focus{ outline:none; }
.rap-range::-webkit-slider-runnable-track{ height:2px; background:#d9dce0; border-radius:2px; }
.rap-range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:16px; height:16px; margin-top:-7px; border-radius:50%; background:#00B0F0; border:2px solid #fff; box-shadow:0 0 0 1px rgba(0,0,0,.2); }
.rap-range::-moz-range-track{ height:2px; background:#d9dce0; border-radius:2px; }
.rap-range::-moz-range-progress{ height:2px; background:#d9dce0; border-radius:2px; }
.rap-range::-moz-range-thumb{ width:16px; height:16px; border:2px solid #fff; border-radius:50%; background:#00B0F0; box-shadow:0 0 0 1px rgba(0,0,0,.2); }
.rap-range:disabled{ cursor:default; opacity:.5; }
`;

export default function RapportNav({
  clientId,
  min,
  max,
  value,
}: {
  clientId: string;
  min: number;
  max: number;
  value: number;
}) {
  const router = useRouter();
  const [val, setVal] = useState(value);
  const disabled = max <= min;

  const go = (v: number) => router.push(`/rapports?client=${clientId}&mois=${idxToKey(v)}`);

  return (
    <div style={{ minWidth: 280 }}>
      <style>{STYLE}</style>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: "#a5a5a5" }}>{labelOf(max)}</span>
        <span style={{ color: "#0077a8", fontWeight: 600 }}>{labelOf(val)}</span>
        <span style={{ color: "#a5a5a5" }}>{labelOf(min)}</span>
      </div>
      <input
        type="range"
        className="rap-range"
        min={min}
        max={max}
        step={1}
        value={val}
        disabled={disabled}
        onChange={(e) => setVal(Number(e.target.value))}
        onMouseUp={(e) => go(Number(e.currentTarget.value))}
        onTouchEnd={(e) => go(Number(e.currentTarget.value))}
        onKeyUp={(e) => go(Number(e.currentTarget.value))}
        style={{ direction: "rtl" }}
      />
    </div>
  );
}
