import PublicIcon from "@/components/marketing/PublicIcon";
const paths = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  sites: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0",
  domains: "M9 2h6v5H9zM2 17h6v5H2zM16 17h6v5h-6zM12 7v5M5 17v-5h14v5",
  integrations: "M8 3v5m8-5v5M6 8h12v5a6 6 0 0 1-12 0zM12 19v3",
  usage: "M4 20V13m5 7V9m5 11v-5m5 5V5M3 9l6-6 5 5 7-7",
  help: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v.01M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0",
  ci: "M6 6v12m0-16a2 2 0 1 0 0 4 2 2 0 0 0 0-4m0 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4M13 4h1a4 4 0 0 1 4 4v10m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-5-17 3 3-3 3",
  webhooks: "M12 4v7m-7 7 7-7 7 7M9 4a3 3 0 1 0 6 0 3 3 0 0 0-6 0M2 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0m14 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
};
export default function ConnectedIcon({name}:{name:keyof typeof paths|"account"|"admin"|"api"}) {
  if(name==="account"||name==="admin"||name==="api") return <PublicIcon index={name==="api"?2:3} size={18}/>;
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
