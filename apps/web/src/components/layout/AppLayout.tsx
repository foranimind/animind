import { Outlet } from "react-router-dom";

import { AppSidebar } from "../sidebar/AppSidebar";
import "./layout.css";

export const AppLayout = () => (
  <div className="app-frame">
    <AppSidebar />
    <main className="app-workspace" aria-label="Studio workspace">
      <Outlet />
    </main>
  </div>
);
