import DownloadList from "./DownloadList";
import { OPFSList } from "./OPFSList";

const App = () => {
  return (
    <>
      <section className="h-screen">
        <OPFSList />
      </section>
      <section className="h-screen">
        <DownloadList />
      </section>
    </>
  );
};

export default App;
