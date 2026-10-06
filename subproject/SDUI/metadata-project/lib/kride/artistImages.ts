// Existing packaged artist assets only; never guess a missing filename.
const files = ["ATEEZ.jpg", "BLACKPINK.jpg", "BTOB.jpg", "BTS.jpg", "EXO.jpg", "GDragon.jpg", "GOT7.jpg", "Girls' Generation.jpg", "ITZY.jpg", "IU.jpg", "IVE.jpg", "LE SSERAFIM.jpg", "MAMAMOO.jpg", "NCT 127.jpg", "NCT.jpg", "NewJeans.jpg", "OH MY GIRL.jpg", "Red Velvet.jpg", "SEVENTEEN.jpg", "SHINee.jpg", "SUPER JUNIOR.jpg", "Stray Kids.jpg", "TVXQ.jpg", "TWICE.jpg", "aespa.jpg"];
const available = new Set(files.map(name => `/artists/${name}`));

export function artistImageSource(value: unknown, name: string, useArtistFallback: boolean): string {
  const fallback = useArtistFallback && available.has(`/artists/${name}.jpg`) ? `/artists/${name}.jpg` : "";
  if (typeof value !== "string" || !value) return fallback;
  if (!value.startsWith("/artists/")) return value;
  try { const decoded = decodeURI(value); return available.has(decoded) ? decoded : fallback; }
  catch { return fallback; }
}
