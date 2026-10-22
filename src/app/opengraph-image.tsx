import { ImageResponse } from "next/og";

export const alt = "ProofNest: your deposit, backed by proof. A taped photo of a cracked kitchen tile, sealed at 10:02 am.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Nunito at one weight, only the letters needed; the image still renders in the default font if this fails. */
async function nunito(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Nunito:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

const HEAD = "Your deposit, backed by proof.";
const BODY = "Live photos of your flat, sealed with the time, confirmed by your owner. For tenants in India.";

/** The preview shown when a ProofNest link is shared on WhatsApp, LinkedIn or X. */
export default async function OpengraphImage() {
  const [heavy, regular] = await Promise.all([nunito(900, `ProofNest${HEAD}P1 KitchenSEALED · 10:02 AM`), nunito(500, BODY)]);
  const fonts = [
    ...(heavy ? [{ name: "Nunito", data: heavy, weight: 900 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Nunito", data: regular, weight: 500 as const, style: "normal" as const }] : []),
  ];
  const tiles = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      tiles.push(
        <div key={`${r}-${c}`} style={{ position: "absolute", left: c * 62 + 2, top: r * 62 + 2, width: 58, height: 58, borderRadius: 2, background: (r * 7 + c * 13) % 3 ? "#E4E6DF" : "#D6D9D0" }} />,
      );
    }
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 80px", background: "#F7F3EA", fontFamily: fonts.length ? "Nunito" : "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 900, color: "#1E1B2E" }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background: "#2E3A8C", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div style={{ width: 14, height: 16, background: "#D99A1E", borderRadius: 2, marginBottom: 6 }} />
            </div>
            ProofNest
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.04, letterSpacing: -2, color: "#1E1B2E", marginTop: 34 }}>{HEAD}</div>
          <div style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.4, color: "#625D52", marginTop: 26 }}>{BODY}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", background: "#FFFDF8", padding: "16px 16px 0", transform: "rotate(2deg)", boxShadow: "0 18px 40px rgba(30,27,46,.22)", position: "relative" }}>
          <div style={{ position: "absolute", top: -16, left: 150, width: 110, height: 32, background: "rgba(217,154,30,.5)", transform: "rotate(-4deg)" }} />
          <div style={{ position: "relative", width: 372, height: 280, background: "#C9CCC2", overflow: "hidden", display: "flex" }}>
            {tiles}
            <div style={{ position: "absolute", left: 0, right: 0, top: 250, height: 30, background: "#2F3430" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 4px 20px", fontSize: 24, color: "#1E1B2E" }}>
            <div style={{ display: "flex", fontWeight: 900 }}>P1 Kitchen</div>
            <div style={{ display: "flex", fontSize: 18, fontWeight: 900, color: "#2E3A8C", border: "2px solid #2E3A8C", borderRadius: 6, padding: "2px 10px" }}>SEALED · 10:02 AM</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
