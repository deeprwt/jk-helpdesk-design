import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "SignIn Page | Help Desk 360° JK Food ",
  description: "JK Food | A One-Stop Solution for Your Business",
};

export default function SignIn() {
  return <SignInForm />;
}
