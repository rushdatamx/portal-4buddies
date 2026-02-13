"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";

interface TrendChartProps {
  title: string;
  data: Array<{
    name: string;
    value: number;
  }>;
  color?: string;
}

export function TrendChart({ title, data, color = "#2383e2" }: TrendChartProps) {
  return (
    <Card className="p-5 border-[#e3e3e1] bg-white">
      <h3 className="text-sm font-medium text-[#37352f] mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e3e1" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#787774" }}
              tickLine={false}
              axisLine={{ stroke: "#e3e3e1" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#787774" }}
              tickLine={false}
              axisLine={{ stroke: "#e3e3e1" }}
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e3e3e1",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
