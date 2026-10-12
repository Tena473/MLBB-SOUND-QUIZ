type IconName = 'sound' | 'play' | 'pause' | 'arrow' | 'check' | 'eye' | 'headphones' | 'close';

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    sound: <><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" /></>,
    play: <path d="m9 5 11 7-11 7Z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
