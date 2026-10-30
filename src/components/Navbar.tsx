'use client';

import React, { useState, useEffect } from 'react';
import { Download, HardDrive, Menu, X, Zap, Sun, Moon, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeTab: 'downloader' | 'compressor' | 'converter';
  onSelectTab: (tab: 'downloader' | 'compressor' | 'converter') => void;
  onScrollToHistory: () => void;
}

export default function Navbar({
  activeTab,
  onSelectTab,
  onScrollToHistory,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Inisialisasi tema dari status class documentElement
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('drovio_theme', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('drovio_theme', 'light');
      } catch {}
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-obsidian-border bg-obsidian-canvas/95 backdrop-blur-md">
      {/* Desktop Bar: 64px, Mobile Bar: 54px */}
      <div className="mx-auto flex h-[54px] md:h-[64px] max-w-[1100px] items-center justify-between px-3.5 sm:px-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-accent text-obsidian-canvas font-bold shadow-sm">
            <Download className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold tracking-tight text-white">Drovio</span>
          </div>
        </div>

        {/* Tab Switcher Desktop */}
        <div className="hidden md:flex items-center rounded-lg border border-obsidian-border bg-obsidian-lowest p-1 shadow-inner">
          <button
            type="button"
            onClick={() => onSelectTab('downloader')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'downloader'
                ? 'bg-obsidian-elevated text-violet-accent border border-obsidian-border shadow-sm font-semibold'
                : 'text-obsidian-muted hover:text-white'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Unduh Media</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('compressor')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'compressor'
                ? 'bg-obsidian-elevated text-violet-accent border border-obsidian-border shadow-sm font-semibold'
                : 'text-obsidian-muted hover:text-white'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Kompres</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('converter')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'converter'
                ? 'bg-obsidian-elevated text-violet-accent border border-obsidian-border shadow-sm font-semibold'
                : 'text-obsidian-muted hover:text-white'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Konversi</span>
          </button>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Tombol Tema */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-obsidian-border bg-obsidian-surface text-obsidian-muted transition-colors hover:border-obsidian-border-strong hover:bg-obsidian-elevated hover:text-white"
            title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            aria-label="Ganti Tema"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-violet-accent" />
            )}
          </button>

          {/* Tombol Riwayat */}
          <button
            type="button"
            onClick={onScrollToHistory}
            className="flex h-9 items-center gap-1.5 rounded-md border border-obsidian-border bg-obsidian-surface px-3.5 text-xs font-medium text-obsidian-muted transition-colors hover:border-obsidian-border-strong hover:bg-obsidian-elevated hover:text-white"
          >
            <HardDrive className="h-3.5 w-3.5 text-obsidian-muted" />
            <span>Riwayat</span>
          </button>
        </div>

        {/* Mobile Actions: Theme Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-obsidian-border bg-obsidian-surface text-obsidian-muted hover:text-white"
            title="Ganti Tema"
            aria-label="Ganti Tema"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-violet-accent" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Tab Navigation Bar: Menggantikan hamburger menu dengan akses langsung yang intuitif */}
      <div className="grid grid-cols-4 md:hidden border-t border-obsidian-border/60 bg-obsidian-surface/90 px-1 py-1 text-center">
        <button
          type="button"
          onClick={() => onSelectTab('downloader')}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            activeTab === 'downloader'
              ? 'bg-violet-muted text-violet-accent font-semibold'
              : 'text-obsidian-muted hover:text-white'
          }`}
        >
          <Download className="h-3.5 w-3.5" />
          <span>Unduh</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('compressor')}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            activeTab === 'compressor'
              ? 'bg-violet-muted text-violet-accent font-semibold'
              : 'text-obsidian-muted hover:text-white'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Kompres</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('converter')}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            activeTab === 'converter'
              ? 'bg-violet-muted text-violet-accent font-semibold'
              : 'text-obsidian-muted hover:text-white'
          }`}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Konversi</span>
        </button>

        <button
          type="button"
          onClick={onScrollToHistory}
          className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-obsidian-muted hover:text-white transition-all"
        >
          <HardDrive className="h-3.5 w-3.5" />
          <span>Riwayat</span>
        </button>
      </div>
    </header>
  );
}
