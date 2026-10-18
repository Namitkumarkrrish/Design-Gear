
import { useState } from 'react';
import GearForm from './components/GearForm/GearForm';
import GearResults from './components/GearResults/GearResults';
import GearViewer from './components/GearViewer/GearViewer';
import './App.css';

function App() {
  const [gearType, setGearType] = useState('spur');
  const [gearData, setGearData] = useState({
    module: 4,
    teeth: 30,
    pressureAngle: 20,
    faceWidth: 40,
    power: 15,
    pinionSpeed: 1200,
    gearSpeed: 400,
    factorOfSafety: 1.5,
    helixAngle: 20,
  });

  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    setGenerated(true);
  }

  function handleReset() {
    setGearType('spur');
    setGearData({
      module: 4,
      teeth: 30,
      pressureAngle: 20,
      faceWidth: 40,
      power: 15,
      pinionSpeed: 1200,
      gearSpeed: 400,
      factorOfSafety: 1.5,
      helixAngle: 20,
    });
    setGenerated(false);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">⚙</span>
          <h1>Gear Design <span>Studio</span></h1>
        </div>

        <nav className="navigation">
          <button className="nav-item active">⚙ Design</button>
          <button className="nav-item">▤ Theory</button>
          <button className="nav-item">▧ Gallery</button>
          <button className="nav-item">ⓘ About</button>
        </nav>
      </header>

      <main className="dashboard">
        <section className="panel input-panel">
          <h2>⚙ Input Parameters</h2>
          <GearForm
            gearType={gearType}
            setGearType={setGearType}
            gearData={gearData}
            setGearData={setGearData}
            onGenerate={handleGenerate}
            onReset={handleReset}
          />
        </section>

        <section className="panel results-panel">
          <h2>▤ Design Results</h2>
          <GearResults
            gearType={gearType}
            gearData={gearData}
            generated={generated}
          />
        </section>

        <section className="viewer-section">
          <div className="panel viewer-panel">
            <h2>⬡ 3D Gear Model</h2>
            <GearViewer gearType={gearType} generated={generated} />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
