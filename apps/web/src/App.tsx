import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { AppLoadingShell } from "./components/layout/AppLoadingShell";

const AppLayout = lazy(async () => ({
  default: (await import("./components/layout/AppLayout")).AppLayout,
}));
const DetailPage = lazy(async () => ({
  default: (await import("./pages/DetailPage")).DetailPage,
}));
const JobRunPage = lazy(async () => ({
  default: (await import("./pages/JobRunPage")).JobRunPage,
}));
const LibraryPage = lazy(async () => ({
  default: (await import("./pages/LibraryPage")).LibraryPage,
}));
const StudioRoute = lazy(async () => ({
  default: (await import("./pages/StudioRoute")).StudioRoute,
}));
const WelcomePage = lazy(async () => ({
  default: (await import("./pages/WelcomePage")).WelcomePage,
}));

const WorkDetailRoute = () => {
  const { id } = useParams();
  return <DetailPage jobId={id} />;
};

export const App = () => (
  <Suspense fallback={<AppLoadingShell />}>
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route element={<AppLayout />}>
        <Route path="/studio" element={<StudioRoute />} />
        <Route path="/jobs/:id" element={<JobRunPage />} />
        <Route path="/works" element={<LibraryPage />} />
        <Route path="/works/:id" element={<WorkDetailRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);
