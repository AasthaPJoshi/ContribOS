import {
  BrowserRouter,
  Route,
  Routes
} from "react-router-dom";

import {
  AppShell
} from "./components/app-shell.js";
import {
  AttentionPage
} from "./pages/attention-page.js";
import {
  ContributionPage
} from "./pages/contribution-page.js";
import {
  HomePage
} from "./pages/home-page.js";
import {
  NotFoundPage
} from "./pages/not-found-page.js";
import {
  RepositoryPage
} from "./pages/repository-page.js";

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route
            path="/"
            element={<HomePage />}
          />
          <Route
            path="/repositories/:repositoryId"
            element={<RepositoryPage />}
          />
          <Route
            path="/repositories/:repositoryId/attention"
            element={<AttentionPage />}
          />
          <Route
            path="/repositories/:repositoryId/contributions/:pullRequestNumber"
            element={<ContributionPage />}
          />
          <Route
            path="*"
            element={<NotFoundPage />}
          />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
