"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";
import {
  Sparkles,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Star,
  Flame,
  Award,
  Heart,
  Clock,
  RotateCcw,
} from "lucide-react";

interface IconElementProps {
  element: PageElement;
}

export function IconElement({ element }: IconElementProps) {
  const content = (element.content || {}) as {
    icon?: string;
    title?: string;
    description?: string;
    layout?: "vertical" | "horizontal";
  };
  const style = element.style || {};

  const iconName = content.icon || "sparkles";
  const title = content.title || "Feature Title";
  const description = content.description || "Brief description of this benefit or feature.";
  const layout = content.layout || "vertical";

  const renderIcon = () => {
    const iconProps = { className: "w-5 h-5 text-primary" };
    switch (iconName) {
      case "check":
        return <CheckCircle2 {...iconProps} />;
      case "truck":
        return <Truck {...iconProps} />;
      case "shield":
        return <ShieldCheck {...iconProps} />;
      case "star":
        return <Star {...iconProps} />;
      case "flame":
        return <Flame {...iconProps} />;
      case "award":
        return <Award {...iconProps} />;
      case "heart":
        return <Heart {...iconProps} />;
      case "clock":
        return <Clock {...iconProps} />;
      case "return":
        return <RotateCcw {...iconProps} />;
      case "sparkles":
      default:
        return <Sparkles {...iconProps} />;
    }
  };

  if (layout === "horizontal") {
    return (
      <div className="flex items-start gap-3.5 p-3 rounded-xl border border-border/40 bg-card/40 transition-colors">
        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">{renderIcon()}</div>
        <div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground">{title}</h4>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col p-4 rounded-xl border border-border/40 bg-card/40 transition-colors ${
        style.textAlign === "center" ? "items-center text-center" : "items-start text-left"
      }`}
    >
      <div className="p-2.5 rounded-xl bg-primary/10 mb-3">{renderIcon()}</div>
      <h4 className="text-sm font-semibold tracking-tight text-foreground">{title}</h4>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[40ch]">{description}</p>
      )}
    </div>
  );
}
