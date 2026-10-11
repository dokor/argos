const paths = [
  "M13 2 4 14h7l-1 8 10-13h-7z",
  "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z",
  "m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18",
  "M8 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0M4 22v-3a8 8 0 0 1 16 0v3",
];
export default function PublicIcon({ index = 0, size = 24 }: { index?: number; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[index % paths.length]} /></svg>;
}
