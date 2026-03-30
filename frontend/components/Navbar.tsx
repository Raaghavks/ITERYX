"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { socketService } from '@/lib/socket';
import { HeartPulse, Stethoscope, LayoutDashboard, BedDouble, AlertTriangle } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [hasEmergency, setHasEmergency] = useState(false);

  useEffect(() => {
    socketService.onEmergencyAlert(() => {
      setHasEmergency(true);
      // Optional sound or toaster notification could go here
    });

    return () => {
      socketService.removeListener('emergency_alert');
    };
  }, []);

  const clearEmergency = () => {
    setHasEmergency(false);
  };

  const links = [
    { href: "/opd/register", label: "OPD Registration", icon: HeartPulse },
    { href: "/doctor/queue", label: "Doctor Queue", icon: Stethoscope },
    { href: "/admin/beds", label: "Bed Map", icon: BedDouble },
    { href: "/admin/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center mx-auto px-4 md:px-8">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block text-xl tracking-tight text-primary">
              ITERYX
            </span>
          </Link>
          <div className="hidden md:flex gap-6">
            {links.map((link) => {
              const isActive = pathname === link.href || (pathname?.startsWith(link.href) && link.href !== '/');
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center text-sm font-medium transition-colors hover:text-foreground/80 ${
                    isActive ? 'text-foreground' : 'text-foreground/60'
                  }`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
          </div>
          <nav className="flex items-center space-x-4">
            <button
              onClick={clearEmergency}
              className={`relative flex items-center justify-center p-2 rounded-full transition-all duration-300 ${
                hasEmergency ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'text-foreground/60 hover:bg-accent'
              }`}
              title="Emergency Alerts"
            >
              <AlertTriangle className={`h-5 w-5 ${hasEmergency ? 'animate-pulse' : ''}`} />
              {hasEmergency && (
                <span className="absolute top-1 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </nav>
  );
}
