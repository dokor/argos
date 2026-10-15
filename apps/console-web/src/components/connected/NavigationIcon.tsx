const paths = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  sites: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  domains: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18",
  integrations: "M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
  usage: "M4 19a10 10 0 1 1 16 0M12 13l4-5M6 19h12",
  admin: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM9 12l2 2 4-4",
  help: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v.01M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0",
  collapse: "m14 7-5 5 5 5",
  expand: "m10 7 5 5-5 5",
};

export default function NavigationIcon({ name }: { name: keyof typeof paths }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
