import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "SignUp Page | Help Desk 360° JK Food ",
  description: "JK Food | A One-Stop Solution for Your Business",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
