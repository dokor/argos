import Image from "next/image";
import s from "./AccountView.module.scss";

export const socialProviderNames: Record<string, string> = { google: "Google", github: "GitHub", linkedin: "LinkedIn" };

export default function SocialProviderLogo({ provider }: { provider: string }) {
  return <span className={`${s.socialIcon} ${provider === "google" ? s.googleIcon : provider === "linkedin" ? s.linkedinIcon : ""}`} aria-hidden="true">
    {provider === "github" ? <>
      <Image className={s.githubLight} src="/brands/github-black.svg" alt="" width={20} height={20} unoptimized />
      <Image className={s.githubDark} src="/brands/github-white.svg" alt="" width={20} height={20} unoptimized />
    </> : provider === "google" ? <Image src="/brands/google.png" alt="" width={40} height={40} unoptimized />
      : provider === "linkedin" ? <Image src="/brands/linkedin.png" alt="" width={20} height={20} unoptimized /> : null}
  </span>;
}
