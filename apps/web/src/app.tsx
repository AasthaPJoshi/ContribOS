import {
  BrowserRouter,
  Route,
  Routes
} from "react-router-dom";

import {
  AuthProvider
} from "./auth/auth-context.js";
import {
  AppShell
} from "./components/app-shell.js";
import {
  ProtectedRoute
} from "./components/protected-route.js";
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
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route
              path="/"
              element={
                <HomePage />
              }
            />
            <Route
              path="/repositories/:repositoryId"
              element={
                <ProtectedRoute>
                  <RepositoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/repositories/:repositoryId/attention"
              element={
                <ProtectedRoute>
                  <AttentionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/repositories/:repositoryId/contributions/:pullRequestNumber"
              element={
                <ProtectedRoute>
                  <ContributionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                <NotFoundPage />
              }
            />
          </Routes>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
}
