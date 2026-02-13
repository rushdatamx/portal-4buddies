"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";

interface BarChartProps {
  title: string;
  data: Array<{
    name: string;
    value: number;
  }>;
  color?: string;
  horizontal?: boolean;
}

export function BarChart({
  title,
  data,
  color = "#2383e2",
  horizontal = false,
}: BarChartProps) {
  return (
    <Card className="p-5 border-[#e3e3e1] bg-white">
      <h3 className="text-sm font-medium text-[#37352f] mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e3e1" />
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#787774" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e3e3e1" }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                  }
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: "#787774" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e3e3e1" }}
                  width={100}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#787774" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e3e3e1" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#787774" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e3e3e1" }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                  }
                />
              </>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e3e3e1",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
