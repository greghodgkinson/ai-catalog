import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Nav } from "./components/Nav";
import { Home } from "./pages/Home";
import { Toolkits } from "./pages/Toolkits";
import { ToolkitDetail } from "./pages/ToolkitDetail";
import { Consumers } from "./pages/Consumers";
import { ConsumerDetail } from "./pages/ConsumerDetail";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Tools } from "./pages/Tools";
import { Executive } from "./pages/Executive";

export function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/"                 element={<Home />} />
        <Route path="/toolkits"         element={<Toolkits />} />
        <Route path="/toolkits/:id"     element={<ToolkitDetail />} />
        <Route path="/consumers"        element={<Consumers />} />
        <Route path="/consumers/:id"    element={<ConsumerDetail />} />
        <Route path="/agents"           element={<Agents />} />
        <Route path="/agents/:id"       element={<AgentDetail />} />
        <Route path="/tools"            element={<Tools />} />
        <Route path="/executive"        element={<Executive />} />
      </Routes>
    </BrowserRouter>
  );
}
