"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { User } from "firebase/auth";

interface AuthMenuProps {
  user: User | null;
  isLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

// Google's official multicolor "G" mark — brand guidelines require using it
// unmodified on sign-in buttons, so this stays separate from the app's own
// single-color Icon set (src/components/Icon).
function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function AuthMenu({ user, isLoading, onSignIn, onSignOut }: AuthMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const clickedTrigger = menuRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  if (isLoading) return null;

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-mauve-700 transition-colors hover:bg-mauve-100 md:h-9"
      >
        <GoogleLogo />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  const initial = (user.displayName ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-label="Account menu"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mauve-100 text-sm font-semibold text-mauve-700 md:h-9 md:w-9"
      >
        {user.photoURL ? (
          <Image
            src={user.photoURL}
            alt=""
            fill
            unoptimized
            sizes="36px"
            referrerPolicy="no-referrer"
            className="object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {isMenuOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-mauve-200 bg-white py-1 shadow-lg"
        >
          <div className="truncate px-3 py-2 text-sm font-medium text-mauve-900">
            {user.displayName ?? "Signed in"}
          </div>
          {user.email && (
            <div className="truncate px-3 pb-2 text-xs text-mauve-500">{user.email}</div>
          )}
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              onSignOut();
            }}
            className="block w-full border-t border-mauve-200 px-3 py-2 text-left text-sm text-mauve-700 hover:bg-mauve-100"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
