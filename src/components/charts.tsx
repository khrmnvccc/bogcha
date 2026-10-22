"use client";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { MONTHS, formatSom } from "@/lib/format";

// Validated palette (light surface): brand blue + mint for revenue; attendance follows status badges.
const C = { expected: "#2563eb", collected: "#059669", debt: "#dc2626", present: "#059669", late: "#f59e0b", absent: "#dc2626", excused: "#60a5fa" };
const axis = { stroke: "#94a3b8", fontSize: 12, tickLine: false, axisLine: false } as const;

function shortSom(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(".", ",")} mln`;
  if (v >= 1000) return `${Math.round(v / 1000)} ming`;
  return String(v);
}
const monthLabel = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3);
const dayLabel = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

function TooltipBox({ active, payload, label, money, labelFmt }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean; labelFmt: (l: string) => string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">{labelFmt(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-slate-900">{money ? formatSom(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

const legendStyle = { fontSize: 12, paddingTop: 8 };

export function RevenueChart({ data }: { data: { period: string; expected: number; collected: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="period" tickFormatter={monthLabel} {...axis} />
        <YAxis tickFormatter={shortSom} width={56} {...axis} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox money labelFmt={(l) => `${MONTHS[Number(l.slice(5, 7)) - 1]} ${l.slice(0, 4)}`} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
        <Bar dataKey="expected" name="Hisoblangan" fill={C.expected} radius={[4, 4, 0, 0]} />
        <Bar dataKey="collected" name="Yig'ilgan" fill={C.collected} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DebtChart({ data }: { data: { period: string; outstanding: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="period" tickFormatter={monthLabel} {...axis} />
        <YAxis tickFormatter={shortSom} width={56} {...axis} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox money labelFmt={(l) => `${MONTHS[Number(l.slice(5, 7)) - 1]} ${l.slice(0, 4)}`} />} />
        <Bar dataKey="outstanding" name="Qarzdorlik" fill={C.debt} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AttendanceChart({ data }: { data: { day: string; present: number; late: number; absent: number; excused: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="day" tickFormatter={dayLabel} {...axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis allowDecimals={false} width={32} {...axis} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipBox labelFmt={dayLabel} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
        <Bar dataKey="present" name="Keldi" stackId="a" fill={C.present} stroke="#fff" strokeWidth={1} />
        <Bar dataKey="late" name="Kechikdi" stackId="a" fill={C.late} stroke="#fff" strokeWidth={1} />
        <Bar dataKey="excused" name="Sababli" stackId="a" fill={C.excused} stroke="#fff" strokeWidth={1} />
        <Bar dataKey="absent" name="Kelmagan" stackId="a" fill={C.absent} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
