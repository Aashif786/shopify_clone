import React from "react";
import Navigation from "@/components/landing/Navigation";
import HeroOpening from "@/components/landing/sections/HeroOpening";
import BrandPhilosophy from "@/components/landing/sections/BrandPhilosophy";
import StorefrontShowcase from "@/components/landing/sections/StorefrontShowcase";
import HorizontalStory from "@/components/landing/sections/HorizontalStory";
import CommerceOperations from "@/components/landing/sections/CommerceOperations";
import VisualProof from "@/components/landing/sections/VisualProof";
import GrowthStory from "@/components/landing/sections/GrowthStory";
import FinalCTA from "@/components/landing/sections/FinalCTA";
import Footer from "@/components/landing/Footer";
import "./landing-01.css";

export default function Home() {
  return (
    <div className="landing-page-root">
      <Navigation />
      <main>
        <HeroOpening />
        <BrandPhilosophy />
        <StorefrontShowcase />
        <HorizontalStory />
        <CommerceOperations />
        <VisualProof />
        <GrowthStory />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
