import type { Metadata } from "next";
import DashboardOverview from "@/components/dashboard/DashboardOverview";

export const metadata: Metadata = {
  title: "Dashboard | Help Desk 360° JK Food ",
  description: "JK Food | A One-Stop Solution for Your Business",
};

export default function Ecommerce() {
  return <DashboardOverview />;
}
