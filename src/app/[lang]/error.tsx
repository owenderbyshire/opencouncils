"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

const TEXT = {
  en: {
    title: "This page could not be loaded",
    body: "Something went wrong while fetching the data. Try again in a moment.",
    retry: "Try again",
  },
  cy: {
    title: "Doedd dim modd llwytho'r dudalen hon",
    body: "Aeth rhywbeth o'i le wrth nôl y data. Rhowch gynnig arall arni ymhen ychydig.",
    retry: "Rhoi cynnig arall arni",
  },
};

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const params = useParams<{ lang?: string }>();
  const t = TEXT[params.lang === "cy" ? "cy" : "en"];
  return (
    <div className="container-page py-16">
      <h1 className="text-h1">{t.title}</h1>
      <p className="mt-4 max-w-[52ch] text-ink-2">{t.body}</p>
      <button type="button" className="button mt-8" onClick={() => reset()}>
        {t.retry}
      </button>
    </div>
  );
}
