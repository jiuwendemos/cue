import { useEffect, useState } from "react";

/** Developer aid for narrow viewports: ?debug=1 lists elements that overflow. */
export function LayoutDebug() {
  const [report, setReport] = useState("measuring…");

  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth;
      const bad = [...document.querySelectorAll<HTMLElement>("body *")]
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.right > width + 1)
        .slice(0, 8)
        .map(({ el, rect }) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} ${Math.round(rect.right)}>${width}`);
      setReport(`w=${width} scroll=${document.documentElement.scrollWidth}\n${bad.join("\n") || "none"}`);
    };
    const id = window.setTimeout(measure, 600);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <pre
      style={{
        position: "fixed",
        left: 6,
        bottom: 70,
        zIndex: 999,
        maxWidth: "94vw",
        maxHeight: 180,
        overflow: "auto",
        background: "#000",
        color: "#d7ff4f",
        border: "1px solid #d7ff4f",
        padding: 6,
        fontSize: 9,
        lineHeight: 1.3,
        whiteSpace: "pre-wrap",
      }}
    >
      {report}
    </pre>
  );
}
