import { Routes, Route } from "react-router-dom";
import DownloadList from "./DownloadList";
import { OPFSList } from "./OPFSList";
import MarkdownPreview from "./MarkdownPreview";

const MainDashboard = () => (
  <>
    <section className="h-screen">
      <OPFSList />
    </section>
    <section className="h-screen">
      <DownloadList />
    </section>
  </>
);

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<MainDashboard />} />
      <Route path="/preview/:file_handle_id" element={<MarkdownPreview />} />
    </Routes>
  );
};

export default App;
