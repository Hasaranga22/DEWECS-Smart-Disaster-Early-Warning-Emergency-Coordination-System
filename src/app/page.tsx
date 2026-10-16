"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const OnboardingScreen = dynamic(
  () => import("@/modules/uc2-report/client/OnboardingScreen"),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 bg-slate-950" />,
  }
);

export default function Home() {
  const router = useRouter();

  const handleDone = () => {
    router.push("/report/new");
  };

  return <OnboardingScreen onDone={handleDone} />;
}
