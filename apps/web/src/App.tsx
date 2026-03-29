import { Route, Routes, useParams } from "react-router-dom";

import { CreatePage } from "./pages/CreatePage";
import { DetailPage } from "./pages/DetailPage";
import { HomeRoute } from "./pages/HomeRoute";
import { LibraryPage } from "./pages/LibraryPage";
import { JobRunPage } from "./pages/JobRunPage";
import { AppLayout } from "./components/layout/AppLayout";

const WorkDetailRoute = () => {
  const { id } = useParams();
  return <DetailPage jobId={id} />;
};

export const App = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/jobs/:id" element={<JobRunPage />} />
      <Route path="/works" element={<LibraryPage />} />
      <Route path="/works/:id" element={<WorkDetailRoute />} />
      <Route path="*" element={<CreatePage />} />
    </Route>
  </Routes>
);
