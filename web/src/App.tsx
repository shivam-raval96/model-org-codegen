import { HashRouter, Route, Routes } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import { ProjectPage } from "./pages/ProjectPage";
import { ResearchLogIndex } from "./pages/researchLog/ResearchLogIndex";
import { ResearchLogLayout } from "./pages/researchLog/ResearchLogLayout";
import { ResearchLogWeekPage } from "./pages/researchLog/ResearchLogWeekPage";

export default function App() {
  return (
    <HashRouter>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<ProjectPage />} />
        <Route path="/research-log" element={<ResearchLogLayout />}>
          <Route index element={<ResearchLogIndex />} />
          <Route path=":weekId" element={<ResearchLogWeekPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
