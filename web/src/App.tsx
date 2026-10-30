import { useEffect } from "react";
import { HashRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { StoreProvider } from "./lib/store";
import { UIProvider } from "./lib/ui";
import { Shell } from "./components/Shell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Home from "./pages/Home";
import StagePiece from "./pages/StagePiece";
import Booth from "./pages/Booth";
import Workspace from "./pages/Workspace";
import CueSheet from "./pages/CueSheet";
import Budget from "./pages/Budget";
import Readiness from "./pages/Readiness";
import Watch from "./pages/Watch";
import Manager from "./pages/Manager";
import Venues from "./pages/Venues";
import Agent from "./pages/Agent";
import Versions from "./pages/Versions";
import Pilot from "./pages/Pilot";
import MobileReview from "./pages/MobileReview";
import DesignSystem from "./pages/DesignSystem";
import Admin from "./pages/Admin";
import Provenance from "./pages/Provenance";
import About from "./pages/About";
import Settings from "./pages/Settings";
import Glossary from "./pages/Glossary";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="empty" style={{ paddingTop: 90 }}>
      <div className="page-kicker">404</div>
      <h1 className="page-title">That cue is not in the book.</h1>
      <p className="page-sub" style={{ margin: "10px auto 16px" }}>The page you asked for is not part of this show.</p>
      <Link className="btn primary" to="/">Back to the show</Link>
    </div>
  );
}

function Routed() {
  const location = useLocation();
  if (location.pathname === "/stage") {
    return <StagePiece />;
  }
  return (
    <Shell>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booth" element={<Booth />} />
          <Route path="/show" element={<Workspace />} />
          <Route path="/cues" element={<CueSheet />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/readiness" element={<Readiness />} />
          <Route path="/watch" element={<Watch />} />
          <Route path="/manager" element={<Manager />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/versions" element={<Versions />} />
          <Route path="/pilot" element={<Pilot />} />
          <Route path="/mobile" element={<MobileReview />} />
          <Route path="/design" element={<DesignSystem />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/provenance" element={<Provenance />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </Shell>
  );
}

export default function App() {
  return (
    <HashRouter>
      <UIProvider>
        <StoreProvider>
          <ScrollToTop />
          <Routed />
        </StoreProvider>
      </UIProvider>
    </HashRouter>
  );
}
