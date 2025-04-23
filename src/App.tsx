import DownloadList from "./DownloadList";
import { OPFSList } from "./OPFSList";

const App = () => {
  return (
    <>
      <section className="h-screen">
        <DownloadList />
      </section>
      <section className="h-screen">
        <OPFSList />
      </section>
    </>
  );
};

export default App;
