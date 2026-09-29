'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

function Tab({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  const active = usePathname() === href;
  return (
    <Link href={href} className={`tab${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
    </Link>
  );
}

export function Dock({ listening, busy, onMic, onType }: { listening: boolean; busy: boolean; onMic: () => void; onType: () => void }) {
  return (
    <nav className="dock" aria-label="Main">
      <div className="dock-inner">
        <Tab href="/" icon="home" label="Overview" />
        <Tab href="/activity" icon="list" label="Activity" />
        <button
          className={`mic${listening ? ' on' : ''}${busy ? ' busy' : ''}`}
          onClick={onMic}
          aria-label={listening ? 'Stop listening' : 'Tell me what you spent'}
        >
          <span className="mic-ring" aria-hidden="true" />
          <span className="mic-ring two" aria-hidden="true" />
          {listening ? <span className="stop" aria-hidden="true" /> : <Icon name="mic" size={28} />}
        </button>
        <button className="tab" onClick={onType}>
          <Icon name="keys" />
          <span>Type</span>
        </button>
        <Tab href="/settings" icon="user" label="You" />
      </div>
    </nav>
  );
}
