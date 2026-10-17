"use client";

import { useId, useState, type ComponentProps } from "react";
import Link from "@/components/LocalizedLink";
import NavigationIcon from "./NavigationIcon";
import s from "./Connected.module.scss";

type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentProps<typeof NavigationIcon>["name"];
  current?: "page" | "location";
};

type NavigationGroupProps = {
  label: string;
  href: string;
  icon: NavigationItem["icon"];
  route: string;
  active: boolean;
  items: NavigationItem[];
  expandLabel: string;
  collapseLabel: string;
  onNavigate: () => void;
};

/** Parent links navigate; the adjacent disclosure only controls its child list. */
export default function NavigationGroup({ label, href, icon, route, active, items, expandLabel, collapseLabel, onNavigate }: NavigationGroupProps) {
  const panelId = useId();
  const [state, setState] = useState({ route, expanded: active });
  // A manual collapse lasts on this page. The next arrival in the section
  // reveals its current destination, while other groups keep their preference.
  if (state.route !== route) {
    setState({ route, expanded: active || state.expanded });
  }
  const expanded = state.expanded;
  const toggleLabel = expanded ? collapseLabel : expandLabel;

  return <div className={s.navGroup} data-active={active}>
    <div className={s.navGroupHeading}>
      <Link href={href} onClick={onNavigate} aria-label={label} aria-current={active && !expanded ? "location" : undefined}>
        <NavigationIcon name={icon}/><span className={s.navLabel}>{label}</span>
      </Link>
      <button type="button" className={s.groupToggle} aria-label={toggleLabel} aria-expanded={expanded} aria-controls={panelId}
        onClick={() => setState({ route, expanded: !expanded })}>
        <NavigationIcon name={expanded ? "chevronUp" : "chevronDown"}/><span className={s.toggleLabel}>{toggleLabel}</span>
      </button>
    </div>
    <ul id={panelId} className={s.navChildren} hidden={!expanded}>
      {items.map(item => <li key={item.href}>
        <Link href={item.href} onClick={onNavigate} aria-label={item.label} aria-current={item.current}>
          <NavigationIcon name={item.icon}/><span className={s.navLabel}>{item.label}</span>
        </Link>
      </li>)}
    </ul>
  </div>;
}
