import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: KPICardProps) {
  return (
    <Card className={cn("p-5 border-[#e3e3e1] bg-white", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#787774]">{title}</p>
          <p className="text-2xl font-semibold text-[#37352f]">{value}</p>
          {subtitle && (
            <p className="text-xs text-[#787774]">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-[#0f7b6c]" : "text-[#e03e3e]"
              )}
            >
              {trend.isPositive ? "+" : ""}{trend.value}% vs período anterior
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2 bg-[#f7f7f5] rounded-md">
            <Icon className="w-5 h-5 text-[#787774]" />
          </div>
        )}
      </div>
    </Card>
  );
}
