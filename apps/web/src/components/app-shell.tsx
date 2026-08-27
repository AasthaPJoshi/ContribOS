import type {
  PropsWithChildren
} from "react";
import {
  NavLink
} from "react-router-dom";

export function AppShell({
  children
}: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            CONTRIBUTION OPERATIONS
          </p>
          <h1>ContribOS</h1>
        </div>

        <nav
          className="nav"
          aria-label="Primary"
        >
          <NavLink to="/">
            Home
          </NavLink>
        </nav>
      </header>

      <main className="content">
        {children}
      </main>
    </div>
  );
}
