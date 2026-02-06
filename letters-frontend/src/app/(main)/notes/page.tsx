"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LegacyNotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const novelId = Number(searchParams.get("novelId"));

  useEffect(() => {
    if (Number.isFinite(novelId) && novelId > 0) {
      router.replace(`/novels/${novelId}/notes`);
      return;
    }

    router.replace("/novels");
  }, [router, novelId]);

  return (
    <div className="content-container">
      <div className="text-center py-20 text-muted">正在跳转笔记页面...</div>
    </div>
  );
}
