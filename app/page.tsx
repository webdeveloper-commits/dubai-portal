import HeroSection from "@/app/components/HeroSection";
import FeaturedProjects from "@/app/components/FeaturedProjects";
import PropertyTypes from "@/app/components/PropertyTypes";
import LuxuryResidences from "@/app/components/LuxuryResidences";
import PropertiesByArea from "@/app/components/PropertiesByArea";
import PropertiesByLifestyle from "@/app/components/PropertiesByLifestyle";
import AboutElysian from "@/app/components/AboutElysian";
import Footer from "@/app/components/Footer";
import { Disclaimer, CookieBanner, FloatingContact } from "@/app/components/GlobalExtras";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <FeaturedProjects />
      <PropertyTypes />
      <LuxuryResidences />
      <PropertiesByArea />
      <PropertiesByLifestyle />
      <AboutElysian />
      <Footer />
      <Disclaimer />
      <CookieBanner />
      <FloatingContact />
    </main>
  );
}
